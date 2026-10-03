import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';
import type { PromotionLogDto } from '@eakmail/shared-types';

export function usePromotionLogs(campaignId?: string) {
  return useQuery<PromotionLogDto[]>({
    queryKey: ['promotion-logs', campaignId],
    queryFn: () => http.get('/promotion/logs', { query: campaignId ? { campaignId } : undefined }),
    refetchInterval: 15_000,
  });
}
