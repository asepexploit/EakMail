/**
 * Polls system vitals (worker liveness, queue depth, active executions) for the
 * status bar + navbar health dot. Light polling; the WS stream covers live execution
 * detail separately.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function useSystemStatus() {
  return useQuery({
    queryKey: queryKeys.status.system,
    queryFn: ({ signal }) => api.status.get(signal),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
  });
}
