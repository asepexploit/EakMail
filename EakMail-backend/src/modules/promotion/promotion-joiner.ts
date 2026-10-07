/**
 * Join a Telegram group/channel using a MTProto userbot (GramJS).
 * Used so promotion accounts can send messages without being manually added first.
 */
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';

const log = logger.child({ module: 'promotion-joiner' });

export interface JoinResult {
  group: string;
  ok: boolean;
  error?: string;
  alreadyMember?: boolean;
  requestSent?: boolean; // INVITE_REQUEST_SENT — pending admin approval
}

/**
 * Normalize various Telegram link/username formats to a bare username or invite hash.
 * Supported:
 *   https://t.me/username
 *   https://t.me/+InviteHash  (private invite link)
 *   t.me/username
 *   @username
 *   username
 */
export function normalizeGroupIdentifier(raw: string): { type: 'username' | 'invite'; value: string } {
  const s = raw.trim();
  // Extract path from URL-like strings
  const urlMatch = s.match(/(?:https?:\/\/)?t\.me\/([^\s?#]+)/i);
  if (urlMatch?.[1]) {
    const path = urlMatch[1];
    if (path.startsWith('+')) {
      return { type: 'invite', value: path.slice(1) }; // private invite hash
    }
    return { type: 'username', value: path };
  }
  // @username or plain username
  return { type: 'username', value: s.replace(/^@/, '') };
}

export async function joinGroups(
  sessionEnc: string,
  groups: string[],
  { delayMs }: { delayMs?: number } = {},
): Promise<JoinResult[]> {
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
    log.warn({ err }, 'joinGroups: failed to connect');
    return groups.map((g) => ({ group: g, ok: false, error: 'Connection failed' }));
  }

  const results: JoinResult[] = [];

  for (const group of groups) {
    const normalized = normalizeGroupIdentifier(group);
    try {
      if (normalized.type === 'invite') {
        await client.invoke(new Api.messages.ImportChatInvite({ hash: normalized.value }));
      } else {
        await client.invoke(new Api.channels.JoinChannel({ channel: normalized.value }));
      }
      log.info({ group, normalized }, 'joined group');
      results.push({ group, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('USER_ALREADY_PARTICIPANT') || message.includes('ALREADY')) {
        results.push({ group, ok: true, alreadyMember: true });
      } else if (message.includes('INVITE_REQUEST_SENT')) {
        // Group requires admin approval — request sent, not yet joined
        results.push({ group, ok: false, requestSent: true, error: 'Menunggu persetujuan admin' });
      } else {
        log.warn({ group, err }, 'failed to join group');
        results.push({ group, ok: false, error: friendlyJoinError(message) });
      }
    }
    // Random delay between joins to mimic human behaviour (skip when delayMs=0 for bulk-join)
    const effectiveDelay = delayMs !== undefined ? delayMs : 3000 + Math.floor(Math.random() * 5000);
    if (effectiveDelay > 0) await new Promise((r) => setTimeout(r, effectiveDelay));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._destroyed = true;
  await client.disconnect().catch(() => undefined);
  return results;
}

function friendlyJoinError(message: string): string {
  if (message.includes('INVITE_HASH_EXPIRED')) return 'Link invite sudah kadaluarsa';
  if (message.includes('INVITE_HASH_INVALID')) return 'Link invite tidak valid';
  if (message.includes('CHANNEL_PRIVATE')) return 'Grup/channel privat, butuh invite link';
  if (message.includes('FLOOD_WAIT')) return 'Flood wait — coba lagi nanti';
  if (message.includes('USERNAME_INVALID')) return 'Username tidak ditemukan';
  if (message.includes('USERNAME_NOT_OCCUPIED')) return 'Username tidak terdaftar';
  if (message.includes('CHANNELS_TOO_MUCH')) return 'Akun sudah join terlalu banyak grup';
  return message;
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
