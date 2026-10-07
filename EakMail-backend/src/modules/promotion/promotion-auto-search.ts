/**
 * Auto-search & auto-join service for promotion accounts.
 *
 * Every SEARCH_INTERVAL_MS (3 hours):
 *   1. Pick a random batch of keywords from the DB
 *   2. For each keyword, use a random account to search Telegram via contacts.Search
 *   3. Found groups → filter already known → enqueue in AutoSearchQueue
 *
 * A separate join loop processes the queue one-by-one with random delays (2-5 min)
 * to avoid Telegram rate limits. After joining, checks if account can send messages.
 * If not → leave immediately.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../db/client.js';
import { DEFAULT_KEYWORDS } from './auto-search-keywords.js';

const log = logger.child({ module: 'auto-search' });

const SEARCH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const JOIN_DELAY_MIN_MS = 2 * 60 * 1000; // 2 minutes
const JOIN_DELAY_MAX_MS = 5 * 60 * 1000; // 5 minutes
const KEYWORDS_PER_CYCLE = 10; // search 10 random keywords per cycle

let searchTimer: ReturnType<typeof setTimeout> | null = null;
let joinLoopRunning = false;
let joinLoopStopped = false;

// ── Keyword Management ───────────────────────────────────────────────────────

export async function seedKeywords(): Promise<number> {
  let added = 0;
  for (const kw of DEFAULT_KEYWORDS) {
    try {
      await prisma.autoSearchKeyword.create({ data: { keyword: kw } });
      added++;
    } catch {
      // unique constraint — already exists
    }
  }
  if (added > 0) log.info({ added, total: DEFAULT_KEYWORDS.length }, 'seeded keywords');
  return added;
}

export async function getKeywords() {
  return prisma.autoSearchKeyword.findMany({ orderBy: { keyword: 'asc' } });
}

export async function addKeyword(keyword: string) {
  return prisma.autoSearchKeyword.upsert({
    where: { keyword },
    update: { enabled: true },
    create: { keyword, enabled: true },
  });
}

export async function removeKeyword(id: string) {
  return prisma.autoSearchKeyword.delete({ where: { id } });
}

export async function toggleKeyword(id: string, enabled: boolean) {
  return prisma.autoSearchKeyword.update({ where: { id }, data: { enabled } });
}

// ── Search Logic ─────────────────────────────────────────────────────────────

export async function startAutoSearch(): Promise<void> {
  await seedKeywords();
  log.info('auto-search: starting scheduler (every 3h)');
  scheduleNextSearch(5_000); // first search after 5s on boot
  startJoinLoop();
}

export function stopAutoSearch(): void {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
  joinLoopStopped = true;
  log.info('auto-search: stopped');
}

let searching = false;

export function isSearchRunning(): boolean {
  return searching;
}

export async function triggerSearchNow(): Promise<{ enqueued: number }> {
  if (searching) return { enqueued: 0 };
  searching = true;
  try {
    const count = await runSearchCycle();
    return { enqueued: count };
  } finally {
    searching = false;
  }
}

function scheduleNextSearch(delayMs: number = SEARCH_INTERVAL_MS): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try {
      await runSearchCycle();
    } catch (err) {
      log.error({ err }, 'auto-search cycle failed');
    }
    scheduleNextSearch();
  }, delayMs);
}

async function runSearchCycle(): Promise<number> {
  const keywords = await prisma.autoSearchKeyword.findMany({
    where: { enabled: true },
    select: { keyword: true },
  });
  if (keywords.length === 0) { log.info('no enabled keywords'); return 0; }

  const accounts = await prisma.promotionAccount.findMany({
    where: { status: 'CONNECTED', sessionEnc: { not: null } },
    select: { id: true, sessionEnc: true },
  });
  if (accounts.length === 0) { log.info('no connected accounts for search'); return 0; }

  // Pick random keywords for this cycle
  const shuffled = keywords.sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, KEYWORDS_PER_CYCLE);

  log.info({ count: batch.length, total: keywords.length }, 'auto-search: starting cycle');

  let totalFound = 0;

  for (const { keyword } of batch) {
    // Pick a random account for this keyword
    const account = accounts[Math.floor(Math.random() * accounts.length)]!;
    try {
      const found = await searchAndEnqueue(account.id, account.sessionEnc!, keyword);
      totalFound += found;
    } catch (err) {
      log.warn({ keyword, err }, 'search failed for keyword');
    }
    // Small delay between searches
    await sleep(3000 + Math.random() * 5000);
  }

  log.info({ totalFound }, 'auto-search: cycle complete');
  return totalFound;
}

async function searchAndEnqueue(
  accountId: string,
  sessionEnc: string,
  keyword: string,
): Promise<number> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(decrypt(sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();
  } catch (err) {
    log.warn({ accountId, keyword, err }, 'search: connect failed');
    return 0;
  }

  let enqueued = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.invoke(new Api.contacts.Search({
      q: keyword,
      limit: 50,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chats: any[] = result.chats ?? [];

    for (const chat of chats) {
      // Only groups and supergroups (not channels/broadcasts, not private users)
      const isGroup = chat.className === 'Chat' ||
        (chat.className === 'Channel' && chat.megagroup);
      if (!isGroup) continue;

      const chatId = chat.className === 'Chat'
        ? `-${chat.id}`
        : `-100${chat.id}`;

      // Skip if already in queue or already monitored by any account
      const existsInQueue = await prisma.autoSearchQueue.findFirst({
        where: { chatId, accountId },
      });
      if (existsInQueue) continue;

      const existsMonitored = await prisma.monitoredGroup.findFirst({
        where: { chatId, accountId },
      });
      if (existsMonitored) continue;

      try {
        await prisma.autoSearchQueue.create({
          data: {
            accountId,
            chatId,
            username: chat.username ?? null,
            title: chat.title ?? keyword,
            memberCount: chat.participantsCount ?? null,
            keyword,
            status: 'PENDING',
          },
        });
        enqueued++;
      } catch {
        // unique constraint — already enqueued for this account
      }
    }

    if (enqueued > 0) {
      log.info({ keyword, accountId, found: chats.length, enqueued }, 'search: groups enqueued');
    }
  } catch (err) {
    log.warn({ keyword, accountId, err }, 'search: contacts.Search failed');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._destroyed = true;
  await client.disconnect().catch(() => undefined);

  return enqueued;
}

// ── Join Loop ────────────────────────────────────────────────────────────────

function startJoinLoop(): void {
  if (joinLoopRunning) return;
  joinLoopRunning = true;
  joinLoopStopped = false;

  const loop = async () => {
    while (!joinLoopStopped) {
      try {
        const processed = await processNextInQueue();
        if (!processed) {
          // No pending items — sleep 1 minute then check again
          await interruptibleSleep(60_000);
          continue;
        }
      } catch (err) {
        log.warn({ err }, 'join loop: error processing');
      }
      // Random delay between joins
      const delay = JOIN_DELAY_MIN_MS + Math.random() * (JOIN_DELAY_MAX_MS - JOIN_DELAY_MIN_MS);
      log.info({ delaySeconds: Math.round(delay / 1000) }, 'join loop: waiting before next join');
      await interruptibleSleep(delay);
    }
    joinLoopRunning = false;
    log.info('join loop stopped');
  };

  void loop();
}

async function processNextInQueue(): Promise<boolean> {
  // Pick the oldest PENDING item
  const item = await prisma.autoSearchQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { enqueuedAt: 'asc' },
  });
  if (!item) return false;

  // Mark as JOINING
  await prisma.autoSearchQueue.update({
    where: { id: item.id },
    data: { status: 'JOINING' },
  });

  const account = await prisma.promotionAccount.findUnique({
    where: { id: item.accountId },
    select: { id: true, sessionEnc: true, status: true },
  });

  if (!account?.sessionEnc || account.status !== 'CONNECTED') {
    await prisma.autoSearchQueue.update({
      where: { id: item.id },
      data: { status: 'SKIPPED', error: 'Account not connected', processedAt: new Date() },
    });
    return true;
  }

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
    await prisma.autoSearchQueue.update({
      where: { id: item.id },
      data: { status: 'FAILED', error: 'Connect failed', processedAt: new Date() },
    });
    return true;
  }

  try {
    // Resolve the chat entity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inputChannel: any;
    if (item.username) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolved: any = await client.invoke(
        new Api.contacts.ResolveUsername({ username: item.username }),
      );
      const chat = resolved.chats?.[0];
      if (!chat) {
        await markFailed(item.id, 'Cannot resolve username');
        return true;
      }
      inputChannel = new Api.InputChannel({
        channelId: chat.id,
        accessHash: BigInt(chat.accessHash?.toString() ?? '0'),
      });
    } else {
      // Try to get entity from chatId
      try {
        inputChannel = await client.getInputEntity(item.chatId);
      } catch {
        await markFailed(item.id, 'Cannot resolve chatId — entity not cached');
        return true;
      }
    }

    // Join the group
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: inputChannel }));
      log.info({ title: item.title, chatId: item.chatId }, 'auto-search: joined group');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CHANNELS_TOO_MUCH') || msg.includes('USER_CHANNELS_TOO_MUCH')) {
        await markFailed(item.id, 'Account joined too many groups');
        return true;
      }
      if (msg.includes('INVITE_REQUEST_SENT')) {
        await prisma.autoSearchQueue.update({
          where: { id: item.id },
          data: { status: 'SKIPPED', error: 'Join request sent — needs admin approval', processedAt: new Date() },
        });
        return true;
      }
      if (msg.includes('USER_ALREADY_PARTICIPANT')) {
        // Already a member — still check if can send
      } else {
        await markFailed(item.id, msg.slice(0, 200));
        return true;
      }
    }

    // Wait a bit then check if we can send messages
    await sleep(3000);

    let canSend = false;
    let chatTitle = item.title;
    let memberCount = item.memberCount;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fullChat: any = await client.invoke(new Api.channels.GetFullChannel({
        channel: inputChannel,
      }));
      const chatInfo = fullChat.chats?.[0];
      if (chatInfo) {
        chatTitle = chatInfo.title ?? chatTitle;
        memberCount = chatInfo.participantsCount ?? memberCount;
        const rights = chatInfo.defaultBannedRights;
        canSend = !rights?.sendMessages;
      } else {
        canSend = true; // assume can send if we can't check
      }
    } catch {
      canSend = true; // assume can send
    }

    if (!canSend) {
      // Leave the group — can't send messages
      try {
        await client.invoke(new Api.channels.LeaveChannel({ channel: inputChannel }));
      } catch { /* best effort */ }
      await prisma.autoSearchQueue.update({
        where: { id: item.id },
        data: { status: 'LEFT', error: 'Cannot send messages — left', processedAt: new Date() },
      });
      log.info({ title: item.title, chatId: item.chatId }, 'auto-search: left (read-only)');
      return true;
    }

    // Success — add to MonitoredGroup
    try {
      await prisma.monitoredGroup.upsert({
        where: { accountId_chatId: { accountId: item.accountId, chatId: item.chatId } },
        update: { status: 'ACTIVE', canSendMessages: true, title: chatTitle, memberCount },
        create: {
          accountId: item.accountId,
          chatId: item.chatId,
          username: item.username,
          title: chatTitle,
          type: 'supergroup',
          memberCount,
          canSendMessages: true,
          status: 'ACTIVE',
          sourceLink: `auto-search: ${item.keyword}`,
        },
      });
    } catch (err) {
      log.warn({ err, chatId: item.chatId }, 'upsert MonitoredGroup failed');
    }

    await prisma.autoSearchQueue.update({
      where: { id: item.id },
      data: { status: 'JOINED', processedAt: new Date() },
    });

    log.info({ title: chatTitle, chatId: item.chatId, accountId: item.accountId }, 'auto-search: joined & can send');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(item.id, msg.slice(0, 200));
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }

  return true;
}

async function markFailed(id: string, error: string): Promise<void> {
  await prisma.autoSearchQueue.update({
    where: { id },
    data: { status: 'FAILED', error, processedAt: new Date() },
  });
}

// ── Queue Stats ──────────────────────────────────────────────────────────────

export async function getQueueStats() {
  const [pending, joining, joined, left, failed, skipped] = await Promise.all([
    prisma.autoSearchQueue.count({ where: { status: 'PENDING' } }),
    prisma.autoSearchQueue.count({ where: { status: 'JOINING' } }),
    prisma.autoSearchQueue.count({ where: { status: 'JOINED' } }),
    prisma.autoSearchQueue.count({ where: { status: 'LEFT' } }),
    prisma.autoSearchQueue.count({ where: { status: 'FAILED' } }),
    prisma.autoSearchQueue.count({ where: { status: 'SKIPPED' } }),
  ]);
  return { pending, joining, joined, left, failed, skipped, total: pending + joining + joined + left + failed + skipped };
}

export async function getQueueItems(status?: string, limit = 50) {
  return prisma.autoSearchQueue.findMany({
    where: status ? { status: status as 'PENDING' } : undefined,
    orderBy: { enqueuedAt: 'desc' },
    take: limit,
  });
}

export async function clearQueue(status?: string) {
  if (status) {
    return prisma.autoSearchQueue.deleteMany({ where: { status: status as 'PENDING' } });
  }
  return prisma.autoSearchQueue.deleteMany({
    where: { status: { in: ['JOINED', 'LEFT', 'FAILED', 'SKIPPED'] } },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function interruptibleSleep(ms: number): Promise<void> {
  for (let i = 0; i < ms / 1000; i++) {
    if (joinLoopStopped) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

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
