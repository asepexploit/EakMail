/**
 * Promotion system HTTP routes — accounts, campaigns, logs.
 * Registered under /api/promotion.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { promotionAccountService } from '../../modules/promotion/promotion-account.service.js';
import { promotionCampaignService } from '../../modules/promotion/promotion-campaign.service.js';
import { promotionLogRepository, promotionCampaignRepository, promotionAccountRepository } from '../../modules/promotion/promotion.repository.js';
import { prisma } from '../../db/client.js';
import { joinGroups } from '../../modules/promotion/promotion-joiner.js';
import { fetchAccountGroups } from '../../modules/promotion/promotion-groups.js';
import { startMonitor, stopMonitor, isMonitorRunning } from '../../modules/promotion/auto-join-monitor.js';
import { checkAndLeaveIfReadOnly } from '../../modules/monitor/monitor-groups.service.js';

const idParam = z.object({ id: z.string().min(1) });

const startLoginSchema = z.object({
  label: z.string().min(1).max(80),
  phone: z.string().min(6).max(20).regex(/^\+?[0-9]+$/),
});

const submitCodeSchema = z.object({
  accountId: z.string().min(1),
  loginId: z.string().min(1),
  code: z.string().min(3).max(10),
  password: z.string().optional(),
});

const sessionStringSchema = z.object({
  sessionString: z.string().min(10),
});

const campaignSchema = z.object({
  name: z.string().min(1).max(120),
  message: z.string().min(1),
  imageUrl: z.string().url().nullable().optional(),
  targetGroups: z.array(z.string().min(1)).min(0),
  intervalMinutes: z.number().int().min(1).max(10080),
  activeHoursStart: z.number().int().min(0).max(23),
  activeHoursEnd: z.number().int().min(0).max(23),
  activeDays: z.array(z.number().int().min(0).max(6)).min(1),
  delayBetweenGroupsSeconds: z.number().int().min(0).max(300),
  sendMode: z.enum(['ROUND_ROBIN', 'ALL_ACCOUNTS', 'RANDOM']),
  accountIds: z.array(z.string()).min(1),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
});

export async function promotionRoutes(app: FastifyInstance): Promise<void> {
  // ── Promotion Accounts ────────────────────────────────────────────────────

  app.get('/accounts', async () => promotionAccountService.list());

  app.get('/accounts/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return promotionAccountService.get(id);
  });

  app.post('/accounts/login/start', async (req) => {
    const body = startLoginSchema.parse(req.body);
    return promotionAccountService.startLogin(body.label, body.phone);
  });

  app.post('/accounts/login/code', async (req) => {
    const body = submitCodeSchema.parse(req.body);
    return promotionAccountService.submitCode(
      body.accountId,
      body.loginId,
      body.code,
      body.password,
    );
  });

  app.post('/accounts/:id/session', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = sessionStringSchema.parse(req.body);
    return promotionAccountService.setSessionString(id, body.sessionString);
  });

  app.delete('/accounts/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    await promotionAccountService.remove(id);
    return { ok: true };
  });

  app.get('/accounts/:id/stats', async (req) => {
    const { id } = idParam.parse(req.params);
    const account = await promotionAccountRepository.findById(id);
    if (!account) { const e = new Error('Account not found'); (e as any).statusCode = 404; throw e; }

    const [statRows, lastSent, activeGroupCount, campaignCount] = await Promise.all([
      promotionLogRepository.statsByAccount(id),
      promotionLogRepository.lastSentByAccount(id),
      prisma.monitoredGroup.count({ where: { accountId: id, status: 'ACTIVE', canSendMessages: true } }),
      prisma.campaignAccount.count({ where: { accountId: id } }),
    ]);

    const totalSent = statRows.find((r) => r.status === 'SENT')?._count.id ?? 0;
    const totalFailed = statRows.find((r) => r.status === 'FAILED')?._count.id ?? 0;

    return {
      totalSent,
      totalFailed,
      activeGroupCount,
      campaignCount,
      lastSent: lastSent
        ? {
            sentAt: lastSent.sentAt.toISOString(),
            targetGroup: lastSent.targetGroup,
            campaignName: lastSent.campaign.name,
          }
        : null,
    };
  });

  // ── Auto-join monitor settings & logs ────────────────────────────────────

  const autoJoinSettingsSchema = z.object({
    autoJoinEnabled: z.boolean(),
    autoJoinMaxPerHour: z.number().int().min(1).max(50),
  });

  app.patch('/accounts/:id/auto-join', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = autoJoinSettingsSchema.parse(req.body);
    const account = await promotionAccountRepository.update(id, body);
    if (body.autoJoinEnabled) {
      await startMonitor(id);
    } else {
      stopMonitor(id);
    }
    return {
      id: account.id,
      autoJoinEnabled: account.autoJoinEnabled,
      autoJoinMaxPerHour: account.autoJoinMaxPerHour,
      monitorRunning: isMonitorRunning(id),
    };
  });

  app.get('/accounts/:id/auto-join/status', async (req) => {
    const { id } = idParam.parse(req.params);
    const account = await promotionAccountRepository.findById(id);
    if (!account) { const e = new Error('Account not found'); (e as any).statusCode = 404; throw e; }
    return {
      autoJoinEnabled: account.autoJoinEnabled,
      autoJoinMaxPerHour: account.autoJoinMaxPerHour,
      monitorRunning: isMonitorRunning(id),
    };
  });

  app.get('/accounts/:id/auto-join/logs', async (req) => {
    const { id } = idParam.parse(req.params);
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    const rows = await prisma.autoJoinLog.findMany({
      where: { accountId: id },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      sourceGroup: r.sourceGroup,
      targetGroup: r.targetGroup,
      rawLink: r.rawLink,
      ok: r.ok,
      alreadyMember: r.alreadyMember,
      error: r.error,
      joinedAt: r.joinedAt.toISOString(),
    }));
  });

  app.post('/accounts/:id/join', async (req) => {
    const { id } = idParam.parse(req.params);
    const { groups } = z.object({ groups: z.array(z.string().min(1)).min(1) }).parse(req.body);
    const account = await promotionAccountRepository.findById(id);
    if (!account) { const e = new Error('Account not found'); (e as any).statusCode = 404; throw e; }
    if (!account.sessionEnc) { const e = new Error('Account has no active session'); (e as any).statusCode = 400; throw e; }
    const results = await joinGroups(account.sessionEnc, groups);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const grp = groups[i];
      if (r?.ok && grp && account.sessionEnc) {
        void checkAndLeaveIfReadOnly(id, account.sessionEnc, grp, grp).catch(() => undefined);
      }
    }

    return { results };
  });

  app.get('/accounts/:id/groups', async (req) => {
    const { id } = idParam.parse(req.params);
    const account = await promotionAccountRepository.findById(id);
    if (!account) { const e = new Error('Account not found'); (e as any).statusCode = 404; throw e; }
    if (!account.sessionEnc) { const e = new Error('Account has no active session'); (e as any).statusCode = 400; throw e; }
    return fetchAccountGroups(account.sessionEnc);
  });

  // ── Campaigns ─────────────────────────────────────────────────────────────

  app.get('/campaigns', async () => promotionCampaignService.list());

  app.get('/campaigns/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    return promotionCampaignService.get(id);
  });

  app.post('/campaigns', async (req) => {
    const body = campaignSchema.parse(req.body);
    return promotionCampaignService.create(body);
  });

  app.put('/campaigns/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = campaignSchema.parse(req.body);
    return promotionCampaignService.update(id, body);
  });

  app.patch('/campaigns/:id/status', async (req) => {
    const { id } = idParam.parse(req.params);
    const { status } = statusSchema.parse(req.body);
    return promotionCampaignService.setStatus(id, status);
  });

  app.delete('/campaigns/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    await promotionCampaignService.remove(id);
    return { ok: true };
  });

  // ── Manual trigger ────────────────────────────────────────────────────────

  app.post('/campaigns/:id/trigger', async (req) => {
    const { id } = idParam.parse(req.params);
    const campaign = await promotionCampaignRepository.findById(id);
    if (!campaign) { const e = new Error('Campaign not found'); (e as any).statusCode = 404; throw e; }
    const { getQueues, QueueName } = await import('../../queue/queues.js');
    await getQueues()[QueueName.PROMOTION].add(
      'run',
      { campaignId: id, force: true },
      { jobId: `promo-trigger-${id}-${Date.now()}`, removeOnComplete: 5, removeOnFail: 5 },
    );
    return { ok: true };
  });

  // ── Auto-Join Groups ─────────────────────────────────────────────────────

  app.post('/campaigns/:id/join', async (req) => {
    const { id } = idParam.parse(req.params);
    const campaign = await promotionCampaignRepository.findById(id);
    if (!campaign) { const e = new Error('Campaign not found'); (e as any).statusCode = 404; throw e; }

    const accountIds: string[] = campaign.accounts.map((ca: { accountId: string }) => ca.accountId);
    const allResults: Array<{ accountId: string; accountLabel: string; group: string; ok: boolean; alreadyMember?: boolean; error?: string }> = [];
    const targetGroups: string[] = Array.isArray(campaign.targetGroups) ? campaign.targetGroups as string[] : [];

    for (const accountId of accountIds) {
      const account = await promotionAccountRepository.findById(accountId);
      if (!account?.sessionEnc) {
        allResults.push(...targetGroups.map((g: string) => ({
          accountId,
          accountLabel: account?.label ?? accountId,
          group: g,
          ok: false,
          error: 'No session',
        })));
        continue;
      }
      const results = await joinGroups(account.sessionEnc, targetGroups);
      allResults.push(...results.map((r) => ({
        accountId,
        accountLabel: account.label,
        ...r,
      })));
    }

    return { results: allResults };
  });

  // ── Promotion Logs ────────────────────────────────────────────────────────

  app.get('/logs', async (req) => {
    const query = z.object({ campaignId: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }).parse(req.query);
    const rows = query.campaignId
      ? await promotionLogRepository.findByCampaign(query.campaignId, query.limit)
      : await promotionLogRepository.findAll(query.limit);

    return rows.map((r) => ({
      id: r.id,
      campaignId: r.campaignId,
      campaignName: r.campaign.name,
      accountId: r.accountId,
      accountLabel: r.account?.label ?? null,
      targetGroup: r.targetGroup,
      status: r.status,
      errorMessage: r.errorMessage,
      sentAt: r.sentAt.toISOString(),
    }));
  });
}
