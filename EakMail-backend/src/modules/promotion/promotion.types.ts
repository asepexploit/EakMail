import type {
  PromotionAccountStatus,
  CampaignStatus,
  CampaignSendMode,
  PromotionLogStatus,
} from '@eakmail/shared-types';

export interface PromotionAccountDto {
  id: string;
  label: string;
  phone: string;
  status: PromotionAccountStatus;
  floodUntil: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  autoReplyEnabled: boolean;
  autoReplyMessage: string | null;
}

export interface PromotionCampaignDto {
  id: string;
  name: string;
  message: string;
  messages: string[];
  imageUrl: string | null;
  targetGroups: string[];
  intervalMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  delayBetweenGroupsSeconds: number;
  sendMode: CampaignSendMode;
  status: CampaignStatus;
  nextRunAt: string | null;
  accountIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromotionLogDto {
  id: string;
  campaignId: string;
  campaignName: string;
  accountId: string | null;
  accountLabel: string | null;
  targetGroup: string;
  status: PromotionLogStatus;
  errorMessage: string | null;
  sentAt: string;
}

export interface CreatePromotionAccountInput {
  label: string;
  phone: string;
}

export interface UpsertCampaignInput {
  name: string;
  message: string;
  messages?: string[];
  imageUrl?: string | null;
  targetGroups: string[];
  intervalMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  delayBetweenGroupsSeconds: number;
  sendMode: CampaignSendMode;
  accountIds: string[];
}
