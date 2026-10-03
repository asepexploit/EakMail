/**
 * Auto-join monitor — polls each monitored group every 30s for new messages.
 * Replaces the unreliable GramJS NewMessage event (Telegram does not push updates
 * to MTProto clients for large groups/channels; polling is the only reliable method).
 *
 * Flow:
 *   pollLoop (every 30s per account) → getMessages(group, limit=10) → compare vs lastSeenId
 *     → new messages → logMessage (if messageLogEnabled) + enqueueLink (if t.me link found)
 *   Ticker (every 60s) → processNext(accountId) for each active account
 *     processNext: picks oldest PENDING → checks rate limit → delays 30-180s → joins → logs
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../db/client.js';
import { joinGroups } from './promotion-joiner.js';
import { checkAndLeaveIfReadOnly } from '../monitor/monitor-groups.service.js';

const log = logger.child({ module: 'auto-join-monitor' });

// Regex to extract all t.me links from a message
const TGLINK_RE = /https?:\/\/t\.me\/[^\s)>\]"']+/gi;

// In-memory registry of running poll loops keyed by accountId
const running = new Map<string, { stop: () => void }>();

// In-memory cache of messageLogEnabled per account (refreshed on toggle via PATCH /monitor)
const messageLogCache = new Map<string, boolean>();

// Per-group last-seen message id to avoid re-processing (key: "accountId:chatId")
const lastSeenId = new Map<string, number>();

/** Update the in-memory message-log flag (called when PATCH /monitor sets messageLogEnabled). */
export function setMessageLogEnabled(accountId: string, enabled: boolean): void {
  messageLogCache.set(accountId, enabled);
}

// Ticker interval handle
let tickerHandle: ReturnType<typeof setInterval> | null = null;

// How often to poll each account's groups for new messages
const POLL_INTERVAL_MS = 30_000;

// ── Public API ────────────────────────────────────────────────────────────────

export function isMonitorRunning(accountId: string): boolean {
  return running.has(accountId);
}

/** Start polling loop for one account. No-op if already running. */
export async function startMonitor(accountId: string): Promise<void> {
  if (running.has(accountId)) return;

  const account = await prisma.promotionAccount.findUnique({ where: { id: accountId } });
  if (!account?.sessionEnc || !account.autoJoinEnabled) return;

  // Seed message-log cache from DB
  messageLogCache.set(accountId, account.messageLogEnabled ?? false);

  log.info({ accountId }, 'auto-join monitor: starting poll loop');

  let stopped = false;

  const pollLoop = async () => {
    while (!stopped) {
      try {
        await pollAccount(accountId);
      } catch (err) {
        log.warn({ accountId, err }, 'monitor: poll error');
      }
      // Wait before next poll (check stopped every second to allow fast stop)
      for (let i = 0; i < POLL_INTERVAL_MS / 1000; i++) {
        if (stopped) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    log.info({ accountId }, 'auto-join monitor: poll loop stopped');
  };

  // Run loop in background (no await)
  void pollLoop();

  running.set(accountId, {
    stop: () => {
      stopped = true;
    },
  });

  log.info({ accountId }, 'auto-join monitor started — polling every 30s');
}

/** Poll latest messages from all active groups for one account. */
async function pollAccount(accountId: string): Promise<void> {
  const account = await prisma.promotionAccount.findUnique({
    where: { id: accountId },
    select: { sessionEnc: true, autoJoinEnabled: true, messageLogEnabled: true },
  });
  if (!account?.sessionEnc || !account.autoJoinEnabled) return;

  const groups = await prisma.monitoredGroup.findMany({
    where: { accountId, status: 'ACTIVE' },
    select: { chatId: true, title: true },
  });
  if (groups.length === 0) return;

  const { TelegramClient, StringSession } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const client = new TelegramClient(
    new StringSession(decrypt(account.sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 3 },
  );

  try {
    await client.connect();
  } catch (err) {
    log.warn({ accountId, err }, 'monitor: connect failed in poll');
    return;
  }

  const shouldLog = messageLogCache.get(accountId) ?? account.messageLogEnabled ?? false;

  try {
    for (const group of groups) {
      if (!running.has(accountId)) break;
      try {
        await pollGroup(client, accountId, group.chatId, group.title, shouldLog);
      } catch (err) {
        log.debug({ accountId, chatId: group.chatId, err }, 'monitor: group poll error');
      }
      // small delay between groups to avoid flood
      await new Promise((r) => setTimeout(r, 500));
    }
  } finally {
    // Set _destroyed before disconnect so GramJS _updateLoop exits immediately
    // instead of printing TIMEOUT errors while waiting for the next ping cycle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

/** Fetch the latest messages from one group and process any unseen ones. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pollGroup(client: any, accountId: string, chatId: string, chatTitle: string, shouldLog: boolean): Promise<void> {
  const cacheKey = `${accountId}:${chatId}`;
  const knownLastId = lastSeenId.get(cacheKey) ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = await client.getMessages(chatId, { limit: 10 });
  if (!messages || messages.length === 0) return;

  // Messages come newest-first; find the highest id we haven't seen yet
  const newMessages = messages.filter((m: any) => m.id > knownLastId);
  if (newMessages.length === 0) return;

  // Update last-seen id
  const maxId = Math.max(...newMessages.map((m: any) => m.id as number));
  lastSeenId.set(cacheKey, maxId);

  // If this is the first poll (knownLastId = 0), don't process old messages —
  // just seed the pointer so future polls only see genuinely new messages
  if (knownLastId === 0) {
    log.debug({ accountId, chatId, maxId }, 'monitor: seeded last-seen id, skipping initial batch');
    return;
  }

  // Process new messages (oldest first)
  for (const msg of newMessages.reverse()) {
    const text: string = msg?.message ?? msg?.text ?? '';
    if (!text) continue;

    log.info({ accountId, chatId, msgId: msg.id, textLen: text.length }, 'monitor: new message');

    if (shouldLog) {
      const senderName = resolveSenderName(msg);
      const senderId = msg?.senderId ? String(msg.senderId) : null;
      const hasLink = TGLINK_RE.test(text);
      TGLINK_RE.lastIndex = 0;
      void logMessageDirect(accountId, chatId, chatTitle, senderId, senderName, text, hasLink).catch(() => undefined);
    }

    const links = text.match(TGLINK_RE);
    TGLINK_RE.lastIndex = 0;
    if (links?.length) {
      for (const link of links) {
        void enqueueLink(accountId, chatId, link).catch((err) =>
          log.warn({ accountId, link, err }, 'enqueueLink error'),
        );
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSenderName(msg: any): string | null {
  const sender = msg?.sender;
  if (!sender) return null;
  if (sender.firstName) return [sender.firstName, sender.lastName].filter(Boolean).join(' ');
  if (sender.username) return `@${sender.username}`;
  if (sender.title) return sender.title; // for channels/bots
  return null;
}

/** Stop the GramJS listener for an account. */
export function stopMonitor(accountId: string): void {
  const entry = running.get(accountId);
  if (!entry) return;
  entry.stop();
  running.delete(accountId);
}

/** Start listeners for all accounts with autoJoinEnabled=true and kick off ticker. */
export async function startAllMonitors(): Promise<void> {
  const accounts = await prisma.promotionAccount.findMany({
    where: { autoJoinEnabled: true, status: 'CONNECTED' },
    select: { id: true },
  });
  for (const { id } of accounts) {
    await startMonitor(id).catch((err) => log.warn({ id, err }, 'startMonitor failed'));
  }
  log.info({ count: accounts.length }, 'auto-join monitors initialised');

  // Start queue processor ticker (runs every 60s)
  if (!tickerHandle) {
    tickerHandle = setInterval(() => void tickAllAccounts(), 60_000);
    // also run immediately after a short boot delay
    setTimeout(() => void tickAllAccounts(), 5_000);
  }
}

// ── Message logger ────────────────────────────────────────────────────────────

const MAX_MESSAGES_PER_ACCOUNT = 100;

async function logMessageDirect(
  accountId: string,
  chatId: string,
  chatTitle: string,
  senderId: string | null,
  senderName: string | null,
  text: string,
  hasLink: boolean,
): Promise<void> {
  await prisma.monitorMessage.create({
    data: {
      id: genId(),
      accountId,
      chatId,
      chatTitle,
      senderId,
      senderName,
      text: text.slice(0, 1000),
      hasLink,
    },
  });

  // Prune: keep only the newest MAX_MESSAGES_PER_ACCOUNT rows per account
  const oldest = await prisma.monitorMessage.findMany({
    where: { accountId },
    orderBy: { ts: 'desc' },
    skip: MAX_MESSAGES_PER_ACCOUNT,
    select: { id: true },
  });
  if (oldest.length > 0) {
    await prisma.monitorMessage.deleteMany({
      where: { id: { in: oldest.map((r: { id: string }) => r.id) } },
    });
  }

  // Increment message count on MonitoredGroup
  await prisma.monitoredGroup.updateMany({
    where: { accountId, chatId },
    data: { messageCount: { increment: 1 } },
  });
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

/**
 * Extract the username or invite hash from a t.me link.
 * Returns null for private invite links (t.me/+Hash) since we can't look them up by username.
 */
function extractUsername(rawLink: string): string | null {
  const m = rawLink.match(/(?:https?:\/\/)?t\.me\/([^\s?#/]+)/i);
  if (!m) return null;
  if (m[1]!.startsWith('+')) return null; // private invite — no username to check
  return m[1]!.toLowerCase();
}

/** Return true if the link is a direct post link (t.me/username/123) — not a join link. */
function isPostLink(rawLink: string): boolean {
  // t.me/username/123 — has a numeric segment after the username
  return /(?:https?:\/\/)?t\.me\/[^\s?#/]+\/\d+/i.test(rawLink);
}

// Cache: username → 'channel' | 'group' | 'unknown', TTL 24h
// Avoids repeated getEntity calls for the same username across many messages
const entityTypeCache = new Map<string, { type: 'channel' | 'group' | 'unknown'; expiresAt: number }>();
const ENTITY_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Check if a public username is a broadcast channel (cannot send messages as member).
 * Uses a shared GramJS client from the running poll loop — no extra connection needed.
 * Returns true if it's a broadcast channel and should be skipped.
 */
async function isChannelUsername(accountId: string, username: string): Promise<boolean> {
  const cached = entityTypeCache.get(username);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.type === 'channel';
  }

  // Need a GramJS client — reuse the account's session
  const account = await prisma.promotionAccount.findUnique({
    where: { id: accountId },
    select: { sessionEnc: true },
  });
  if (!account?.sessionEnc) return false;

  const { TelegramClient, StringSession } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const client = new TelegramClient(
    new StringSession(decrypt(account.sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entity: any = await client.getEntity(username);
    // Skip: broadcast channel, personal user account, or bot account
    const isSkippable =
      entity?.broadcast === true ||   // channel
      entity?.className === 'User' || // personal account
      entity?.bot === true;           // bot user (extra safety)
    entityTypeCache.set(username, {
      type: isSkippable ? 'channel' : 'group',
      expiresAt: Date.now() + ENTITY_CACHE_TTL,
    });
    return isSkippable;
  } catch {
    // If we can't resolve — private/invalid, skip it
    entityTypeCache.set(username, { type: 'unknown', expiresAt: Date.now() + ENTITY_CACHE_TTL });
    return true;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

/** Insert a PENDING queue entry — skip if already joined/queued or already in MonitoredGroup. */
async function enqueueLink(accountId: string, sourceGroup: string, rawLink: string): Promise<void> {
  // 0a. Skip post links (t.me/username/123) — these link to a specific message, not a group
  if (isPostLink(rawLink)) {
    log.debug({ accountId, rawLink }, 'enqueue: post link, skip');
    return;
  }

  // 0b. Skip bot links — Telegram requires all bot usernames to end with "bot"
  const username = extractUsername(rawLink);
  if (username && username.endsWith('bot')) {
    log.debug({ accountId, rawLink, username }, 'enqueue: bot link, skip');
    return;
  }

  // 0b. Skip broadcast channels — check entity type before joining (cached 24h per username)
  if (username) {
    const isChannel = await isChannelUsername(accountId, username);
    if (isChannel) {
      log.debug({ accountId, rawLink, username }, 'enqueue: broadcast channel or unresolvable, skip');
      return;
    }
  }

  // 1. Check MonitoredGroup — if akun pernah join grup ini (any status), skip permanently
  if (username) {
    const existing = await prisma.monitoredGroup.findFirst({
      where: { accountId, username },
      select: { id: true, status: true },
    });
    if (existing) {
      log.debug({ accountId, rawLink, username, status: existing.status }, 'enqueue: already in MonitoredGroup, skip');
      return;
    }
  }

  // 2. Check AutoJoinLog — permanent dedup (no time cutoff) to avoid re-joining after leave
  const anyLog = await prisma.autoJoinLog.findFirst({
    where: { accountId, rawLink, ok: true },
    select: { id: true },
  });
  if (anyLog) {
    log.debug({ accountId, rawLink }, 'enqueue: already joined before (log), skip');
    return;
  }

  // 3. Check AutoJoinQueue — already pending/processing/done (any time)
  const anyQueue = await prisma.autoJoinQueue.findFirst({
    where: {
      accountId,
      rawLink,
      status: { in: ['PENDING', 'PROCESSING', 'DONE'] },
    },
    select: { id: true },
  });
  if (anyQueue) {
    log.debug({ accountId, rawLink }, 'enqueue: already in queue, skip');
    return;
  }

  await prisma.autoJoinQueue.create({
    data: { id: genId(), accountId, rawLink, sourceGroup },
  });

  log.info({ accountId, rawLink, sourceGroup }, 'enqueue: link queued');
}

// ── Queue Processor ───────────────────────────────────────────────────────────

/** Process next PENDING item for every account that has them. */
async function tickAllAccounts(): Promise<void> {
  const accounts = await prisma.promotionAccount.findMany({
    where: { autoJoinEnabled: true, status: 'CONNECTED' },
    select: { id: true, autoJoinMaxPerHour: true },
  });

  for (const { id, autoJoinMaxPerHour } of accounts) {
    void processNext(id, autoJoinMaxPerHour).catch((err) =>
      log.warn({ accountId: id, err }, 'processNext error'),
    );
  }
}

/** Pick the oldest PENDING item for an account and process it if under rate limit. */
async function processNext(accountId: string, maxPerHour: number): Promise<void> {
  // Check hourly rate limit
  const recentJoins = await prisma.autoJoinLog.count({
    where: {
      accountId,
      joinedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentJoins >= maxPerHour) {
    log.debug({ accountId, recentJoins, maxPerHour }, 'queue: hourly limit reached, waiting');
    return;
  }

  // Pick oldest PENDING item (FIFO)
  const item = await prisma.autoJoinQueue.findFirst({
    where: { accountId, status: 'PENDING' },
    orderBy: { enqueuedAt: 'asc' },
  });
  if (!item) return; // nothing waiting

  // Lock it to PROCESSING so concurrent ticks don't pick the same item
  const locked = await prisma.autoJoinQueue.updateMany({
    where: { id: item.id, status: 'PENDING' },
    data: { status: 'PROCESSING' },
  });
  if (locked.count === 0) return; // someone else got it

  // Random delay 30s–3min (anti-flood)
  const delayMs = 30_000 + Math.floor(Math.random() * 150_000);
  log.info(
    { accountId, rawLink: item.rawLink, delayMs, recentJoins, maxPerHour },
    `queue: processing in ${Math.round(delayMs / 1000)}s`,
  );
  await new Promise((r) => setTimeout(r, delayMs));

  // Re-check rate limit after delay
  const joinedAfterDelay = await prisma.autoJoinLog.count({
    where: {
      accountId,
      joinedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (joinedAfterDelay >= maxPerHour) {
    // Put back to PENDING so it will be retried next tick
    await prisma.autoJoinQueue.update({
      where: { id: item.id },
      data: { status: 'PENDING' },
    });
    log.info({ accountId }, 'queue: limit hit after delay, re-queued');
    return;
  }

  // Check account is still enabled
  const freshAccount = await prisma.promotionAccount.findUnique({
    where: { id: accountId },
    select: { sessionEnc: true, autoJoinEnabled: true },
  });
  if (!freshAccount?.sessionEnc || !freshAccount.autoJoinEnabled) {
    await prisma.autoJoinQueue.update({
      where: { id: item.id },
      data: { status: 'SKIPPED', processedAt: new Date() },
    });
    return;
  }

  // Execute join
  const [result] = await joinGroups(freshAccount.sessionEnc, [item.rawLink]);

  const joinLog = await prisma.autoJoinLog.create({
    data: {
      accountId,
      sourceGroup: item.sourceGroup,
      targetGroup: item.rawLink,
      rawLink: item.rawLink,
      ok: result?.ok ?? false,
      alreadyMember: result?.alreadyMember ?? false,
      error: result?.error ?? null,
    },
  });

  await prisma.autoJoinQueue.update({
    where: { id: item.id },
    data: { status: 'DONE', processedAt: new Date(), logId: joinLog.id },
  });

  log.info(
    { accountId, rawLink: item.rawLink, ok: result?.ok, alreadyMember: result?.alreadyMember },
    'queue: item processed',
  );

  // Check send permission after join, leave if read-only
  if (result?.ok && !result?.alreadyMember) {
    void checkAndLeaveIfReadOnly(accountId, freshAccount.sessionEnc, item.rawLink, item.rawLink)
      .then(({ kept, reason }) =>
        log.info({ accountId, rawLink: item.rawLink, kept, reason }, 'queue: send-check done'),
      )
      .catch((err) => log.warn({ accountId, rawLink: item.rawLink, err }, 'queue: send-check error'));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Lazy GramJS loader ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
interface GramjsBundle { TelegramClient: G; StringSession: G }
let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  bundle = {
    TelegramClient: (tg as G).TelegramClient,
    StringSession: (sessions as G).StringSession,
  };
  return bundle;
}
