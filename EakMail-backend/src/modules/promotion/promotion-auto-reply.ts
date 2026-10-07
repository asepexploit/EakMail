/**
 * Auto-reply manager for promotion accounts.
 *
 * When a promotion account has autoReplyEnabled=true, this module starts a
 * persistent GramJS client that listens for incoming private messages (DMs)
 * and immediately replies with the configured message, directing users to order
 * via the configured bot.
 *
 * Key GramJS gotchas applied here:
 * 1. addEventHandler MUST be called BEFORE start(), otherwise early updates are missed.
 * 2. event.isPrivate requires entity fetch; use peerId.className instead.
 * 3. Call getDialogs() after start() to trigger update-state sync with Telegram.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../db/client.js';

const log = logger.child({ module: 'promotion-auto-reply' });

export const DEFAULT_AUTO_REPLY =
  'Halo! Untuk memesan produk, silakan hubungi @EakMailBot ya 😊';

// In-memory registry: accountId → stop function
const running = new Map<string, { stop: () => void; clientRef: unknown }>();

export function isAutoReplyRunning(accountId: string): boolean {
  return running.has(accountId);
}

/** Start auto-reply listener for one account. */
export async function startAutoReply(accountId: string): Promise<void> {
  if (running.has(accountId)) return; // already running

  const account = await prisma.promotionAccount.findUnique({ where: { id: accountId } });
  if (!account?.sessionEnc || !account.autoReplyEnabled) return;

  const replyText = account.autoReplyMessage?.trim() || DEFAULT_AUTO_REPLY;

  try {
    const { TelegramClient, StringSession, NewMessage, Api } = await loadGramjs();
    const { config } = await import('../../config/index.js');
    const sessionString = decrypt(account.sessionEnc);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = new TelegramClient(
      new StringSession(sessionString),
      config.TELEGRAM_API_ID,
      config.TELEGRAM_API_HASH,
      { connectionRetries: 5, autoReconnect: true },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = async (event: any) => {
      try {
        const msg = event.message;
        if (!msg) return;

        // Skip outgoing messages
        if (msg.out) return;

        // Only private DMs — peerId.className is reliably set on raw messages
        // without needing entity fetch (unlike event.isPrivate)
        const peerClass: string = msg.peerId?.className ?? '';
        if (peerClass !== 'PeerUser') return;

        // Reply using the sender's peer directly
        await client.invoke(new Api.messages.SendMessage({
          peer: msg.peerId,
          message: replyText,
          randomId: BigInt(Math.floor(Math.random() * 1e15)),
        }));
        log.info({ accountId, peer: String(msg.peerId?.userId) }, 'auto-reply sent');
      } catch (err) {
        log.warn({ accountId, err }, 'auto-reply send failed');
      }
    };

    // IMPORTANT: register handler BEFORE start() so no early updates are missed
    const filter = new NewMessage({});
    client.addEventHandler(handler, filter);

    // start() activates the GramJS update loop. With a valid existing session
    // the phone/code/password callbacks are never invoked.
    await client.start({
      phoneNumber: async () => account.phone,
      phoneCode: async () => { throw new Error('session already exists'); },
      password: async () => { throw new Error('2FA not supported in auto-reply'); },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (err: Error) => log.warn({ accountId, err }, 'auto-reply client error'),
    });

    // Warm up the update state — Telegram won't push updates until the client
    // has synced its update sequence; getDialogs triggers that sync.
    await client.getDialogs({ limit: 1 }).catch(() => undefined);

    const stop = () => {
      try {
        client.removeEventHandler(handler, filter);
        void client.disconnect().catch(() => undefined);
      } catch {
        // ignore
      }
      running.delete(accountId);
    };

    running.set(accountId, { stop, clientRef: client });
    log.info({ accountId }, 'auto-reply listener started');
  } catch (err) {
    log.warn({ accountId, err }, 'startAutoReply: failed to start listener');
  }
}

/** Stop auto-reply listener for one account. */
export function stopAutoReply(accountId: string): void {
  const entry = running.get(accountId);
  if (!entry) return;
  entry.stop();
  log.info({ accountId }, 'auto-reply listener stopped');
}

/** Start all accounts that have autoReplyEnabled=true. Called on server boot. */
export async function startAllAutoReplies(): Promise<void> {
  const accounts = await prisma.promotionAccount.findMany({
    where: { autoReplyEnabled: true, sessionEnc: { not: null } },
    select: { id: true },
  });
  log.info({ count: accounts.length }, 'starting auto-reply listeners');
  await Promise.allSettled(accounts.map((a) => startAutoReply(a.id)));
}

// ---- lazy GramJS loader -------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
interface GramjsBundle { TelegramClient: G; StringSession: G; NewMessage: G; Api: G }
let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  const events = await import('telegram/events');
  bundle = {
    TelegramClient: (tg as G).TelegramClient,
    StringSession: (sessions as G).StringSession,
    NewMessage: (events as G).NewMessage,
    Api: (tg as G).Api,
  };
  return bundle;
}
