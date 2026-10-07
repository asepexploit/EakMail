/**
 * Auto-reply manager for promotion accounts.
 *
 * Uses **polling** (not GramJS event handlers) because the auto-join-monitor
 * already proved that NewMessage events are unreliable with MTProto userbots.
 *
 * Every POLL_INTERVAL_MS the loop:
 *   1. Connects a short-lived GramJS client
 *   2. Calls getDialogs(limit=30) — which returns unread counts per dialog
 *   3. For each PeerUser dialog with unreadCount > 0 that we haven't replied to
 *      recently, sends the auto-reply message and marks as read
 *   4. Disconnects the client
 *
 * A cooldown map prevents re-replying to the same user within 24 hours.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../db/client.js';

const log = logger.child({ module: 'promotion-auto-reply' });

export const DEFAULT_AUTO_REPLY =
  'Halo! Untuk memesan produk, silakan hubungi @EakMailBot ya 😊';

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory registry: accountId → stop handle
const running = new Map<string, { stop: () => void }>();

// Per-account cooldown map: accountId → Map<userId, lastRepliedTimestamp>
const cooldowns = new Map<string, Map<string, number>>();

export function isAutoReplyRunning(accountId: string): boolean {
  return running.has(accountId);
}

/** Start auto-reply polling loop for one account. */
export async function startAutoReply(accountId: string): Promise<void> {
  if (running.has(accountId)) return;

  const account = await prisma.promotionAccount.findUnique({ where: { id: accountId } });
  if (!account?.sessionEnc || !account.autoReplyEnabled) return;

  log.info({ accountId }, 'auto-reply: starting poll loop');

  let stopped = false;

  const pollLoop = async () => {
    while (!stopped) {
      try {
        await pollForDMs(accountId);
      } catch (err) {
        log.warn({ accountId, err }, 'auto-reply: poll error');
      }
      // Interruptible sleep
      for (let i = 0; i < POLL_INTERVAL_MS / 1000; i++) {
        if (stopped) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    log.info({ accountId }, 'auto-reply: poll loop stopped');
  };

  void pollLoop();

  running.set(accountId, {
    stop: () => { stopped = true; },
  });

  log.info({ accountId }, 'auto-reply started — polling every 15s');
}

/** Poll getDialogs and reply to unread private messages. */
async function pollForDMs(accountId: string): Promise<void> {
  const account = await prisma.promotionAccount.findUnique({
    where: { id: accountId },
    select: { sessionEnc: true, autoReplyEnabled: true, autoReplyMessage: true },
  });
  if (!account?.sessionEnc || !account.autoReplyEnabled) return;

  const replyText = account.autoReplyMessage?.trim() || DEFAULT_AUTO_REPLY;

  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(decrypt(account.sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();
  } catch (err) {
    log.warn({ accountId, err }, 'auto-reply: connect failed');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.invoke(new Api.messages.GetDialogs({
      offsetDate: 0,
      offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      limit: 30,
      hash: BigInt(0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dialogs: any[] = result.dialogs ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usersMap = new Map<string, any>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.users ?? []).map((u: any) => [String(u.id), u]),
    );

    // Get or create cooldown map for this account
    if (!cooldowns.has(accountId)) cooldowns.set(accountId, new Map());
    const cd = cooldowns.get(accountId)!;
    const now = Date.now();

    for (const dialog of dialogs) {
      // Only private user chats
      if (dialog.peer?.className !== 'PeerUser') continue;

      // Skip if no unread messages
      const unread: number = dialog.unreadCount ?? 0;
      if (unread === 0) continue;

      const userId = String(dialog.peer.userId);

      // Skip bots, deleted users, and Telegram official (login codes etc.)
      const user = usersMap.get(userId);
      if (!user || user.bot || user.deleted) continue;
      if (userId === '777000') continue;

      // Cooldown — don't re-reply within 24 hours
      const lastReply = cd.get(userId) ?? 0;
      if (now - lastReply < COOLDOWN_MS) continue;

      // Send auto-reply
      try {
        await client.invoke(new Api.messages.SendMessage({
          peer: new Api.InputPeerUser({
            userId: dialog.peer.userId,
            accessHash: BigInt(user.accessHash?.toString() ?? '0'),
          }),
          message: replyText,
          randomId: BigInt(Math.floor(Math.random() * 1e15)),
        }));

        // Mark conversation as read
        await client.invoke(new Api.messages.ReadHistory({
          peer: new Api.InputPeerUser({
            userId: dialog.peer.userId,
            accessHash: BigInt(user.accessHash?.toString() ?? '0'),
          }),
          maxId: 0,
        })).catch(() => undefined);

        cd.set(userId, now);
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
        log.info({ accountId, userId, name }, 'auto-reply sent');
      } catch (err) {
        log.warn({ accountId, userId, err }, 'auto-reply: send failed');
      }
    }

    // Prune old cooldown entries (older than 24h)
    for (const [uid, ts] of cd) {
      if (now - ts > COOLDOWN_MS) cd.delete(uid);
    }
  } catch (err) {
    log.warn({ accountId, err }, 'auto-reply: getDialogs failed');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._destroyed = true;
  await client.disconnect().catch(() => undefined);
}

/** Stop auto-reply polling loop for one account. */
export function stopAutoReply(accountId: string): void {
  const entry = running.get(accountId);
  if (!entry) return;
  entry.stop();
  running.delete(accountId);
  cooldowns.delete(accountId);
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
interface GramjsBundle { TelegramClient: G; StringSession: G; Api: G }
let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  bundle = {
    TelegramClient: (tg as G).TelegramClient,
    StringSession: (sessions as G).StringSession,
    Api: (tg as G).Api,
  };
  return bundle;
}
