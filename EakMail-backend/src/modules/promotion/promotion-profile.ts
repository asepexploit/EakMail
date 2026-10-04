/**
 * Read and update a Telegram account's profile (name, username, bio, photo) via MTProto.
 * Uses the same lazy GramJS loader pattern as promotion-sender.ts.
 */
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { config as appConfig } from '../../config/index.js';

const log = logger.child({ module: 'promotion-profile' });

export interface TelegramProfileInfo {
  firstName: string;
  lastName: string;
  username: string | null;
  about: string | null;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  about?: string;
  username?: string;
  photoUrl?: string | null;
}

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

export async function getTelegramProfile(sessionEnc: string): Promise<TelegramProfileInfo> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const sessionString = decrypt(sessionEnc);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(sessionString),
    appConfig.TELEGRAM_API_ID,
    appConfig.TELEGRAM_API_HASH,
    { connectionRetries: 3, useWSS: false },
  );

  try {
    await client.connect();

    const me = await client.getMe();
    // Fetch bio/about from GetFullUser — not included in basic getMe().
    let about: string | null = null;
    try {
      const full = await client.invoke(new Api.users.GetFullUser({ id: 'me' }));
      about = (full as G).fullUser?.about ?? null;
    } catch {
      // Non-fatal — bio stays null if unavailable.
    }

    return {
      firstName: (me as G).firstName ?? '',
      lastName: (me as G).lastName ?? '',
      username: (me as G).username ?? null,
      about,
    };
  } finally {
    await client.disconnect();
  }
}

export async function updateTelegramProfile(sessionEnc: string, input: UpdateProfileInput): Promise<void> {
  const { TelegramClient, StringSession, Api } = await loadGramjs();
  const sessionString = decrypt(sessionEnc);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new TelegramClient(
    new StringSession(sessionString),
    appConfig.TELEGRAM_API_ID,
    appConfig.TELEGRAM_API_HASH,
    { connectionRetries: 3, useWSS: false },
  );

  try {
    await client.connect();

    // Update first name, last name, and bio.
    if (input.firstName !== undefined || input.lastName !== undefined || input.about !== undefined) {
      await client.invoke(new Api.account.UpdateProfile({
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        about: input.about ?? undefined,
      }));
      log.info({ firstName: input.firstName, about: input.about }, 'profile name/bio updated');
    }

    // Update username (pass empty string to remove).
    if (input.username !== undefined) {
      try {
        await client.invoke(new Api.account.UpdateUsername({ username: input.username }));
        log.info({ username: input.username }, 'username updated');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('USERNAME_OCCUPIED')) {
          throw new Error('Username sudah digunakan akun Telegram lain. Coba username berbeda.');
        }
        if (msg.includes('USERNAME_INVALID')) {
          throw new Error('Username tidak valid. Gunakan huruf, angka, dan underscore (min 5 karakter).');
        }
        if (msg.includes('USERNAME_NOT_MODIFIED')) {
          // Same username — not an error, skip silently.
        } else {
          throw err;
        }
      }
    }

    // Download and upload new profile photo.
    if (input.photoUrl) {
      const res = await fetch(input.photoUrl);
      if (!res.ok) throw new Error(`Failed to download photo: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { CustomFile } = await import('telegram/client/uploads.js') as any;
      const uploadedFile = await client.uploadFile({
        file: new CustomFile('photo.jpg', buf.length, '', buf),
        workers: 1,
      });

      await client.invoke(new Api.photos.UploadProfilePhoto({ file: uploadedFile }));
      log.info({ photoUrl: input.photoUrl }, 'profile photo updated');
    }
  } finally {
    await client.disconnect();
  }
}
