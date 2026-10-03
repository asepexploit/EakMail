import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateBroadcastRequest } from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { featureStrings } from '@/features/shared/feature-strings';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

/** Poll interval (ms) so a SENDING broadcast's progress updates without a manual refresh. */
const HISTORY_REFETCH_INTERVAL_MS = 5_000;

/** Broadcast history, newest first. Polls so in-flight progress stays live. */
export function useBroadcasts() {
  return useQuery({
    queryKey: queryKeys.broadcast.list(),
    queryFn: ({ signal }) => api.broadcast.list(signal),
    refetchInterval: HISTORY_REFETCH_INTERVAL_MS,
  });
}

/** Queue a broadcast to all customers; invalidates history and toasts the outcome. */
export function useCreateBroadcast() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: CreateBroadcastRequest) => api.broadcast.create(body),
    onSuccess: () => {
      toast.success(featureStrings.broadcast.sent);
      void client.invalidateQueries({ queryKey: queryKeys.broadcast.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
