/**
 * Broadcast business logic (customer messaging).
 *  - createAndEnqueue: snapshot the target count, create the Broadcast row in SENDING, enqueue
 *    the fan-out job, and return the DTO. The HTTP request never blocks on the actual send —
 *    the broadcast worker owns delivery.
 *  - list: broadcast history, newest first, as FE-safe DTOs.
 *
 * No HTTP objects and no Prisma queries inline — routes call this, this calls the repository
 * and the queue (backend-guide.md §2).
 */
import type { BroadcastDto } from '@eakmail/shared-types';
import { BroadcastStatus } from '@eakmail/shared-types';
import { ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { getBroadcastQueue } from './broadcast.queue.js';
import { toBroadcastDto } from './broadcast.mapper.js';
import { broadcastRepository } from './broadcast.repository.js';

const log = logger.child({ module: 'broadcast-service' });

export interface CreateBroadcastInput {
  message: string;
  imageUrl?: string | null;
  adminId: string | null;
}

export const broadcastService = {
  /**
   * Create a broadcast and enqueue its fan-out. The row starts in SENDING with a snapshot of
   * the current not-blocked customer count as totalTargets; the worker updates counters and
   * moves it to COMPLETED/FAILED when it finishes.
   */
  async createAndEnqueue(input: CreateBroadcastInput): Promise<BroadcastDto> {
    const message = input.message.trim();
    if (!message) throw new ValidationError('Broadcast message must not be empty');

    const totalTargets = await broadcastRepository.countTargets();

    const created = await broadcastRepository.create({
      message,
      imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
      status: BroadcastStatus.SENDING,
      totalTargets,
      createdBy: input.adminId,
      startedAt: new Date(),
    });

    // BullMQ v5 forbids ':' in a custom jobId; the broadcast id is already unique.
    await getBroadcastQueue().add('broadcast', { broadcastId: created.id }, { jobId: created.id });

    log.info({ broadcastId: created.id, totalTargets }, 'broadcast created and enqueued');
    return toBroadcastDto(created);
  },

  async list(): Promise<BroadcastDto[]> {
    const rows = await broadcastRepository.findAll();
    return rows.map(toBroadcastDto);
  },
};
