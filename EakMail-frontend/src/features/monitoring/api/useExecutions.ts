import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExecutionCommand, RunTestRequest } from '@eakmail/shared-types';
import { api, type ExecutionListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useExecutions(query?: ExecutionListQuery) {
  return useQuery({
    queryKey: queryKeys.executions.list(query),
    queryFn: ({ signal }) => api.executions.list(query, signal),
    // Active-execution list should stay fresh even without WS events.
    refetchInterval: 5_000,
  });
}

export function useExecution(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.executions.detail(id) : queryKeys.executions.detail('none'),
    queryFn: ({ signal }) => api.executions.get(id as string, signal),
    enabled: Boolean(id),
  });
}

/**
 * Execution detail that polls while the run is in flight, then stops. Used as a reliable
 * fallback for the test-mode drawer: even if live WS events are missed (a fast run can finish
 * before the socket subscribes), the persisted step log still shows.
 */
export function usePollingExecution(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.executions.detail(id) : queryKeys.executions.detail('none'),
    queryFn: ({ signal }) => api.executions.get(id as string, signal),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      const done = state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED' || state === 'TIMED_OUT';
      return done ? false : 1000;
    },
  });
}

export function useExecutionCommand() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; command: ExecutionCommand }) =>
      api.executions.command(input.id, { command: input.command }),
    // The command endpoint only acknowledges delivery; the actual state
    // transition streams back over WS and is persisted. Refetch to pick it up.
    onSuccess: (_result, input) => {
      void client.invalidateQueries({ queryKey: queryKeys.executions.detail(input.id) });
      void client.invalidateQueries({ queryKey: queryKeys.executions.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useRunTest() {
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: RunTestRequest) => api.executions.test(body),
    onError: () => toast.error(strings.toast.failed),
  });
}
