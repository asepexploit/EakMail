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
 * Private invite links (t.me/+HASH) must be handled separately via CheckChatInvite.
 */
function resolveEntityInput(chatIdOrLink: string): string {
  // https://t.me/username or t.me/username → username (exclude + to avoid matching invite links)
  const urlMatch = chatIdOrLink.match(/(?:https?:\/\/)?t\.me\/([^\s?#/+]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  // @username → username
  if (chatIdOrLink.startsWith('@')) return chatIdOrLink.slice(1);
  // numeric chatId like -100123 → return as-is
  return chatIdOrLink;
}

/** Extract invite hash from t.me/+HASH or t.me/joinchat/HASH links. */
function extractInviteHash(link: string): string | null {
  const m = link.match(/t\.me\/(?:\+|joinchat\/)([^\s?#]+)/i);
  return m?.[1] ?? null;
}

/**
 * After joining a group: check if we can send messages.
 * If not, leave immediately and mark READ_ONLY / LEFT.
 *
 * Invite links (t.me/+HASH) are resolved via messages.CheckChatInvite which returns
 * ChatInviteAlready.chat for accounts that already joined — getEntity does not handle
 * invite-link URLs and would fail, leaving a broken chatId in the DB.
 *
 * Two layers of send-permission checks:
 *   1. entity.broadcast === true          → channel, nobody can post
 *   2. defaultBannedRights.sendMessages   → group-wide mute
 *   3. channels.GetParticipant.bannedRights → account individually muted/banned
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
    let canSend = true;
    let title = chatId;
    let username: string | null = null;
    let type: GroupInfo['type'] = 'group';
    let memberCount: number | null = null;
    let resolvedChatId = chatId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entity: any = null;

    // ── Resolve entity ────────────────────────────────────────────────────
    const isInviteLink = /(?:https?:\/\/)?t\.me\/(?:\+|joinchat\/)/.test(chatId);
    try {
      if (isInviteLink) {
        const hash = extractInviteHash(chatId);
        if (!hash) throw new Error('no invite hash');
        // CheckChatInvite returns ChatInviteAlready (with .chat) when already a member.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inv: any = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        entity = inv?.chat ?? null;
        if (!entity) throw new Error('no chat in CheckChatInvite result');
      } else {
        entity = await client.getEntity(resolveEntityInput(chatId));
      }
    } catch {
      // Cannot resolve entity — skip upsert to avoid storing a broken chatId.
      // syncAccountGroups (30-min cycle) will pick this group up correctly.
      log.warn({ accountId, chatId }, 'checkAndLeaveIfReadOnly: entity unresolvable — skip upsert');
      return { kept: true, reason: 'entity unresolvable — skipped' };
    }

    // ── Extract basic info ────────────────────────────────────────────────
    title = entity.title ?? chatId;
    username = entity.username ? entity.username.toLowerCase() : null;
    memberCount = entity.participantsCount ?? null;

    if (entity.id) {
      const rawId = String(entity.id);
      resolvedChatId = (entity.broadcast === true || entity.megagroup === true)
        ? (rawId.startsWith('-') ? rawId : `-100${rawId}`)
        : (rawId.startsWith('-') ? rawId : `-${rawId}`);
    }

    if (entity.broadcast === true) {
      canSend = false;
      type = 'channel';
    } else if (entity.megagroup === true) {
      type = 'supergroup';
    }

    // ── Layer 1: group-wide default banned rights ─────────────────────────
    if (canSend) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peer: any = await client.getInputEntity(entity);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const full: any = await client.invoke(new Api.channels.GetFullChannel({ channel: peer }));
        if (full?.fullChat?.defaultBannedRights?.sendMessages === true) {
          canSend = false;
        }
      } catch {
        // best-effort
      }
    }

    // ── Layer 2: account individually muted / banned ──────────────────────
    // defaultBannedRights only covers group-wide restrictions.
    // A personal ban requires inspecting the account's own participant record.
    if (canSend) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peer: any = await client.getInputEntity(entity);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partResult: any = await client.invoke(
          new Api.channels.GetParticipant({ channel: peer, participant: new Api.InputUserSelf() }),
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p: any = partResult?.participant;
        if (p?.className === 'ChannelParticipantBanned' || p?.bannedRights?.sendMessages === true) {
          canSend = false;
          log.info({ accountId, chatId: resolvedChatId, title }, 'account personally muted/banned in group');
        }
      } catch {
        // non-fatal: legacy groups or GetParticipant not supported
      }
    }

    // ── Upsert with correct numeric chatId ────────────────────────────────
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
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peer: any = await client.getInputEntity(entity);
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

/**
 * Leave all READ_ONLY groups for an account in one GramJS session, then mark them LEFT.
 * Returns number of groups successfully left.
 */
export async function leaveReadOnlyGroupsBulk(accountId: string, sessionEnc: string): Promise<number> {
  const readOnly = await repo.findReadOnly(accountId);
  if (readOnly.length === 0) return 0;

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
    return 0;
  }

  let left = 0;
  try {
    for (const group of readOnly) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let peer: any;
        const isInviteLink = /(?:https?:\/\/)?t\.me\/(?:\+|joinchat\/)/.test(group.chatId);
        if (isInviteLink) {
          // Legacy broken record: chatId was stored as invite link URL.
          // Use CheckChatInvite to get the actual channel entity.
          const hash = extractInviteHash(group.chatId);
          if (!hash) throw new Error('no invite hash');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inv: any = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
          const entity = inv?.chat;
          if (!entity) throw new Error('no chat entity from CheckChatInvite');
          peer = await client.getInputEntity(entity);
        } else {
          const entityInput = group.username ?? group.chatId;
          peer = await client.getInputEntity(entityInput);
        }
        await client.invoke(new Api.channels.LeaveChannel({ channel: peer }));
        await repo.setStatus(group.id, 'LEFT', new Date());
        left++;
        log.info({ accountId, chatId: group.chatId, title: group.title }, 'bulk-left read-only group');
      } catch (err) {
        log.warn({ accountId, chatId: group.chatId, err }, 'leaveReadOnlyBulk: leave failed — non-fatal');
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)._destroyed = true;
    await client.disconnect().catch(() => undefined);
  }
  return left;
}

/** Leave a specific group manually. Handles both numeric chatIds and invite links. */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let peer: any;
    const isInviteLink = /(?:https?:\/\/)?t\.me\/(?:\+|joinchat\/)/.test(chatId);
    if (isInviteLink) {
      const hash = extractInviteHash(chatId);
      if (!hash) throw new Error('no invite hash');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv: any = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
      const entity = inv?.chat;
      if (!entity) throw new Error('CheckChatInvite returned no chat');
      peer = await client.getInputEntity(entity);
    } else {
      peer = await client.getInputEntity(resolveEntityInput(chatId));
    }
    await client.invoke(new Api.channels.LeaveChannel({ channel: peer }));
    log.info({ accountId, chatId }, 'left group');
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
  const sessions = await import('telegram/sessions/index.js');
  bundle = { Api: (tg as G).Api, TelegramClient: (tg as G).TelegramClient, StringSession: (sessions as G).StringSession };
  return bundle;
}
