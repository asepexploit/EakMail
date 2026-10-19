/**
 * Promotion account management — CRUD + MTProto login flow.
 * Reuses LoginFlow from the existing session-manager for OTP + 2FA handling.
 */
import { NotFoundError } from '../../lib/errors.js';
import { decrypt } from '../../lib/crypto.js';
import { LoginFlow } from '../../telegram/session-manager/login-flow.js';
import { promotionAccountRepository as repo } from './promotion.repository.js';
import { isSessionError, isFrozenError, isSendToSelfFrozenSignal, markAccountFromError } from './session-guard.js';
import { logger } from '../../lib/logger.js';
import type { PromotionAccountDto } from './promotion.types.js';
import type { PromotionAccount } from '@prisma/client';

const log = logger.child({ module: 'promotion-account-service' });

const loginFlow = new LoginFlow();

function toDto(a: PromotionAccount): PromotionAccountDto {
  return {
    id: a.id,
    label: a.label,
    phone: a.phone,
    status: a.status as PromotionAccountDto['status'],
    floodUntil: a.floodUntil?.toISOString() ?? null,
    lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    autoReplyEnabled: a.autoReplyEnabled,
    autoReplyMessage: a.autoReplyMessage ?? null,
  };
}

export const promotionAccountService = {
  async list(): Promise<PromotionAccountDto[]> {
    const rows = await repo.findAll();
    return rows.map(toDto);
  },

  async get(id: string): Promise<PromotionAccountDto> {
    const row = await repo.findById(id);
    if (!row) throw new NotFoundError('PromotionAccount');
    return toDto(row);
  },

  async remove(id: string): Promise<void> {
    const row = await repo.findById(id);
    if (!row) throw new NotFoundError('PromotionAccount');
    await repo.remove(id);
  },

  /** Step 1: send OTP to the phone number. Returns loginId for subsequent steps. */
  async startLogin(label: string, phone: string): Promise<{ loginId: string; accountId: string }> {
    // Upsert: if an account with this phone exists, reuse it; else create.
    let account = (await repo.findAll()).find((a) => a.phone === phone);
    if (!account) {
      account = await repo.create({ label, phone });
    } else {
      await repo.update(account.id, { label });
    }

    const loginId = `promo-${account.id}-${Date.now()}`;
    await loginFlow.start(loginId, phone);
    return { loginId, accountId: account.id };
  },

  /** Step 2: submit OTP code (+ optional 2FA password). */
  async submitCode(
    accountId: string,
    loginId: string,
    code: string,
    password?: string,
  ): Promise<{ done: boolean; needsPassword: boolean }> {
    const result = await loginFlow.submitCode(loginId, code, password);

    if (result.done && result.sessionEnc) {
      await repo.update(accountId, {
        sessionEnc: result.sessionEnc,
        status: 'CONNECTED',
      });
    }

    return { done: result.done, needsPassword: result.needsPassword };
  },

  /** Paste a pre-generated session string directly (advanced users). */
  async setSessionString(accountId: string, sessionString: string): Promise<PromotionAccountDto> {
    const { encrypt } = await import('../../lib/crypto.js');
    const row = await repo.update(accountId, {
      sessionEnc: encrypt(sessionString),
      status: 'CONNECTED',
    });
    return toDto(row);
  },

  /** Decrypt session for internal use by the sender. Never exposed via API. */
  async getSession(accountId: string): Promise<string | null> {
    const row = await repo.findById(accountId);
    if (!row?.sessionEnc) return null;
    return decrypt(row.sessionEnc);
  },

  /**
   * Check all CONNECTED accounts with a 3-step probe:
   * 1. connect()  — catches AUTH_KEY_UNREGISTERED (if not swallowed)
   * 2. getMe()    — actual RPC; catches dead sessions
   * 3. sendMessage to Saved Messages — catches frozen accounts
   *
   * Frozen accounts pass connect+getMe but fail on write operations
   * with FROZEN_METHOD_INVALID (420) or PEER_ID_INVALID (406).
   */
  async healthCheck(): Promise<{ checked: number; dead: string[] }> {
    const accounts = await repo.findAll();
    const connected = accounts.filter((a) => a.status === 'CONNECTED' && a.sessionEnc);
    const dead: string[] = [];

    await Promise.allSettled(
      connected.map(async (account) => {
        try {
          const gramjs = await loadGramjs();
          const { config } = await import('../../config/index.js');
          const sessionString = decrypt(account.sessionEnc!);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const client: any = new gramjs.TelegramClient(
            new gramjs.StringSession(sessionString),
            config.TELEGRAM_API_ID,
            config.TELEGRAM_API_HASH,
            { connectionRetries: 1, timeout: 10 },
          );
          try {
            await client.connect();
            const me = await client.getMe();

            if (me.deleted) {
              await markAccountFromError(account.id, new Error('USER_DEACTIVATED (user.deleted=true)'));
              dead.push(account.id);
              log.info({ accountId: account.id, label: account.label }, 'health-check: account deleted');
              return;
            }

            // Probe write: send+delete a message to Saved Messages
            try {
              const { Api } = await import('telegram');
              const sent = await client.invoke(new Api.messages.SendMessage({
                peer: new Api.InputPeerSelf(),
                message: '​',
                randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
              }));
              // Clean up probe message
              const msgId = sent?.updates?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (u: any) => u.className === 'UpdateMessageID',
              )?.id;
              if (msgId) {
                await client.invoke(new Api.messages.DeleteMessages({
                  id: [msgId],
                  revoke: true,
                })).catch(() => undefined);
              }
            } catch (sendErr) {
              if (isFrozenError(sendErr)) {
                await markAccountFromError(account.id, sendErr);
                dead.push(account.id);
                log.info({ accountId: account.id, label: account.label }, 'health-check: account frozen');
              } else if (isSendToSelfFrozenSignal(sendErr)) {
                // 406 PEER_ID_INVALID on sendMessage to self = frozen
                const frozenErr = new Error('FROZEN_METHOD_INVALID (detected via 406 PEER_ID_INVALID on self-send)');
                await markAccountFromError(account.id, frozenErr);
                dead.push(account.id);
                log.info({ accountId: account.id, label: account.label }, 'health-check: account frozen (406 signal)');
              } else if (isSessionError(sendErr)) {
                await markAccountFromError(account.id, sendErr);
                dead.push(account.id);
                log.info({ accountId: account.id, label: account.label }, 'health-check: session dead');
              }
            }
          } catch (err) {
            if (isSessionError(err)) {
              await markAccountFromError(account.id, err);
              dead.push(account.id);
              log.info({ accountId: account.id, label: account.label }, 'health-check: session dead');
            } else if (isFrozenError(err)) {
              await markAccountFromError(account.id, err);
              dead.push(account.id);
              log.info({ accountId: account.id, label: account.label }, 'health-check: account frozen');
            }
          } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client as any)._destroyed = true;
            await client.disconnect().catch(() => undefined);
          }
        } catch {
          // decrypt or load error — skip
        }
      }),
    );

    log.info({ checked: connected.length, dead: dead.length }, 'health-check complete');
    return { checked: connected.length, dead };
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
interface GramjsBundle { TelegramClient: G; StringSession: G }
let _gramjsBundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (_gramjsBundle) return _gramjsBundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions/index.js');
  _gramjsBundle = {
    TelegramClient: (tg as G).TelegramClient,
    StringSession: (sessions as G).StringSession,
  };
  return _gramjsBundle;
}
