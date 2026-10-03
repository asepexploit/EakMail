import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';
import type { PromotionCampaignDto, UpsertCampaignRequest } from '@eakmail/shared-types';

const QK = 'promotion-campaigns';

export function usePromotionCampaigns() {
  return useQuery<PromotionCampaignDto[]>({
    queryKey: [QK],
    queryFn: () => http.get('/promotion/campaigns'),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation<PromotionCampaignDto, Error, UpsertCampaignRequest>({
    mutationFn: (body) => http.post('/promotion/campaigns', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation<PromotionCampaignDto, Error, { id: string } & UpsertCampaignRequest>({
    mutationFn: ({ id, ...body }) => http.put(`/promotion/campaigns/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useSetCampaignStatus() {
  const qc = useQueryClient();
  return useMutation<PromotionCampaignDto, Error, { id: string; status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' }>({
    mutationFn: ({ id, status }) => http.patch(`/promotion/campaigns/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => http.delete(`/promotion/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

interface JoinGroupResult {
  accountId: string;
  accountLabel: string;
  group: string;
  ok: boolean;
  alreadyMember?: boolean;
  error?: string;
}

export function useJoinCampaignGroups() {
  return useMutation<{ results: JoinGroupResult[] }, Error, string>({
    mutationFn: (id) => http.post(`/promotion/campaigns/${id}/join`, {}),
  });
}
