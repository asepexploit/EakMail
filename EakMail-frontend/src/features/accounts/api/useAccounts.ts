import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StartLoginRequest,
  SubmitCodeRequest,
  TelegramAccountDto,
} from '@eakmail/shared-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.all,
    queryFn: ({ signal }) => api.accounts.list(signal),
  });
}

export function useStartAccountLogin() {
  return useMutation({
    mutationFn: (body: StartLoginRequest) => api.accounts.startLogin(body),
  });
}

export function useSubmitAccountCode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitCodeRequest) => api.accounts.submitCode(body),
    onSuccess: (result) => {
      if (result.done) {
        void client.invalidateQueries({ queryKey: queryKeys.accounts.all });
      }
    },
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (account: TelegramAccountDto) => api.accounts.remove(account.id),
    onSuccess: () => {
      toast.success(strings.toast.deleted);
      void client.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
