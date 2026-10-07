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
  const stock = await stockRepository.findById(stockId);
  if (!stock) return { ok: false, error: { reason: 'error', detail: 'stock not found' } };

  if (!stock.sessionEnc) {
    return { ok: false, error: { reason: 'no_session' } };
  }

  const sessionString = decrypt(stock.sessionEnc);

  // Pilih API credentials: per-akun (opsional) → fallback ke EAKTELE_API_ID → TELEGRAM_API_ID
  const apiId = stock.apiId ?? config.EAKTELE_API_ID ?? config.TELEGRAM_API_ID;
  const apiHash = stock.apiHashEnc
    ? decrypt(stock.apiHashEnc)
    : (config.EAKTELE_API_HASH || config.TELEGRAM_API_HASH);

  if (!apiId || !apiHash) {
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

    // Ambil pesan terbaru dari entity 777000 (Telegram service sender)
    const messages = await client.getMessages(OTP_SENDER_ID, { limit: 5 });

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
