/**
 * Audit-log helper for sensitive admin actions (backend-guide.md §10).
 * Writes an AuditLog row; failures are logged but never break the request flow.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'audit' });

export interface AuditEntry {
  /** Admin user id, or null for anonymous/failed-auth actions (e.g. failed login). */
  adminUserId?: string | null;
  /** Verb.noun action name, e.g. "auth.login", "product.update". */
  action: string;
  /** Optional target identifier the action applied to. */
  target?: string | null;
  /** Optional structured context (never include secrets). */
  meta?: Prisma.InputJsonValue;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: entry.adminUserId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        meta: entry.meta,
      },
    });
  } catch (err) {
    // Auditing must not take down the request path; record and move on.
    log.error({ err, action: entry.action }, 'failed to write audit log');
  }
}
