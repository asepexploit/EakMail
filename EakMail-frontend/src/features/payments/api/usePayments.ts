import { useQuery } from '@tanstack/react-query';
import { api, type ListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export function usePayments(query?: ListQuery) {
  return useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: ({ signal }) => api.payments.list(query, signal),
  });
}

export function usePaymentStats() {
  return useQuery({
    queryKey: queryKeys.payments.stats,
    queryFn: ({ signal }) => api.payments.stats(signal),
  });
}

export function usePaymentByOrder(orderId: string | null) {
  return useQuery({
    queryKey: orderId ? queryKeys.payments.byOrder(orderId) : queryKeys.payments.byOrder('none'),
    queryFn: ({ signal }) => api.payments.getByOrder(orderId as string, signal),
    enabled: Boolean(orderId),
  });
}
