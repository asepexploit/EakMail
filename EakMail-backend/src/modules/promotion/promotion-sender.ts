/**
 * Send a promotion message to a Telegram group/channel via MTProto (GramJS).
 * Each send uses a short-lived client connection (connect → send → disconnect).
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';

const log = logger.child({ module: 'promotion-sender' });

export interface SendParams {
  sessionEnc: string;
  targetGroup: string; // @username or numeric chat_id string
  message: string;
  imageUrl?: string | null;
}

export interface SendResult {
  ok: boolean;
  error?: string;
  floodWaitSeconds?: number;
}

type GramjsClient = { connect(): Promise<boolean>; disconnect(): Promise<void>; invoke(r: unknown): Promise<unknown>; sendMessage(peer: unknown, opts: unknown): Promise<unknown> };

export async function sendPromotionMessage(params: SendParams): Promise<SendResult> {
  let client: GramjsClient | null = null;

  try {
    const { TelegramClient, StringSession, Api } = await loadGramjs();
    const { config } = await import('../../config/index.js');
    const sessionString = decrypt(params.sessionEnc);

    client = new TelegramClient(
      new StringSession(sessionString),
      config.TELEGRAM_API_ID,
      config.TELEGRAM_API_HASH,
      { connectionRetries: 2 },
    ) as GramjsClient;

    await client.connect();

    const c = client;
    // Resolve the target peer
    const peer = await c.invoke(
      new Api.contacts.ResolveUsername({ username: params.targetGroup.replace(/^@/, '') }),
    ) as { chats: { id: unknown; accessHash: unknown }[]; users: unknown[] };

    const chat = peer.chats[0];
    if (!chat) throw new Error(`Cannot resolve ${params.targetGroup}`);

    if (params.imageUrl) {
      await c.sendMessage(chat, {
        message: params.message,
        parseMode: 'markdown',
        file: params.imageUrl,
      });
    } else {
      await c.sendMessage(chat, {
        message: params.message,
        parseMode: 'markdown',
      });
    }

    log.info({ target: params.targetGroup }, 'promotion message sent');
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const floodMatch = message.match(/FLOOD_WAIT_(\d+)/);
    if (floodMatch) {
      const seconds = parseInt(floodMatch[1] ?? '60', 10);
      log.warn({ target: params.targetGroup, seconds }, 'flood wait hit');
      return { ok: false, error: message, floodWaitSeconds: seconds };
    }
    log.warn({ target: params.targetGroup, err }, 'promotion send failed');
    return { ok: false, error: message };
  } finally {
    await client?.disconnect().catch(() => undefined);
  }
}

// ---- lazy GramJS -------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GramjsAny = any;

interface GramjsBundle {
  Api: GramjsAny;
  TelegramClient: GramjsAny;
  StringSession: GramjsAny;
}

let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions');
  bundle = {
    Api: (tg as GramjsAny).Api,
    TelegramClient: (tg as GramjsAny).TelegramClient,
    StringSession: (sessions as GramjsAny).StringSession,
  };
  return bundle;
}
