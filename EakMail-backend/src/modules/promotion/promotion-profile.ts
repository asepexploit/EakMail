/**
 * Update a Telegram account's profile (name, bio, photo) via MTProto.
 * Uses the same lazy GramJS loader pattern as promotion-sender.ts.
 */
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { config as appConfig } from '../../config/index.js';

const log = logger.child({ module: 'promotion-profile' });

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  about?: string;
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

    // Download and upload new profile photo.
    if (input.photoUrl) {
      const res = await fetch(input.photoUrl);
      if (!res.ok) throw new Error(`Failed to download photo: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

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
