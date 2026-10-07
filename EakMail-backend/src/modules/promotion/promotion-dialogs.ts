/**
 * Fetch all Telegram dialogs (groups, channels, private chats) for a promotion
 * account via MTProto. Used by the dashboard to show which groups/channels/chats
 * the account is actually a member of, directly from Telegram (not from DB).
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';

const log = logger.child({ module: 'promotion-dialogs' });

export type TelegramDialogType = 'group' | 'channel' | 'chat';

export interface TelegramDialogItem {
  id: string;
  title: string;
  username: string | null;
  type: TelegramDialogType;
  memberCount: number | null;
}

export interface TelegramDialogsResult {
  groups: TelegramDialogItem[];    // supergroups + legacy groups
  channels: TelegramDialogItem[];  // broadcast channels
  chats: TelegramDialogItem[];     // private conversations (users)
  total: number;
}

export async function fetchAllDialogs(sessionEnc: string): Promise<TelegramDialogsResult> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const { config } = await import('../../config/index.js');
  const sessionString = decrypt(sessionEnc);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new TelegramClient(
    new StringSession(sessionString),
    config.TELEGRAM_API_ID,
    config.TELEGRAM_API_HASH,
    { connectionRetries: 2 },
  );

  try {
    await client.connect();
  } catch (err) {
    log.warn({ err }, 'fetchAllDialogs: failed to connect');
    return { groups: [], channels: [], chats: [], total: 0 };
  }

  const groups: TelegramDialogItem[] = [];
  const channels: TelegramDialogItem[] = [];
  const chats: TelegramDialogItem[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.invoke(new Api.messages.GetDialogs({
      offsetDate: 0,
      offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      limit: 500,
      hash: BigInt(0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawChats: any[] = (result as any).chats ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUsers: any[] = (result as any).users ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawDialogs: any[] = (result as any).dialogs ?? [];

    const chatsMap = new Map(rawChats.map((c) => [String(c.id), c]));
    const usersMap = new Map(rawUsers.map((u) => [String(u.id), u]));

    for (const dialog of rawDialogs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const peer: any = dialog.peer;
      if (!peer) continue;

      const cls: string = peer.className ?? '';

      if (cls === 'PeerUser') {
        const user = usersMap.get(String(peer.userId));
        if (!user || user.bot || user.deleted) continue;
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || String(peer.userId);
        chats.push({
          id: String(peer.userId),
          title: name,
          username: user.username ?? null,
          type: 'chat',
          memberCount: null,
        });
      } else if (cls === 'PeerChat') {
        const chat = chatsMap.get(String(peer.chatId));
        if (!chat || chat.left || chat.kicked || chat.deactivated) continue;
        groups.push({
          id: `-${chat.id}`,
          title: chat.title ?? '',
          username: null,
          type: 'group',
          memberCount: chat.participantsCount ?? null,
        });
      } else if (cls === 'PeerChannel') {
        const chat = chatsMap.get(String(peer.channelId));
        if (!chat || chat.left || chat.kicked) continue;
        const isChannel = chat.broadcast === true;
        const item: TelegramDialogItem = {
          id: `-100${chat.id}`,
          title: chat.title ?? '',
          username: chat.username ?? null,
          type: isChannel ? 'channel' : 'group',
          memberCount: chat.participantsCount ?? null,
        };
        if (isChannel) {
          channels.push(item);
        } else {
          groups.push(item);
        }
      }
    }
  } catch (err) {
    log.warn({ err }, 'fetchAllDialogs: failed to get dialogs');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._destroyed = true;
  await client.disconnect().catch(() => undefined);

  const sortByTitle = (a: TelegramDialogItem, b: TelegramDialogItem) => a.title.localeCompare(b.title);
  groups.sort(sortByTitle);
  channels.sort(sortByTitle);
  chats.sort(sortByTitle);

  return {
    groups,
    channels,
    chats,
    total: groups.length + channels.length + chats.length,
  };
}

// ---- lazy GramJS loader -------------------------------------------------------
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
