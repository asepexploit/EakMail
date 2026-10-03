/**
 * MTProto login lifecycle (phone -> code -> optional 2FA password).
 * ARCHITECTURE.md §4.2, TASKS Phase 3b.
 *
 * GramJS's `client.start()` is callback-driven, which does not fit a stateless
 * multi-request HTTP login. Instead we drive the low-level auth API step by step
 * and keep a short-lived pending-login registry keyed by an opaque loginId.
 *
 * The result of a completed login is an encrypted session string; the account
 * service persists it. Nothing here touches the database or HTTP.
 *
 * When config.USE_MOCKS is true (or API creds are missing) this module is never
 * exercised live — the factory returns the mock manager instead. It still
 * compiles because the GramJS imports are types-only at module scope and the
 * client is created lazily inside the flow.
 */
import { config } from '../../config/index.js';
import { encrypt, maskPhone } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'telegram-login' });

/** How long a half-finished login may sit before we discard it. */
const LOGIN_TTL_MS = 5 * 60 * 1000;

export interface StartResult {
  loginId: string;
  /** Telegram sent a code; the next step is submitCode. */
  needsPassword: false;
}

export interface CompletionResult {
  needsPassword: boolean;
  done: boolean;
  /** Encrypted MTProto session string, present only when done === true. */
  sessionEnc?: string;
}

interface PendingLogin {
  phone: string;
  phoneCodeHash: string;
  /** GramJS TelegramClient instance (typed as unknown to keep imports lazy). */
  client: TelegramClientLike;
  createdAt: number;
  /** True once SignIn returned SESSION_PASSWORD_NEEDED — next call skips SignIn. */
  awaitingPassword: boolean;
}

/** Minimal structural type for the GramJS client bits we use (keeps typing honest). */
interface TelegramClientLike {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  invoke(request: unknown): Promise<unknown>;
  session: { save(): string };
}

/**
 * Stateful driver for the login handshake. One instance is shared by the
 * account service via the gramjs session manager.
 */
export class LoginFlow {
  private readonly pending = new Map<string, PendingLogin>();

  /** Begin a login: connect, send the phone number, ask Telegram to send a code. */
  async start(loginId: string, phone: string): Promise<StartResult> {
    this.evictExpired();
    const { Api, TelegramClient, StringSession } = await loadGramjs();

    const client = new TelegramClient(
      new StringSession(''),
      config.TELEGRAM_API_ID,
      config.TELEGRAM_API_HASH,
      { connectionRetries: 3 },
    ) as unknown as TelegramClientLike;

    await client.connect();

    const sent = (await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: config.TELEGRAM_API_ID,
        apiHash: config.TELEGRAM_API_HASH,
        settings: new Api.CodeSettings({}),
      }),
    )) as { phoneCodeHash: string };

    this.pending.set(loginId, {
      phone,
      phoneCodeHash: sent.phoneCodeHash,
      client,
      createdAt: Date.now(),
      awaitingPassword: false,
    });

    log.info({ loginId, phone: maskPhone(phone) }, 'login code requested');
    return { loginId, needsPassword: false };
  }

  /**
   * Submit the SMS/app code (and optional 2FA password). Returns whether a
   * password is still required, and the encrypted session on completion.
   */
  async submitCode(loginId: string, code: string, password?: string): Promise<CompletionResult> {
    const entry = this.pending.get(loginId);
    if (!entry) {
      throw new Error('Unknown or expired loginId');
    }

    // Already past SignIn (SESSION_PASSWORD_NEEDED received) — go straight to 2FA.
    if (entry.awaitingPassword) {
      if (!password) {
        return { needsPassword: true, done: false };
      }
      try {
        await this.signInWithPassword(entry, password);
        return await this.finish(loginId, entry);
      } catch (err) {
        // Wrong password — stay in awaitingPassword state so user can retry.
        throw err;
      }
    }

    const { Api } = await loadGramjs();

    try {
      await entry.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: entry.phone,
          phoneCodeHash: entry.phoneCodeHash,
          phoneCode: code,
        }),
      );
      return await this.finish(loginId, entry);
    } catch (error) {
      if (isPasswordRequired(error)) {
        entry.awaitingPassword = true;
        if (!password) {
          log.info({ loginId }, '2FA password required');
          return { needsPassword: true, done: false };
        }
        await this.signInWithPassword(entry, password);
        return await this.finish(loginId, entry);
      }
      await this.abort(loginId);
      throw error;
    }
  }

  /** Complete the SRP 2FA exchange with the account password. */
  private async signInWithPassword(entry: PendingLogin, password: string): Promise<void> {
    const { Api, computeCheck } = await loadGramjs();
    const pwd = await entry.client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(pwd, password);
    await entry.client.invoke(new Api.auth.CheckPassword({ password: check }));
  }

  /** Save + encrypt the session, tear down the pending entry. */
  private async finish(loginId: string, entry: PendingLogin): Promise<CompletionResult> {
    const sessionString = entry.client.session.save();
    const sessionEnc = encrypt(sessionString);
    await entry.client.disconnect().catch(() => undefined);
    this.pending.delete(loginId);
    log.info({ loginId }, 'login completed, session encrypted');
    return { needsPassword: false, done: true, sessionEnc };
  }

  /** Discard a pending login and disconnect its client. */
  async abort(loginId: string): Promise<void> {
    const entry = this.pending.get(loginId);
    if (!entry) return;
    await entry.client.disconnect().catch(() => undefined);
    this.pending.delete(loginId);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.pending) {
      if (now - entry.createdAt > LOGIN_TTL_MS) {
        void entry.client.disconnect().catch(() => undefined);
        this.pending.delete(id);
      }
    }
  }
}

function isPasswordRequired(error: unknown): boolean {
  const message =
    (error as { errorMessage?: string })?.errorMessage ??
    (error instanceof Error ? error.message : '');
  return message.includes('SESSION_PASSWORD_NEEDED');
}

// ---- Lazy GramJS loader ------------------------------------------------------
// Imported dynamically so the module graph compiles and boots even when the
// 'telegram' package is unused (USE_MOCKS=true). The shapes are what GramJS
// exports; kept as a typed bundle for the callers above.

interface GramjsBundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GramJS Api namespace is dynamic
  Api: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- constructor from GramJS
  TelegramClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- constructor from GramJS
  StringSession: any;
  computeCheck: (pwd: unknown, password: string) => Promise<unknown>;
}

let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  const password = await import('telegram/Password.js');
  bundle = {
    Api: (tg as { Api: unknown }).Api,
    TelegramClient: (tg as { TelegramClient: unknown }).TelegramClient,
    StringSession: (sessions as { StringSession: unknown }).StringSession,
    computeCheck: (password as { computeCheck: GramjsBundle['computeCheck'] }).computeCheck,
  } as GramjsBundle;
  return bundle;
}
