import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/client.js';

export const promotionAccountRepository = {
  findAll() {
    return prisma.promotionAccount.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string) {
    return prisma.promotionAccount.findUnique({ where: { id } });
  },

  findMany(ids: string[]) {
    return prisma.promotionAccount.findMany({ where: { id: { in: ids } } });
  },

  create(data: Prisma.PromotionAccountCreateInput) {
    return prisma.promotionAccount.create({ data });
  },

  update(id: string, data: Prisma.PromotionAccountUpdateInput) {
    return prisma.promotionAccount.update({ where: { id }, data });
  },

  remove(id: string) {
    return prisma.promotionAccount.delete({ where: { id } });
  },
};

export const promotionCampaignRepository = {
  findAll() {
    return prisma.promotionCampaign.findMany({
      include: { accounts: { select: { accountId: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string) {
    return prisma.promotionCampaign.findUnique({
      where: { id },
      include: { accounts: { select: { accountId: true } } },
    });
  },

  findActive() {
    return prisma.promotionCampaign.findMany({
      where: { status: 'ACTIVE' },
      include: { accounts: { select: { accountId: true } } },
    });
  },

  create(data: Prisma.PromotionCampaignCreateInput) {
    return prisma.promotionCampaign.create({
      data,
      include: { accounts: { select: { accountId: true } } },
    });
  },

  update(id: string, data: Prisma.PromotionCampaignUpdateInput) {
    return prisma.promotionCampaign.update({
      where: { id },
      data,
      include: { accounts: { select: { accountId: true } } },
    });
  },

  remove(id: string) {
    return prisma.promotionCampaign.delete({ where: { id } });
  },

  setAccountLinks(campaignId: string, accountIds: string[]) {
    return prisma.$transaction([
      prisma.campaignAccount.deleteMany({ where: { campaignId } }),
      prisma.campaignAccount.createMany({
        data: accountIds.map((accountId) => ({ campaignId, accountId })),
      }),
    ]);
  },

  advanceRoundRobin(id: string, newIndex: number, nextRunAt: Date) {
    return prisma.promotionCampaign.update({
      where: { id },
      data: { roundRobinIndex: newIndex, nextRunAt },
    });
  },
};

export const promotionLogRepository = {
  findByCampaign(campaignId: string, limit = 100) {
    return prisma.promotionLog.findMany({
      where: { campaignId },
      include: {
        campaign: { select: { name: true } },
        account: { select: { label: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
  },

  findAll(limit = 200) {
    return prisma.promotionLog.findMany({
      include: {
        campaign: { select: { name: true } },
        account: { select: { label: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit,
    });
  },

  create(data: Prisma.PromotionLogCreateInput) {
    return prisma.promotionLog.create({ data });
  },

  statsByAccount(accountId: string) {
    return prisma.promotionLog.groupBy({
      by: ['status'],
      where: { accountId },
      _count: { id: true },
    });
  },

  lastSentByAccount(accountId: string) {
    return prisma.promotionLog.findFirst({
      where: { accountId },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true, targetGroup: true, campaign: { select: { name: true } } },
    });
  },

  distinctGroupsByAccount(accountId: string) {
    return prisma.promotionLog.findMany({
      where: { accountId, status: 'SENT' },
      distinct: ['targetGroup'],
      select: { targetGroup: true },
    });
  },
};
