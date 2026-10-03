import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useToasts } from '@/features/shared/useToasts';

export function useDeadLetter() {
  return useQuery({
    queryKey: queryKeys.logs.deadLetter,
    queryFn: ({ signal }) => api.logs.deadLetter(signal),
  });
}

export function useRetryDeadLetterJob() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: ({ queue, jobId }: { queue: string; jobId: string }) =>
      api.logs.retryJob(queue, jobId),
    onSuccess: () => {
      toast.success('Job berhasil di-retry.');
      void client.invalidateQueries({ queryKey: queryKeys.logs.deadLetter });
    },
    onError: () => toast.error('Gagal retry job.'),
  });
}

export function useAuditLog(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.logs.audit({ page, pageSize }),
    queryFn: ({ signal }) => api.logs.audit({ page, pageSize }, signal),
  });
}
