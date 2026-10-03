/**
 * Monitor groups service — sync, check send permission, leave.
 * After joining via auto-join, we immediately check if sending is allowed.
 * If not (channel broadcast / user banned), we leave automatically.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { monitoredGroupRepository as repo } from './monitor.repository.js';

const log = logger.child({ module: 'monitor-groups' });

export interface GroupInfo {
  chatId: string;
  username: string | null;
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  memberCount: number | null;
  canSendMessages: boolean;
}

/** Sync all dialogs from account into MonitoredGroup table. */
export async function syncAccountGroups(accountId: string, sessionEnc: string): Promise<void> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const client = new TelegramClient(
    new StringSession(decrypt(sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );
  try {
    await client.connect();
  } catch {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.invoke(new Api.messages.GetDialogs({
      offsetDate: 0, offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      limit: 200,
      hash: BigInt(0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chats: any[] = result.chats ?? [];
    for (const chat of chats) {
      if (chat.left || chat.kicked || chat.deactivated) continue;
      const isSupergroup = chat.megagroup === true;
      const isChannel = chat.broadcast === true;
      const isLegacyGroup = chat.className === 'Chat';
      if (!isSupergroup && !isChannel && !isLegacyGroup) continue;

      const chatId = isLegacyGroup ? `-${chat.id}` : `-100${chat.id}`;
      const type: GroupInfo['type'] = isLegacyGroup ? 'group' : isSupergroup ? 'supergroup' : 'channel';
      // Channels (broadcast) cannot receive messages from regular members
      const canSend = !isChannel;

      await repo.upsert(accountId, chatId, {
        chatId,
        username: chat.username ? chat.username.toLowerCase() : null,
        title: chat.title ?? '',
        type,
        memberCount: chat.participantsCount ?? null,
        canSendMessages: canSend,
        status: canSend ? 'ACTIVE' : 'READ_ONLY',
      });
    }
    log.info({ accountId, count: chats.length }, 'groups synced');
  } catch (err) {
    log.warn({ accountId, err }, 'syncAccountGroups failed');
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

/**
 * Resolve a raw link/username to the identifier GramJS can resolve.
 * Returns username or the original string if it's already a chatId.
 */
function resolveEntityInput(chatIdOrLink: string): string {
  // https://t.me/username or t.me/username → username
  const urlMatch = chatIdOrLink.match(/(?:https?:\/\/)?t\.me\/([^\s?#/+]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  // @username → username
  if (chatIdOrLink.startsWith('@')) return chatIdOrLink.slice(1);
  // numeric chatId like -100123 → return as-is
  return chatIdOrLink;
}

/**
 * After joining a group: check if we can send messages.
 * If not, leave immediately and mark READ_ONLY / LEFT.
 */
export async function checkAndLeaveIfReadOnly(
  accountId: string,
  sessionEnc: string,
  chatId: string,
  sourceLink: string | null,
): Promise<{ kept: boolean; reason: string }> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const client = new TelegramClient(
    new StringSession(decrypt(sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();
  } catch {
    return { kept: true, reason: 'connect failed' };
  }

  try {
    // Get full chat info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canSend = true;
    let title = chatId;
    let username: string | null = null;
    let type: GroupInfo['type'] = 'group';
    let memberCount: number | null = null;

    const entityInput = resolveEntityInput(chatId);
    // resolvedChatId will be updated from entity once fetched
    let resolvedChatId = chatId;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entity: any = await client.getEntity(entityInput);
      title = entity.title ?? chatId;
      username = entity.username ? entity.username.toLowerCase() : null;
      memberCount = entity.participantsCount ?? null;

      // Compute numeric chatId from entity
      if (entity.id) {
        const rawId = String(entity.id);
        if (entity.broadcast === true || entity.megagroup === true) {
          resolvedChatId = rawId.startsWith('-') ? rawId : `-100${rawId}`;
        } else {
          resolvedChatId = rawId.startsWith('-') ? rawId : `-${rawId}`;
        }
      }

      if (entity.broadcast === true) {
        canSend = false;
        type = 'channel';
      } else if (entity.megagroup === true) {
        type = 'supergroup';
      } else {
        type = 'group';
      }

      // Additional check: try to get send permissions from full chat
      if (canSend) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const peer: any = await client.getInputEntity(entityInput);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: peer }));
          const defaultBanned = full?.fullChat?.defaultBannedRights;
          if (defaultBanned?.sendMessages === true) {
            canSend = false;
          }
        } catch {
          // best-effort — if we can't check, assume ok
        }
      }
    } catch {
      // entity fetch failed — keep
    }

    // Upsert into MonitoredGroup using resolved numeric chatId
    await repo.upsert(accountId, resolvedChatId, {
      chatId: resolvedChatId,
      username,
      title,
      type,
      memberCount,
      canSendMessages: canSend,
      status: canSend ? 'ACTIVE' : 'READ_ONLY',
      sourceLink,
    });

    if (!canSend) {
      // Leave the group — no point staying if we can't send
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peer: any = await client.getInputEntity(entityInput);
        await client.invoke(new Api.channels.LeaveChannel({ channel: peer }));
        await repo.upsert(accountId, resolvedChatId, {
          chatId: resolvedChatId, username, title, type, memberCount,
          canSendMessages: false, status: 'LEFT', sourceLink,
        });
        log.info({ accountId, chatId: resolvedChatId, title }, 'left read-only group/channel');
        return { kept: false, reason: `${type === 'channel' ? 'Channel' : 'Grup'} read-only — otomatis leave` };
      } catch (leaveErr) {
        log.warn({ accountId, chatId: resolvedChatId, leaveErr }, 'leave failed');
        return { kept: true, reason: 'leave failed' };
      }
    }

    return { kept: true, reason: 'can send messages' };
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

/** Leave a specific group manually. */
export async function leaveGroup(accountId: string, sessionEnc: string, chatId: string): Promise<void> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const client = new TelegramClient(
    new StringSession(decrypt(sessionEnc)),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );
  try {
    await client.connect();
    const entityInput = resolveEntityInput(chatId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const peer: any = await client.getInputEntity(entityInput);
    await client.invoke(new Api.channels.LeaveChannel({ channel: peer }));
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
}

// ── Lazy GramJS loader ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
interface GramjsBundle { Api: G; TelegramClient: G; StringSession: G }
let bundle: GramjsBundle | null = null;
async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions');
  bundle = { Api: (tg as G).Api, TelegramClient: (tg as G).TelegramClient, StringSession: (sessions as G).StringSession };
  return bundle;
}
