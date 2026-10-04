/**
 * Promotion worker — consumes BullMQ "promotion" jobs and sends a campaign's
 * message to all target groups using the configured accounts + send mode.
 *
 * Send modes:
 *   ROUND_ROBIN  — one account per run, cycling through the account list.
 *   ALL_ACCOUNTS — every account sends to every target group this run.
 *   RANDOM       — one randomly-chosen account per run.
 *
 * Active-hour and active-day guards skip the run if outside schedule.
 * Flood-wait is recorded on the account; the account is skipped next run.
 */
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { bullConnection, QueueName, type PromotionJob } from '../queues.js';
import { promotionCampaignRepository } from '../../modules/promotion/promotion.repository.js';
import { promotionAccountRepository } from '../../modules/promotion/promotion.repository.js';
import { promotionLogRepository } from '../../modules/promotion/promotion.repository.js';
import { promotionAccountService } from '../../modules/promotion/promotion-account.service.js';
import { sendPromotionMessagesBatch } from '../../modules/promotion/promotion-sender.js';
import { monitoredGroupRepository } from '../../modules/monitor/monitor.repository.js';
import { prisma } from '../../db/client.js';
import type { WorkerBuildDeps } from './types.js';

const log = logger.child({ module: 'promotion-worker' });

// In-memory lock: prevent the same campaign from running concurrently within this process
// (concurrency:2 means two different campaigns can run side-by-side, but not the same one twice).
const runningCampaigns = new Set<string>();

export function buildPromotionWorker(deps: WorkerBuildDeps = {}): Worker<PromotionJob> {
  return new Worker<PromotionJob>(
    QueueName.PROMOTION,
    (job) => processPromotion(job),
    {
      connection: bullConnection(),
      concurrency: deps.concurrency ?? 2,
    },
  );
}

async function processPromotion(job: Job<PromotionJob>): Promise<void> {
  const { campaignId } = job.data;

  // Prevent two jobs for the same campaign from executing simultaneously
  if (runningCampaigns.has(campaignId)) {
    log.info({ campaignId }, 'campaign already running — dropping concurrent job');
    return;
  }
  runningCampaigns.add(campaignId);
  try {
    await runCampaign(job);
  } finally {
    runningCampaigns.delete(campaignId);
  }
}

async function runCampaign(job: Job<PromotionJob>): Promise<void> {
  const { campaignId } = job.data;

  const campaign = await promotionCampaignRepository.findById(campaignId);
  if (!campaign || campaign.status !== 'ACTIVE') {
    log.info({ campaignId }, 'campaign not active — skipping');
    return;
  }

  // Active-hour / active-day guard — skipped when job is a manual force-trigger
  if (!job.data.force) {
    const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
    const hour = nowWib.getUTCHours();
    const day = nowWib.getUTCDay(); // 0=Sun

    if (hour < campaign.activeHoursStart || hour > campaign.activeHoursEnd) {
      log.info({ campaignId, hour }, 'outside active hours — skipping');
      return;
    }

    const activeDays = campaign.activeDays as number[];
    if (!activeDays.includes(day)) {
      log.info({ campaignId, day }, 'outside active days — skipping');
      return;
    }
  }

  const accountIds = campaign.accounts.map((a) => a.accountId);
  if (accountIds.length === 0) {
    log.warn({ campaignId }, 'no accounts assigned — skipping');
    return;
  }

  const accounts = await promotionAccountRepository.findMany(accountIds);
  const availableAccounts = accounts.filter(
    (a) => a.status === 'CONNECTED' && (!a.floodUntil || a.floodUntil < new Date()),
  );

  if (availableAccounts.length === 0) {
    log.warn({ campaignId }, 'no available accounts (all disconnected or flood-waited)');
    return;
  }

  const targetGroups = await resolveTargetGroups(
    accountIds,
    campaign.targetGroups as string[],
  );
  if (targetGroups.length === 0) {
    log.warn({ campaignId }, 'no target groups resolved — skipping');
    return;
  }
  const sendMode = campaign.sendMode;
  const delay = campaign.delayBetweenGroupsSeconds * 1000;

  let selectedAccounts = availableAccounts;
  if (sendMode === 'ROUND_ROBIN') {
    const idx = campaign.roundRobinIndex % availableAccounts.length;
    const selected = availableAccounts[idx];
    if (selected) selectedAccounts = [selected];
    // Advance round-robin pointer
    await promotionCampaignRepository.advanceRoundRobin(
      campaignId,
      (idx + 1) % availableAccounts.length,
      new Date(Date.now() + campaign.intervalMinutes * 60 * 1000),
    );
  } else if (sendMode === 'RANDOM') {
    const idx = Math.floor(Math.random() * availableAccounts.length);
    const selected = availableAccounts[idx];
    if (selected) selectedAccounts = [selected];
  }

  for (const account of selectedAccounts) {
    const sessionString = await promotionAccountService.getSession(account.id);
    if (!sessionString) continue;

    // One connection per account run; GetDialogs is called once inside to populate
    // the entity cache so numeric chatIds (no public username) resolve correctly.
    const batchResults = await sendPromotionMessagesBatch({
      sessionEnc: account.sessionEnc!,
      targets: targetGroups,
      message: campaign.message,
      imageUrl: campaign.imageUrl,
      delayMs: delay,
      force: job.data.force,
    });

    for (const { target, result } of batchResults) {
      // Feedback loop: write-forbidden / banned groups → mark READ_ONLY so the
      // periodic leaveReadOnlyGroupsBulk auto-leaves them on next sync cycle.
      if (result.errorType === 'WRITE_FORBIDDEN' || result.errorType === 'BANNED') {
        void monitoredGroupRepository.markReadOnlyByTarget(account.id, target).catch(() => undefined);
      }

      if (result.floodWaitSeconds) {
        await promotionAccountRepository.update(account.id, {
          status: 'FLOOD_WAIT',
          floodUntil: new Date(Date.now() + result.floodWaitSeconds * 1000),
        });
        await promotionLogRepository.create({
          campaign: { connect: { id: campaignId } },
          account: { connect: { id: account.id } },
          targetGroup: target,
          status: 'FLOOD_WAIT',
          errorMessage: result.error,
        });
        break;
      }

      const logStatus = result.ok
        ? 'SENT'
        : result.errorType === 'SKIP'
          ? 'SKIPPED'
          : 'FAILED';

      const logMessage = result.ok
        ? null
        : result.errorType === 'SKIP'
          ? 'Pesan terakhir masih milik akun ini — menunggu balasan dulu'
          : (result.error ?? null);

      await promotionLogRepository.create({
        campaign: { connect: { id: campaignId } },
        account: { connect: { id: account.id } },
        targetGroup: target,
        status: logStatus,
        errorMessage: logMessage,
      });
    }
  }

  log.info({ campaignId }, 'promotion run completed');
}

/**
 * Resolve the list of groups to send to.
 * If explicit targetGroups are given, use them.
 * Otherwise, auto-resolve from MonitoredGroup rows that are ACTIVE + canSendMessages.
 */
async function resolveTargetGroups(accountIds: string[], explicit: string[]): Promise<string[]> {
  if (explicit.length > 0) return explicit;

  const rows = await prisma.monitoredGroup.findMany({
    where: {
      accountId: { in: accountIds },
      status: 'ACTIVE',
      canSendMessages: true,
    },
    select: { chatId: true, username: true },
  });

  // Deduplicate by chatId (multiple accounts may have the same group).
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    if (seen.has(row.chatId)) continue;
    seen.add(row.chatId);
    result.push(row.username ? `@${row.username}` : row.chatId);
  }
  return result;
}

