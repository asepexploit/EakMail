import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AddEakTeleStockRequest } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { useToasts } from '@/features/shared/useToasts';

export function useEakTeleStock(params?: { productId?: string; status?: string }) {
  return useQuery({
    queryKey: queryKeys.eaktele.stock(params),
    queryFn: ({ signal }) => api.eaktele.listStock(params, signal),
  });
}

export function useAddEakTeleStock() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: AddEakTeleStockRequest) => api.eaktele.addStock(body),
    onSuccess: () => {
      toast.success('Stok berhasil ditambahkan');
      void client.invalidateQueries({ queryKey: queryKeys.eaktele.all });
    },
    onError: () => toast.error('Gagal menambahkan stok'),
  });
}

export function useBulkImportEakTele() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: { productId: string; lines: string[] }) =>
      api.eaktele.bulkImport(body),
    onSuccess: (data) => {
      toast.success(`Import selesai: ${data.ok}/${data.total} berhasil`);
      void client.invalidateQueries({ queryKey: queryKeys.eaktele.all });
    },
    onError: () => toast.error('Gagal import stok'),
  });
}

export function useDeleteEakTeleStock() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (id: string) => api.eaktele.deleteStock(id),
    onSuccess: () => {
      toast.success('Stok dihapus');
      void client.invalidateQueries({ queryKey: queryKeys.eaktele.all });
    },
    onError: () => toast.error('Gagal menghapus stok'),
  });
}

export function useEakTeleLoginStart() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { productId: string; phone: string; password2fa?: string; notes?: string }) =>
      api.eaktele.loginStart(body),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.eaktele.all }),
  });
}

export function useEakTeleLoginSubmit() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: { stockId: string; loginId: string; code: string; password?: string }) =>
      api.eaktele.loginSubmit(body),
    onSuccess: () => {
      toast.success('Akun berhasil diverifikasi dan sesi aktif');
      void client.invalidateQueries({ queryKey: queryKeys.eaktele.all });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('unknown')) {
        toast.error('Sesi OTP kadaluarsa, silakan kirim ulang OTP');
      } else {
        toast.error('Kode OTP salah atau sesi expired');
      }
    },
  });
}
