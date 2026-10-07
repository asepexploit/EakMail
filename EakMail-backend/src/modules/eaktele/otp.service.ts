/**
 * GramJS OTP reader untuk akun EakTele.
 * Connect ke akun dengan sessionEnc, baca pesan terbaru dari sender 42777
 * (Telegram Service Notifications — pengirim resmi kode OTP Telegram),
 * extract kode 5-6 digit, disconnect.
 *
 * Jika session gagal connect → tandai stok INVALID via stockService.
 */
import { decrypt } from '../../lib/crypto.js';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { stockRepository } from './stock.repository.js';
import { stockService } from './stock.service.js';

const log = logger.child({ module: 'eaktele-otp' });

const OTP_SENDER_ID = 777000; // Telegram internal: "Telegram" service sender (42777 is the phone, entity id is 777000)
const OTP_REGEX = /\b(\d{5,6})\b/;

export interface OtpResult {
  code: string;
  sentAt: Date;
  messageText: string;
}

export interface OtpError {
  reason: 'no_session' | 'session_invalid' | 'no_otp' | 'error';
  detail?: string;
}

export type OtpResponse =
  | { ok: true; data: OtpResult }
  | { ok: false; error: OtpError };

async function loadGramjs() {
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Api: (tg as any).Api,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TelegramClient: (tg as any).TelegramClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    StringSession: (sessions as any).StringSession,
  };
}

export async function readOtp(stockId: string): Promise<OtpResponse> {
  log.info({ stockId }, 'eaktele-otp: readOtp called');

  const stock = await stockRepository.findById(stockId);
  if (!stock) {
    log.warn({ stockId }, 'eaktele-otp: stock not found');
    return { ok: false, error: { reason: 'error', detail: 'stock not found' } };
  }

  if (!stock.sessionEnc) {
    log.warn({ stockId, phone: stock.phone }, 'eaktele-otp: no session');
    return { ok: false, error: { reason: 'no_session' } };
  }

  const sessionString = decrypt(stock.sessionEnc);

  // Pilih API credentials: per-akun → fallback ke EAKTELE_API_ID → TELEGRAM_API_ID
  // Gunakan || bukan ?? karena config default(0) sehingga ?? berhenti di 0
  const apiId = stock.apiId || config.EAKTELE_API_ID || config.TELEGRAM_API_ID;
  const apiHash = stock.apiHashEnc
    ? decrypt(stock.apiHashEnc)
    : (config.EAKTELE_API_HASH || config.TELEGRAM_API_HASH);

  log.info({ stockId, phone: stock.phone, hasSession: Boolean(stock.sessionEnc), apiId }, 'eaktele-otp: connecting');

  if (!apiId || !apiHash) {
    log.warn({ stockId }, 'eaktele-otp: API credentials not configured');
    return { ok: false, error: { reason: 'error', detail: 'API credentials not configured' } };
  }

  const { TelegramClient, StringSession } = await loadGramjs();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    { connectionRetries: 3 },
  );

  try {
    await client.connect();

    // Verifikasi session masih valid
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      await client.disconnect();
      await stockService.markInvalid(stockId);
      return { ok: false, error: { reason: 'session_invalid' } };
    }

    // Baca pesan dari Telegram service notification sender (777000).
    // Langkah: (1) resolve entity 777000 via users.GetUsers agar masuk cache GramJS,
    // (2) ambil pesan via getMessages, (3) fallback: invoke GetHistory dengan inputPeer dari cache.
    const { Api } = await loadGramjs();
    let messages: any[] = [];

    // Step 1: populate cache GramJS dengan entity 777000
    try {
      await client.invoke(new Api.users.GetUsers({
        id: [new Api.InputUser({ userId: BigInt(OTP_SENDER_ID), accessHash: BigInt(0) })],
      }));
    } catch (e0) {
      log.warn({ stockId, err: String(e0) }, 'eaktele-otp: GetUsers(777000) failed');
    }

    // Step 2: getMessages — entity sekarang ada di cache setelah GetUsers
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any[] = Array.from(
        await client.getMessages(BigInt(OTP_SENDER_ID), { limit: 10 }),
      );
      messages = result.filter((m) => m?.message);
      log.info({ stockId, count: messages.length }, 'eaktele-otp: getMessages(777000) result');
    } catch (e1) {
      log.warn({ stockId, err: String(e1) }, 'eaktele-otp: getMessages(777000) failed');
    }

    // Step 3: fallback — invoke GetHistory dengan inputPeer dari cache
    if (messages.length === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputPeer: any = await client.getInputEntity(BigInt(OTP_SENDER_ID));
        const hist = await client.invoke(new Api.messages.GetHistory({
          peer: inputPeer,
          limit: 10, offsetId: 0, offsetDate: 0, addOffset: 0, maxId: 0, minId: 0, hash: BigInt(0),
        }));
        messages = (hist.messages ?? []).filter((m: any) => m?.message);
        log.info({ stockId, count: messages.length }, 'eaktele-otp: GetHistory fallback result');
      } catch (e2) {
        log.warn({ stockId, err: String(e2) }, 'eaktele-otp: GetHistory fallback failed');
      }
    }

    log.info({ stockId, totalMessages: messages.length }, 'eaktele-otp: total messages to scan');

    if (!messages || messages.length === 0) {
      await client.disconnect();
      return { ok: false, error: { reason: 'no_otp' } };
    }

    // Cari pesan terbaru yang mengandung kode OTP
    for (const msg of messages) {
      const text: string = msg.message ?? '';
      const match = OTP_REGEX.exec(text);
      if (match) {
        await client.disconnect();
        await stockRepository.incrementOtpCount(stockId);

        // Update isSessionActive = true karena koneksi berhasil
        await stockRepository.update(stockId, { isSessionActive: true });

        return {
          ok: true,
          data: {
            code: match[1]!,
            sentAt: new Date(msg.date * 1000),
            messageText: text,
          },
        };
      }
    }

    await client.disconnect();
    return { ok: false, error: { reason: 'no_otp' } };

  } catch (err) {
    log.warn({ stockId, err }, 'OTP read failed — marking stock INVALID');
    try { await client.disconnect(); } catch { /* ignore */ }
    await stockService.markInvalid(stockId);
    return {
      ok: false,
      error: {
        reason: 'session_invalid',
        detail: (err instanceof Error ? err.message : String(err)),
      },
    };
  }
}
