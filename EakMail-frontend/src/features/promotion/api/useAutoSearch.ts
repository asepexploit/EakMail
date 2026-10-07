import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';

interface AutoSearchKeyword {
  id: string;
  keyword: string;
  enabled: boolean;
  createdAt: string;
}

interface QueueStats {
  pending: number;
  joining: number;
  joined: number;
  left: number;
  failed: number;
  skipped: number;
  total: number;
}

interface QueueItem {
  id: string;
  accountId: string;
  chatId: string;
  username: string | null;
  title: string;
  memberCount: number | null;
  keyword: string;
  status: string;
  error: string | null;
  enqueuedAt: string;
  processedAt: string | null;
}

export function useAutoSearchKeywords() {
  return useQuery<AutoSearchKeyword[]>({
    queryKey: ['auto-search-keywords'],
    queryFn: () => http.get('/promotion/auto-search/keywords'),
    staleTime: 60_000,
  });
}

export function useAddKeyword() {
  const qc = useQueryClient();
  return useMutation<AutoSearchKeyword, Error, string>({
    mutationFn: (keyword) => http.post('/promotion/auto-search/keywords', { keyword }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-search-keywords'] }),
  });
}

export function useRemoveKeyword() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => http.delete(`/promotion/auto-search/keywords/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-search-keywords'] }),
  });
}

export function useToggleKeyword() {
  const qc = useQueryClient();
  return useMutation<AutoSearchKeyword, Error, { id: string; enabled: boolean }>({
    mutationFn: ({ id, enabled }) => http.patch(`/promotion/auto-search/keywords/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-search-keywords'] }),
  });
}

export function useQueueStats() {
  return useQuery<QueueStats>({
    queryKey: ['auto-search-queue-stats'],
    queryFn: () => http.get('/promotion/auto-search/queue/stats'),
    refetchInterval: 15_000,
  });
}

export function useQueueItems(status?: string) {
  return useQuery<QueueItem[]>({
    queryKey: ['auto-search-queue', status],
    queryFn: () => http.get(`/promotion/auto-search/queue${status ? `?status=${status}` : ''}`),
    refetchInterval: 15_000,
  });
}

export function useClearQueue() {
  const qc = useQueryClient();
  return useMutation<{ deleted: number }, Error, string | undefined>({
    mutationFn: (status) => http.delete(`/promotion/auto-search/queue${status ? `?status=${status}` : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-search-queue'] });
      qc.invalidateQueries({ queryKey: ['auto-search-queue-stats'] });
    },
  });
}
