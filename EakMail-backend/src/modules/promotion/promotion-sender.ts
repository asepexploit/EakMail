/**
 * Send promotion messages in batch using a single MTProto session per account run.
 * GetDialogs is called once up-front to populate the GramJS entity cache so that
 * numeric chatIds (groups without public usernames) can be resolved correctly.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';

const log = logger.child({ module: 'promotion-sender' });

export type SendErrorType = 'FLOOD_WAIT' | 'WRITE_FORBIDDEN' | 'BANNED' | 'NOT_FOUND' | 'SKIP' | 'OTHER';

export interface SendResult {
  ok: boolean;
  error?: string;
  errorType?: SendErrorType;
  floodWaitSeconds?: number;
}

export interface BatchSendParams {
  sessionEnc: string;
  targets: string[];
  message: string;
  imageUrl?: string | null;
  delayMs?: number;
  /** When true, bypass the last-message check (manual trigger). */
  force?: boolean;
  /** Called immediately after each group send completes — use to write logs incrementally. */
  onResult?: (target: string, result: SendResult) => Promise<void>;
}

export interface BatchSendResult {
  target: string;
  result: SendResult;
}

export async function sendPromotionMessagesBatch(params: BatchSendParams): Promise<BatchSendResult[]> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const sessionString = decrypt(params.sessionEnc);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(sessionString),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();

    // One GetDialogs call populates the entity cache so numeric chatIds resolve without
    // needing a separate lookup per group (access hashes are stored in GramJS session).
    try {
      await client.invoke(new Api.messages.GetDialogs({
        offsetDate: 0,
        offsetId: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        limit: 500,
        hash: BigInt(0),
      }));
    } catch {
      // Non-fatal — entity cache may still work for groups already in the session.
    }

    // Get our own user ID once — used to skip groups where our message is already last
    let myUserId: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const me: any = await client.getMe();
      myUserId = String(me.id);
    } catch {
      // Non-fatal — last-message check will be skipped
    }

    const results: BatchSendResult[] = [];
    for (let i = 0; i < params.targets.length; i++) {
      const target = params.targets[i]!;
      const result = await sendOne(client, Api, target, params.message, params.imageUrl ?? null, myUserId, params.force);
      results.push({ target, result });

      // Write log immediately so Riwayat Kirim updates in real-time
      if (params.onResult) {
        await params.onResult(target, result).catch((err) => {
          log.warn({ target, err }, 'onResult callback failed — DB log not written');
        });
      }

      // Account-level flood wait — stop all further sends from this account
      if (result.floodWaitSeconds) break;

      if (params.delayMs && params.delayMs > 0 && i < params.targets.length - 1) {
        await sleep(params.delayMs);
      }
    }
    return results;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

async function sendOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Api: any,
  target: string,
  message: string,
  imageUrl: string | null,
  myUserId: string | null,
  force?: boolean,
): Promise<SendResult> {
  try {
    // Invite links (t.me/+XXXX) are join links — they can't be used as send targets.
    // After syncing, the group will appear with its numeric chatId or username instead.
    if (/^https?:\/\/t\.me\/\+/.test(target) || /^t\.me\/\+/.test(target)) {
      return {
        ok: false,
        error: 'Invite link cannot be used as send target — sync account groups first',
        errorType: 'NOT_FOUND',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let peer: any;
    if (/^-\d+$/.test(target)) {
      // Numeric chatId (e.g. -1004347116819) — resolved from entity cache loaded above.
      try {
        peer = await client.getInputEntity(target);
      } catch {
        return { ok: false, error: `Entity not found for ${target} — account may not be a member`, errorType: 'NOT_FOUND' };
      }
    } else {
      // Username: @handle or plain handle
      const username = target.replace(/^@/, '');
      const resolved = await client.invoke(
        new Api.contacts.ResolveUsername({ username }),
      ) as { chats: { id: unknown; accessHash: unknown }[]; users: unknown[] };
      const chat = resolved.chats[0];
      if (!chat) return { ok: false, error: `Cannot resolve @${username}`, errorType: 'NOT_FOUND' };
      peer = chat;
    }

    // Skip if our message is already the last one in this group (scheduled runs only).
    // Manual triggers (force=true) always send regardless.
    // Wait until someone else posts before sending again — prevents spam.
    if (myUserId && !force) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history: any = await client.invoke(new Api.messages.GetHistory({
          peer,
          limit: 5,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: BigInt(0),
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = history?.messages ?? [];
        // Ignore service messages (join/leave/pin notifications) — only check real user messages.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastMsg: any = messages.find((m: any) => m.className === 'Message');
        const senderId = lastMsg?.senderId ?? lastMsg?.fromId?.userId;
        if (senderId && String(senderId) === myUserId) {
          log.info({ target }, 'last message is already ours — skipping to avoid spam');
          return { ok: false, error: 'Last message already ours — skipping', errorType: 'SKIP' };
        }
      } catch {
        // Best-effort — if check fails, proceed with send
      }
    }

    if (imageUrl) {
      await client.sendMessage(peer, { message, parseMode: 'markdown', file: imageUrl });
    } else {
      await client.sendMessage(peer, { message, parseMode: 'markdown' });
    }

    log.info({ target }, 'promotion message sent');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const floodMatch = msg.match(/FLOOD_WAIT_(\d+)/);
    if (floodMatch) {
      const seconds = parseInt(floodMatch[1] ?? '60', 10);
      log.warn({ target, seconds }, 'flood wait hit');
      return { ok: false, error: msg, errorType: 'FLOOD_WAIT', floodWaitSeconds: seconds };
    }
    if (
      msg.includes('CHAT_WRITE_FORBIDDEN') ||
      msg.includes('CHAT_SEND_PLAIN_FORBIDDEN') ||
      msg.includes('TOPIC_CLOSED')
    ) {
      log.info({ target }, 'write forbidden — will mark READ_ONLY');
      return { ok: false, error: msg, errorType: 'WRITE_FORBIDDEN' };
    }
    // SlowModeWaitError — per-chat slow mode, not account-wide flood wait.
    // Continue sending to other groups; just log this one as failed.
    if (msg.includes('required before sending another message in this chat')) {
      log.info({ target }, 'slow mode active in this chat — skipping group');
      return { ok: false, error: msg, errorType: 'OTHER' };
    }
    if (msg.includes('USER_BANNED_IN_CHANNEL')) {
      log.info({ target }, 'banned in channel — will mark READ_ONLY');
      return { ok: false, error: msg, errorType: 'BANNED' };
    }

    log.warn({ target, err }, 'promotion send failed');
    return { ok: false, error: msg, errorType: 'OTHER' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Lazy GramJS loader ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
interface GramjsBundle { Api: G; TelegramClient: G; StringSession: G }
let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  bundle = {
    Api: (tg as G).Api,
    TelegramClient: (tg as G).TelegramClient,
    StringSession: (sessions as G).StringSession,
  };
  return bundle;
}
