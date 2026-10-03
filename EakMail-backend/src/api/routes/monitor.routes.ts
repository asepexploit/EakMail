/**
 * Monitor system routes — accounts, groups, activity log.
 * Registered under /api/monitor.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/client.js';
import { promotionAccountRepository } from '../../modules/promotion/promotion.repository.js';
import { monitoredGroupRepository } from '../../modules/monitor/monitor.repository.js';
import { syncAccountGroups, leaveGroup } from '../../modules/monitor/monitor-groups.service.js';
import { startMonitor, stopMonitor, isMonitorRunning, setMessageLogEnabled } from '../../modules/promotion/auto-join-monitor.js';
import type { MonitoredGroupStatus } from '@prisma/client';

const idParam = z.object({ id: z.string().min(1) });

export async function monitorRoutes(app: FastifyInstance): Promise<void> {

  // ── Accounts overview ────────────────────────────────────────────────────

  app.get('/accounts', async () => {
    const accounts = await promotionAccountRepository.findAll();
    return Promise.all(accounts.map(async (a) => {
      const statsRows = await monitoredGroupRepository.stats(a.id);
      const active  = statsRows.find((r) => r.status === 'ACTIVE')?._count.id ?? 0;
      const readOnly = statsRows.find((r) => r.status === 'READ_ONLY')?._count.id ?? 0;
      const left    = statsRows.find((r) => r.status === 'LEFT')?._count.id ?? 0;

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayJoins = await prisma.autoJoinLog.count({
        where: { accountId: a.id, joinedAt: { gte: todayStart } },
      });
      const queuePending = await prisma.autoJoinQueue.count({
        where: { accountId: a.id, status: { in: ['PENDING', 'PROCESSING'] } },
      });

      return {
        id: a.id,
        label: a.label,
        phone: a.phone,
        status: a.status,
        autoJoinEnabled: a.autoJoinEnabled,
        autoJoinMaxPerHour: a.autoJoinMaxPerHour,
        messageLogEnabled: a.messageLogEnabled,
        monitorRunning: isMonitorRunning(a.id),
        groupStats: { active, readOnly, left, todayJoins },
        queuePending,
      };
    }));
  });

  app.patch('/accounts/:id/monitor', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      autoJoinEnabled: z.boolean().optional(),
      autoJoinMaxPerHour: z.number().int().min(1).max(50).optional(),
      messageLogEnabled: z.boolean().optional(),
    }).parse(req.body);
    await promotionAccountRepository.update(id, body);
    if (body.autoJoinEnabled === true) {
      await startMonitor(id);
    } else if (body.autoJoinEnabled === false) {
      stopMonitor(id);
    }
    if (body.messageLogEnabled !== undefined) {
      setMessageLogEnabled(id, body.messageLogEnabled);
    }
    return { id, ...body, monitorRunning: isMonitorRunning(id) };
  });

  app.post('/accounts/:id/sync', async (req) => {
    const { id } = idParam.parse(req.params);
    const account = await promotionAccountRepository.findById(id);
    if (!account) { const e = new Error('Account not found'); (e as any).statusCode = 404; throw e; }
    if (!account.sessionEnc) { const e = new Error('No session'); (e as any).statusCode = 400; throw e; }
    await syncAccountGroups(id, account.sessionEnc);
    const count = await monitoredGroupRepository.countByAccount(id);
    return { ok: true, activeGroups: count };
  });

  // ── Groups ───────────────────────────────────────────────────────────────

  app.get('/groups', async (req) => {
    const { accountId, status } = z.object({
      accountId: z.string().optional(),
      status: z.string().optional(),
    }).parse(req.query);

    const rows = await prisma.monitoredGroup.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        ...(status ? { status: status as MonitoredGroupStatus } : {}),
      },
      include: { account: { select: { label: true, phone: true } } },
      orderBy: { joinedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      accountLabel: r.account.label,
      accountPhone: r.account.phone,
      chatId: r.chatId,
      username: r.username,
      title: r.title,
      type: r.type,
      memberCount: r.memberCount,
      canSendMessages: r.canSendMessages,
      status: r.status,
      messageCount: r.messageCount,
      joinedAt: r.joinedAt.toISOString(),
      leftAt: r.leftAt?.toISOString() ?? null,
      sourceLink: r.sourceLink,
    }));
  });

  app.post('/groups/:id/leave', async (req) => {
    const { id } = idParam.parse(req.params);
    const group = await prisma.monitoredGroup.findUnique({
      where: { id },
      include: { account: { select: { sessionEnc: true } } },
    });
    if (!group) { const e = new Error('Group not found'); (e as any).statusCode = 404; throw e; }
    if (group.status === 'LEFT') return { ok: true, alreadyLeft: true };
    if (!group.account.sessionEnc) { const e = new Error('No session'); (e as any).statusCode = 400; throw e; }

    await leaveGroup(group.accountId, group.account.sessionEnc, group.chatId);
    await monitoredGroupRepository.setStatus(id, 'LEFT', new Date());
    return { ok: true };
  });

  // Bulk leave all READ_ONLY groups for an account
  app.post('/accounts/:id/leave-readonly', async (req) => {
    const { id } = idParam.parse(req.params);
    const account = await promotionAccountRepository.findById(id);
    if (!account?.sessionEnc) { const e = new Error('No session'); (e as any).statusCode = 400; throw e; }

    const readOnly = await prisma.monitoredGroup.findMany({
      where: { accountId: id, status: 'READ_ONLY' },
    });

    const results: Array<{ chatId: string; title: string; ok: boolean; error?: string }> = [];
    for (const g of readOnly) {
      try {
        await leaveGroup(id, account.sessionEnc, g.chatId);
        await monitoredGroupRepository.setStatus(g.id, 'LEFT', new Date());
        results.push({ chatId: g.chatId, title: g.title, ok: true });
      } catch (err) {
        results.push({ chatId: g.chatId, title: g.title, ok: false, error: String(err) });
      }
    }
    return { results };
  });

  // ── Message log ──────────────────────────────────────────────────────────

  app.get('/messages', async (req) => {
    const { accountId, chatId, onlyLinks, limit } = z.object({
      accountId: z.string().optional(),
      chatId: z.string().optional(),
      onlyLinks: z.coerce.boolean().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(100),
    }).parse(req.query);

    const rows = await prisma.monitorMessage.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        ...(chatId ? { chatId } : {}),
        ...(onlyLinks ? { hasLink: true } : {}),
      },
      include: { account: { select: { label: true } } },
      orderBy: { ts: 'desc' },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      accountLabel: r.account.label,
      chatId: r.chatId,
      chatTitle: r.chatTitle,
      senderId: r.senderId,
      senderName: r.senderName,
      text: r.text,
      hasLink: r.hasLink,
      ts: r.ts.toISOString(),
    }));
  });

  // ── Queue status ─────────────────────────────────────────────────────────

  app.get('/queue', async (req) => {
    const { accountId, limit } = z.object({
      accountId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }).parse(req.query);

    const rows = await prisma.autoJoinQueue.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      include: { account: { select: { label: true } } },
      orderBy: { enqueuedAt: 'asc' },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      accountLabel: r.account.label,
      rawLink: r.rawLink,
      sourceGroup: r.sourceGroup,
      status: r.status,
      enqueuedAt: r.enqueuedAt.toISOString(),
    }));
  });

  // ── Activity log ─────────────────────────────────────────────────────────

  app.get('/activity', async (req) => {
    const { accountId, limit } = z.object({
      accountId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }).parse(req.query);

    const rows = await prisma.autoJoinLog.findMany({
      where: accountId ? { accountId } : undefined,
      include: { account: { select: { label: true } } },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      accountLabel: r.account?.label ?? null,
      sourceGroup: r.sourceGroup,
      targetGroup: r.targetGroup,
      rawLink: r.rawLink,
      ok: r.ok,
      alreadyMember: r.alreadyMember,
      error: r.error,
      joinedAt: r.joinedAt.toISOString(),
    }));
  });
}
