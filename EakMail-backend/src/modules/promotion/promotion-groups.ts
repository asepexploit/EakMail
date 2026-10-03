/**
 * Fetch all groups/channels an account is a member of via MTProto.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';

const log = logger.child({ module: 'promotion-groups' });

export interface TelegramGroup {
  id: string;         // chat_id (numeric string, negative for groups)
  username: string | null;  // @username or null
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  memberCount: number | null;
}

export async function fetchAccountGroups(sessionEnc: string): Promise<TelegramGroup[]> {
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
    log.warn({ err }, 'fetchAccountGroups: failed to connect');
    return [];
  }

  const groups: TelegramGroup[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await client.invoke(new Api.messages.GetDialogs({
      offsetDate: 0,
      offsetId: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      limit: 200,
      hash: BigInt(0),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chats: any[] = (result as any).chats ?? [];

    for (const chat of chats) {
      if (chat.left || chat.kicked || chat.deactivated) continue;

      const isSupergroup = chat.megagroup === true;
      const isChannel = chat.broadcast === true;
      const isLegacyGroup = chat.className === 'Chat';

      if (!isSupergroup && !isChannel && !isLegacyGroup) continue;

      let type: TelegramGroup['type'];
      if (isLegacyGroup) {
        type = 'group';
      } else if (isSupergroup) {
        type = 'supergroup';
      } else {
        type = 'channel';
      }

      const id = isLegacyGroup
        ? `-${chat.id}`
        : `-100${chat.id}`;

      groups.push({
        id,
        username: chat.username ?? null,
        title: chat.title ?? '',
        type,
        memberCount: chat.participantsCount ?? null,
      });
    }
  } catch (err) {
    log.warn({ err }, 'fetchAccountGroups: failed to get dialogs');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._destroyed = true;
  await client.disconnect().catch(() => undefined);

  return groups.sort((a, b) => a.title.localeCompare(b.title));
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
