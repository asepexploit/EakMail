import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDto, UpsertProductRequest } from '@eakmail/shared-types';
import { api, type ListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useProducts(query?: ListQuery) {
  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: ({ signal }) => api.products.list(query, signal),
  });
}

export function useCreateProduct() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (body: UpsertProductRequest) => api.products.create(body),
    onSuccess: () => {
      toast.success(strings.toast.saved);
      void client.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useUpdateProduct() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; body: UpsertProductRequest }) =>
      api.products.update(input.id, input.body),
    onSuccess: () => {
      toast.success(strings.toast.saved);
      void client.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useSetProductActive() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; active: boolean }) =>
      api.products.setActive(input.id, input.active),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.products.all }),
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useDeleteProduct() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (product: ProductDto) => api.products.remove(product.id),
    onSuccess: () => {
      toast.success(strings.toast.deleted);
      void client.invalidateQueries({ queryKey: queryKeys.products.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
