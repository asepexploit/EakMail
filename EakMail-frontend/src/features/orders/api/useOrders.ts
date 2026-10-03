import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type OrderListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useOrders(query?: OrderListQuery) {
  return useQuery({
    queryKey: queryKeys.orders.list(query),
    queryFn: ({ signal }) => api.orders.list(query, signal),
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.orders.detail(id) : queryKeys.orders.detail('none'),
    queryFn: ({ signal }) => api.orders.get(id as string, signal),
    enabled: Boolean(id),
  });
}

function useOrderAction(action: 'retry' | 'refund' | 'cancel', successMessage: string) {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (id: string) => {
      if (action === 'retry') return api.orders.retry(id);
      if (action === 'refund') return api.orders.refund(id);
      return api.orders.cancel(id);
    },
    onSuccess: (order) => {
      toast.success(successMessage);
      client.setQueryData(queryKeys.orders.detail(order.id), order);
      void client.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}

export function useRetryOrder() {
  return useOrderAction('retry', strings.toast.saved);
}

export function useRefundOrder() {
  return useOrderAction('refund', strings.toast.saved);
}

export function useCancelOrder() {
  return useOrderAction('cancel', strings.toast.saved);
}
