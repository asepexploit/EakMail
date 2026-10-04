import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PakasirConfigUpdate, type BotProfileDto } from '@/lib/api';
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

export function useUpdatePakasir() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: PakasirConfigUpdate) => api.settings.updatePakasir(body),
    onSuccess: () => {
      toast.success('Konfigurasi Pakasir disimpan.');
      void client.invalidateQueries({ queryKey: queryKeys.settings.current });
    },
    onError: () => toast.error('Gagal menyimpan konfigurasi Pakasir.'),
  });
}

export function useBotProfile() {
  return useQuery({
    queryKey: ['settings-bot-profile'],
    queryFn: ({ signal }) => api.settings.getBotProfile(signal),
    staleTime: 60_000,
    retry: false,
  });
}

export function useUpdateBotProfile() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: Partial<BotProfileDto>) => api.settings.updateBotProfile(body),
    onSuccess: () => {
      toast.success('Profil bot berhasil diperbarui.');
      void client.invalidateQueries({ queryKey: ['settings-bot-profile'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Gagal memperbarui profil bot.'),
  });
}
