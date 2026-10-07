import type { Prisma, MonitoredGroupStatus } from '@prisma/client';
import { prisma } from '../../db/client.js';

export const monitoredGroupRepository = {
  findAll(accountId?: string) {
    return prisma.monitoredGroup.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { joinedAt: 'desc' },
    });
  },

  findByAccountAndChat(accountId: string, chatId: string) {
    return prisma.monitoredGroup.findUnique({ where: { accountId_chatId: { accountId, chatId } } });
  },

  upsert(accountId: string, chatId: string, data: Omit<Prisma.MonitoredGroupCreateInput, 'account'>) {
    return prisma.monitoredGroup.upsert({
      where: { accountId_chatId: { accountId, chatId } },
      create: { ...data, account: { connect: { id: accountId } }, chatId },
      update: { title: data.title, username: data.username, memberCount: data.memberCount, status: data.status, canSendMessages: data.canSendMessages, sourceLink: data.sourceLink ?? undefined },
    });
  },

  setStatus(id: string, status: MonitoredGroupStatus, leftAt?: Date) {
    return prisma.monitoredGroup.update({
      where: { id },
      data: { status, leftAt: leftAt ?? undefined },
    });
  },

  findReadOnly(accountId: string) {
    return prisma.monitoredGroup.findMany({
      where: { accountId, status: 'READ_ONLY' },
      select: { id: true, chatId: true, username: true, title: true },
    });
  },

  /** Mark a group READ_ONLY by accountId + target (numeric chatId, @username, or invite link). */
  markReadOnlyByTarget(accountId: string, target: string) {
    const where = targetWhere(accountId, target);
    return prisma.monitoredGroup.updateMany({
      where,
      data: { status: 'READ_ONLY', canSendMessages: false },
    });
  },

  /** Mark a group BANNED (account individually banned by group admin) by accountId + target. */
  markBannedByTarget(accountId: string, target: string) {
    const where = targetWhere(accountId, target);
    return prisma.monitoredGroup.updateMany({
      where,
      data: { status: 'BANNED', canSendMessages: false },
    });
  },

  /** Mark a group LEFT by accountId + target (numeric chatId, @username, or invite link). */
  markLeftByTarget(accountId: string, target: string) {
    const where = targetWhere(accountId, target);
    return prisma.monitoredGroup.updateMany({
      where,
      data: { status: 'LEFT', canSendMessages: false, leftAt: new Date() },
    });
  },

  countByAccount(accountId: string) {
    return prisma.monitoredGroup.count({ where: { accountId, status: 'ACTIVE' } });
  },

  stats(accountId: string) {
    return prisma.monitoredGroup.groupBy({
      by: ['status'],
      where: { accountId },
      _count: { id: true },
    });
  },
};

function targetWhere(accountId: string, target: string): Prisma.MonitoredGroupWhereInput {
  if (/^-\d+$/.test(target)) {
    return { accountId, chatId: target };
  }
  // Invite links (t.me/+XXX or https://t.me/+XXX) — match by sourceLink.
  if (target.includes('t.me/+') || target.includes('t.me/joinchat/')) {
    return { accountId, sourceLink: target };
  }
  return { accountId, username: target.replace(/^@/, '').toLowerCase() };
}
