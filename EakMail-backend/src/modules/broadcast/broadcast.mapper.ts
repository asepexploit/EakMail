/**
 * Maps Broadcast rows to FE-safe DTOs. `createdBy` (admin id) stays server-side — the DTO
 * exposes only what the dashboard's history view renders.
 */
import type { BroadcastDto, BroadcastStatus } from '@eakmail/shared-types';
import type { Broadcast } from '@prisma/client';

export function toBroadcastDto(row: Broadcast): BroadcastDto {
  return {
    id: row.id,
    message: row.message,
    imageUrl: row.imageUrl ?? null,
    status: row.status as BroadcastStatus,
    totalTargets: row.totalTargets,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
