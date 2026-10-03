import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useToasts } from '@/features/shared/useToasts';

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings.current,
    queryFn: ({ signal }) => api.settings.get(signal),
  });
}

export function useSetupTotp() {
  const toast = useToasts();
  return useMutation({
    mutationFn: () => api.settings.setupTotp(),
    onError: () => toast.error('Gagal memulai setup 2FA.'),
  });
}

export function useEnableTotp() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (code: string) => api.settings.enableTotp(code),
    onSuccess: () => {
      toast.success('2FA berhasil diaktifkan.');
      void client.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
    onError: () => toast.error('Kode TOTP tidak valid.'),
  });
}

export function useDisableTotp() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (code: string) => api.settings.disableTotp(code),
    onSuccess: () => {
      toast.success('2FA berhasil dinonaktifkan.');
      void client.invalidateQueries({ queryKey: queryKeys.auth.me });
    },
    onError: () => toast.error('Kode TOTP tidak valid.'),
  });
}
