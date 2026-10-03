/**
 * Telegram account business logic (ARCHITECTURE.md §4.2, TASKS Phase 3b).
 * Owns the multi-step login (start -> submit code -> optional 2FA), persistence
 * of the encrypted session, and listing/status. Never touches HTTP; returns
 * plain DTOs with the phone masked and sessionEnc withheld.
 */
import { randomUUID } from 'node:crypto';
import { AccountStatus } from '@eakmail/shared-types';
import type { LoginStepResponse, TelegramAccountDto } from '@eakmail/shared-types';
import type { TelegramAccount } from '@prisma/client';
import { maskPhone } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { accountRepository } from './account.repository.js';
import { getLoginDriver } from './login-driver.js';

const log = logger.child({ module: 'account-service' });

/** How long a half-finished login may sit before it is discarded. */
const LOGIN_TTL_MS = 5 * 60 * 1000;

interface PendingLogin {
  label: string;
  phone: string;
  createdAt: number;
}

export class AccountService {
  private readonly pending = new Map<string, PendingLogin>();

  async list(): Promise<TelegramAccountDto[]> {
    const accounts = await accountRepository.list();
    return accounts.map(toDto);
  }

  async status(id: string): Promise<TelegramAccountDto> {
    const account = await accountRepository.findById(id);
    if (!account) throw new NotFoundError('Account');
    return toDto(account);
  }

  async remove(id: string): Promise<void> {
    const account = await accountRepository.findById(id);
    if (!account) throw new NotFoundError('Account');
    await accountRepository.delete(id);
    log.info({ accountId: id }, 'account deleted');
  }

  /** Step 1: request a login code for a phone number. */
  async startLogin(label: string, phone: string): Promise<LoginStepResponse> {
    this.evictExpired();
    const loginId = randomUUID();
    this.pending.set(loginId, { label, phone, createdAt: Date.now() });

    await getLoginDriver().start(loginId, phone);
    log.info({ loginId, phone: maskPhone(phone) }, 'login started');
    return { loginId, needsPassword: false, done: false };
  }

  /** Step 2: submit the code (and 2FA password if required); persist on success. */
  async submitCode(loginId: string, code: string, password?: string): Promise<LoginStepResponse> {
    const entry = this.pending.get(loginId);
    if (!entry) throw new ValidationError('Unknown or expired login session');

    const result = await getLoginDriver().submitCode(loginId, code, password);

    if (result.needsPassword) {
      return { loginId, needsPassword: true, done: false };
    }
    if (!result.done || !result.sessionEnc) {
      throw new ValidationError('Login did not complete');
    }

    const account = await accountRepository.create({
      label: entry.label,
      phone: entry.phone,
      sessionEnc: result.sessionEnc,
      status: AccountStatus.CONNECTED,
    });
    this.pending.delete(loginId);
    log.info({ accountId: account.id }, 'account connected and session stored');

    return { loginId, needsPassword: false, done: true, account: toDto(account) };
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.pending) {
      if (now - entry.createdAt > LOGIN_TTL_MS) this.pending.delete(id);
    }
  }
}

/** Map a persisted account to its wire DTO — never leaks sessionEnc or full phone. */
function toDto(account: TelegramAccount): TelegramAccountDto {
  return {
    id: account.id,
    label: account.label,
    phoneMasked: maskPhone(account.phone),
    status: account.status as AccountStatus,
    lastActivityAt: account.lastActivityAt ? account.lastActivityAt.toISOString() : null,
  };
}

export const accountService = new AccountService();
