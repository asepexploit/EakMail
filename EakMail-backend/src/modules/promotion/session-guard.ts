/**
 * Detects Telegram session errors (banned, revoked, expired) and marks
 * the PromotionAccount status accordingly. Used by all background processes
 * that connect a GramJS client for promotion accounts.
 */
import { logger } from '../../lib/logger.js';
import { prisma } from '../../db/client.js';

const log = logger.child({ module: 'session-guard' });

const SESSION_ERROR_PATTERNS = [
  'AUTH_KEY_UNREGISTERED',
  'AuthKeyUnregisteredError',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'USER_DEACTIVATED',
  'USER_DEACTIVATED_BAN',
  'AuthKeyError',
  'AuthKeyDuplicatedError',
] as const;

export function isSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return SESSION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export function isBanError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('USER_DEACTIVATED') || msg.includes('USER_DEACTIVATED_BAN');
}

export async function markAccountFromError(accountId: string, err: unknown): Promise<'BANNED' | 'DISCONNECTED'> {
  const status = isBanError(err) ? 'BANNED' : 'DISCONNECTED';
  const msg = err instanceof Error ? err.message : String(err);

  log.warn({ accountId, error: msg, newStatus: status }, 'session invalid — marking account');

  await prisma.promotionAccount.update({
    where: { id: accountId },
    data: { status },
  });

  return status;
}
