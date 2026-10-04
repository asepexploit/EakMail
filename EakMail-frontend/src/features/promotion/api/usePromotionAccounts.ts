import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import type { PromotionAccountDto } from '@eakmail/shared-types';

export interface TelegramGroup {
  id: string;
  username: string | null;
  title: string;
  type: 'group' | 'supergroup' | 'channel';
  memberCount: number | null;
}

const QK = 'promotion-accounts';

export function usePromotionAccounts() {
  return useQuery<PromotionAccountDto[]>({
    queryKey: [QK],
    queryFn: () => http.get('/promotion/accounts'),
  });
}

export function useStartPromotionLogin() {
  return useMutation<{ loginId: string; accountId: string }, Error, { label: string; phone: string }>({
    mutationFn: (body) => http.post('/promotion/accounts/login/start', body),
  });
}

export function useSubmitPromotionCode() {
  const qc = useQueryClient();
  return useMutation<{ done: boolean; needsPassword: boolean }, Error, { accountId: string; loginId: string; code: string; password?: string }>({
    mutationFn: (body) => http.post('/promotion/accounts/login/code', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeletePromotionAccount() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => http.delete(`/promotion/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useAccountGroups(accountId: string | null) {
  return useQuery<TelegramGroup[]>({
    queryKey: ['promotion-account-groups', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/groups`),
    enabled: !!accountId,
    staleTime: 60_000,
  });
}

export interface AccountStats {
  totalSent: number;
  totalFailed: number;
  activeGroupCount: number;
  campaignCount: number;
  lastSent: { sentAt: string; targetGroup: string; campaignName: string } | null;
}

export function useAccountStats(accountId: string) {
  return useQuery<AccountStats>({
    queryKey: ['promotion-account-stats', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/stats`),
    refetchInterval: 30_000,
  });
}

export interface JoinGroupResult {
  group: string;
  ok: boolean;
  alreadyMember?: boolean;
  error?: string;
}

export function useJoinAccountGroups(accountId: string) {
  return useMutation<{ results: JoinGroupResult[] }, Error, string[]>({
    mutationFn: (groups) => http.post(`/promotion/accounts/${accountId}/join`, { groups }),
  });
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  about?: string;
  photoUrl?: string | null;
}

export function useUpdateAccountProfile(accountId: string) {
  return useMutation<{ ok: boolean }, Error, UpdateProfileInput>({
    mutationFn: (body) => http.patch(`/promotion/accounts/${accountId}/profile`, body),
  });
}
