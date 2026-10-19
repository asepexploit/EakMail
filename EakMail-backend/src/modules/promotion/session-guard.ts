/**
 * Detects Telegram session errors (banned, revoked, expired, frozen) and marks
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
  'INPUT_USER_DEACTIVATED',
  'PHONE_NUMBER_BANNED',
  'AuthKeyError',
  'AuthKeyDuplicatedError',
] as const;

const FROZEN_ERROR_PATTERNS = [
  'FROZEN_METHOD_INVALID',
  'FROZEN_PARTICIPANT_MISSING',
] as const;

export function isSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return SESSION_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export function isBanError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('USER_DEACTIVATED') ||
    msg.includes('USER_DEACTIVATED_BAN') ||
    msg.includes('INPUT_USER_DEACTIVATED') ||
    msg.includes('PHONE_NUMBER_BANNED')
  );
}

export function isFrozenError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return FROZEN_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Some frozen accounts return 406 PEER_ID_INVALID on sendMessage to self
 * instead of the documented FROZEN_METHOD_INVALID (420). GramJS formats
 * the error as "406: PEER_ID_INVALID (caused by messages.SendMessage)".
 */
export function isSendToSelfFrozenSignal(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = (err as any)?.code;
  return msg.includes('PEER_ID_INVALID') && (msg.includes('406') || code === 406);
}

export function isSessionOrFrozenError(err: unknown): boolean {
  return isSessionError(err) || isFrozenError(err);
}

export async function markAccountFromError(
  accountId: string,
  err: unknown,
): Promise<'BANNED' | 'DISCONNECTED' | 'FROZEN'> {
  let status: 'BANNED' | 'DISCONNECTED' | 'FROZEN';
  if (isFrozenError(err)) {
    status = 'FROZEN';
  } else if (isBanError(err)) {
    status = 'BANNED';
  } else {
    status = 'DISCONNECTED';
  }
  const msg = err instanceof Error ? err.message : String(err);

  log.warn({ accountId, error: msg, newStatus: status }, 'session invalid — marking account');

  await prisma.promotionAccount.update({
    where: { id: accountId },
    data: { status },
  });

  return status;
}
