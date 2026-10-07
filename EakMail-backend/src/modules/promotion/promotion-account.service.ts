/**
 * Promotion account management — CRUD + MTProto login flow.
 * Reuses LoginFlow from the existing session-manager for OTP + 2FA handling.
 */
import { NotFoundError } from '../../lib/errors.js';
import { decrypt } from '../../lib/crypto.js';
import { LoginFlow } from '../../telegram/session-manager/login-flow.js';
import { promotionAccountRepository as repo } from './promotion.repository.js';
import type { PromotionAccountDto } from './promotion.types.js';
import type { PromotionAccount } from '@prisma/client';

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
};
