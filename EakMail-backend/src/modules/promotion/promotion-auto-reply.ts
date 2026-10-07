/**
 * Auto-reply manager for promotion accounts.
 *
 * When a promotion account has autoReplyEnabled=true, this module starts a
 * persistent GramJS client that listens for incoming private messages (DMs)
 * and immediately replies with the configured message, directing users to order
 * via the configured bot.
 *
 * Pattern mirrors auto-join-monitor.ts (in-memory registry, start/stop per
 * account, startAll on boot).
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
    const { TelegramClient, StringSession, NewMessage } = await loadGramjs();
    const { config } = await import('../../config/index.js');
    const sessionString = decrypt(account.sessionEnc);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client: any = new TelegramClient(
      new StringSession(sessionString),
      config.TELEGRAM_API_ID,
      config.TELEGRAM_API_HASH,
      { connectionRetries: 5, autoReconnect: true },
    );

    await client.connect();

    // Handler: fires on every incoming private (DM) message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = async (event: any) => {
      try {
        const msg = event.message;
        if (!msg || !msg.peerId) return;

        // Only handle private messages (PeerUser)
        const cls: string = msg.peerId.className ?? '';
        if (cls !== 'PeerUser') return;

        // Don't reply to ourselves (outgoing)
        if (msg.out) return;

        await client.sendMessage(msg.peerId.userId, { message: replyText });
        log.info({ accountId, from: String(msg.peerId.userId) }, 'auto-reply sent');
      } catch (err) {
        log.warn({ accountId, err }, 'auto-reply send failed');
      }
    };

    const filter = new NewMessage({ incoming: true });
    client.addEventHandler(handler, filter);

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
interface GramjsBundle { TelegramClient: G; StringSession: G; NewMessage: G }
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
  };
  return bundle;
}
