import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BotConfigDto, UpdateBotConfigRequest } from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useBotConfig() {
  return useQuery({
    queryKey: queryKeys.botConfig.current,
    queryFn: ({ signal }) => api.botConfig.get(signal),
  });
}

export function useUpdateBotConfig() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: UpdateBotConfigRequest) => api.botConfig.update(body),
    onSuccess: (updated: BotConfigDto) => {
      toast.success(strings.toast.saved);
      client.setQueryData(queryKeys.botConfig.current, updated);
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
