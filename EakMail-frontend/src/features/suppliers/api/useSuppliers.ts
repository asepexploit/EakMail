import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupplierDto, UpsertSupplierRequest } from '@eakmail/shared-types';
import { api, type ListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useSuppliers(query?: ListQuery) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(query),
    queryFn: ({ signal }) => api.suppliers.list(query, signal),
  });
}

export function useCreateSupplier() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: UpsertSupplierRequest) => api.suppliers.create(body),
    onSuccess: () => {
      toast.success(strings.toast.saved);
      void client.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useUpdateSupplier() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; body: UpsertSupplierRequest }) =>
      api.suppliers.update(input.id, input.body),
    onSuccess: () => {
      toast.success(strings.toast.saved);
      void client.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useDeleteSupplier() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (supplier: SupplierDto) => api.suppliers.remove(supplier.id),
    onSuccess: () => {
      toast.success(strings.toast.deleted);
      void client.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
