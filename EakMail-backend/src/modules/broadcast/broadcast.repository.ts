/**
 * Broadcast data access (Prisma only — no HTTP, no business decisions).
 * Owns create/read/update of the Broadcast row plus the target-customer lookup the worker
 * uses to fan out sends. Progress writes (counters + status) are plain updates; the worker
 * owns their cadence. ARCHITECTURE.md §11.
 */
import type { BroadcastStatus } from '@eakmail/shared-types';
import type { Broadcast } from '@prisma/client';
import { prisma } from '../../db/client.js';

export interface CreateBroadcastData {
  message: string;
  imageUrl: string | null;
  status: BroadcastStatus;
  totalTargets: number;
  createdBy: string | null;
  startedAt: Date | null;
}

/** A broadcast target: only the Telegram id is needed to send. */
export interface BroadcastTarget {
  telegramId: string;
}

export interface BroadcastProgress {
  sentCount: number;
  failedCount: number;
}

export interface BroadcastFinish {
  status: BroadcastStatus;
  sentCount: number;
  failedCount: number;
  finishedAt: Date;
}

export const broadcastRepository = {
  create(data: CreateBroadcastData): Promise<Broadcast> {
    return prisma.broadcast.create({ data });
  },

  /** History, newest first. */
  findAll(): Promise<Broadcast[]> {
    return prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string): Promise<Broadcast | null> {
    return prisma.broadcast.findUnique({ where: { id } });
  },

  /** Count the customers a broadcast would reach (all not-blocked). */
  countTargets(): Promise<number> {
    return prisma.customer.count({ where: { isBlocked: false } });
  },

  /** Every not-blocked customer's Telegram id — the fan-out target list. */
  async findTargets(): Promise<BroadcastTarget[]> {
    return prisma.customer.findMany({
      where: { isBlocked: false },
      select: { telegramId: true },
    });
  },

  /** Persist running progress (sent/failed counters). */
  async updateProgress(id: string, progress: BroadcastProgress): Promise<void> {
    await prisma.broadcast.update({ where: { id }, data: progress });
  },

  /** Terminal update: final counters + status + finishedAt. */
  async finish(id: string, finish: BroadcastFinish): Promise<void> {
    await prisma.broadcast.update({ where: { id }, data: finish });
  },
};
