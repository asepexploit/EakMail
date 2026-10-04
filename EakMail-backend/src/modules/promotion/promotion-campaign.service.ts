/**
 * Promotion campaign CRUD + scheduling logic.
 * Scheduling is driven by a BullMQ repeatable job; each campaign fires its own job.
 */
import { NotFoundError } from '../../lib/errors.js';
import { promotionCampaignRepository as repo } from './promotion.repository.js';
import { getQueues, QueueName } from '../../queue/queues.js';
import type { PromotionCampaignDto, UpsertCampaignInput } from './promotion.types.js';
import type { PromotionCampaign } from '@prisma/client';

type CampaignWithAccounts = PromotionCampaign & { accounts: { accountId: string }[] };

function toDto(c: CampaignWithAccounts): PromotionCampaignDto {
  return {
    id: c.id,
    name: c.name,
    message: c.message,
    imageUrl: c.imageUrl,
    targetGroups: c.targetGroups as string[],
    intervalMinutes: c.intervalMinutes,
    activeHoursStart: c.activeHoursStart,
    activeHoursEnd: c.activeHoursEnd,
    activeDays: c.activeDays as number[],
    delayBetweenGroupsSeconds: c.delayBetweenGroupsSeconds,
    sendMode: c.sendMode as PromotionCampaignDto['sendMode'],
    status: c.status as PromotionCampaignDto['status'],
    nextRunAt: c.nextRunAt?.toISOString() ?? null,
    accountIds: c.accounts.map((a) => a.accountId),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** BullMQ repeatable job key for a campaign. */
function jobKey(campaignId: string): string {
  return `promo-${campaignId}`;
}

async function scheduleJob(campaign: CampaignWithAccounts): Promise<void> {
  const queue = getQueues()[QueueName.PROMOTION];
  if (!queue) return;
  await queue.add(
    'run',
    { campaignId: campaign.id },
    {
      jobId: jobKey(campaign.id),
      repeat: { every: campaign.intervalMinutes * 60 * 1000 },
      removeOnComplete: 10,
      removeOnFail: 20,
    },
  );
}

async function removeJob(campaignId: string): Promise<void> {
  const queue = getQueues()[QueueName.PROMOTION];
  if (!queue) return;
  const jobs = await queue.getRepeatableJobs();
  const job = jobs.find((j) => j.key.includes(jobKey(campaignId)));
  if (job) await queue.removeRepeatableByKey(job.key);
}

export const promotionCampaignService = {
  async list(): Promise<PromotionCampaignDto[]> {
    const rows = await repo.findAll();
    return rows.map(toDto);
  },

  async get(id: string): Promise<PromotionCampaignDto> {
    const row = await repo.findById(id);
    if (!row) throw new NotFoundError('PromotionCampaign');
    return toDto(row);
  },

  async create(input: UpsertCampaignInput): Promise<PromotionCampaignDto> {
    const { accountIds, ...rest } = input;
    const campaign = await repo.create({
      ...rest,
      targetGroups: input.targetGroups,
      activeDays: input.activeDays,
      status: 'ACTIVE',
    });
    if (accountIds.length > 0) {
      await repo.setAccountLinks(campaign.id, accountIds);
    }
    const fresh = await repo.findById(campaign.id);
    await scheduleJob(fresh!);
    return toDto(fresh!);
  },

  async update(id: string, input: UpsertCampaignInput): Promise<PromotionCampaignDto> {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError('PromotionCampaign');

    const { accountIds, ...rest } = input;
    await repo.update(id, {
      ...rest,
      targetGroups: input.targetGroups,
      activeDays: input.activeDays,
    });
    await repo.setAccountLinks(id, accountIds);

    // Re-schedule if currently ACTIVE and interval changed.
    const updated = await repo.findById(id);
    if (updated?.status === 'ACTIVE') {
      await removeJob(id);
      await scheduleJob(updated);
    }

    return toDto(updated!);
  },

  async setStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'): Promise<PromotionCampaignDto> {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError('PromotionCampaign');

    await repo.update(id, { status });

    if (status === 'ACTIVE') {
      const fresh = await repo.findById(id);
      await scheduleJob(fresh!);
    } else {
      await removeJob(id);
    }

    const updated = await repo.findById(id);
    return toDto(updated!);
  },

  async remove(id: string): Promise<void> {
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError('PromotionCampaign');
    await removeJob(id);
    await repo.remove(id);
  },
};
