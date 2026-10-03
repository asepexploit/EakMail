import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomerDto, UpdateCustomerRequest } from '@eakmail/shared-types';
import { api, type CustomerListQuery } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

/** Paginated + filterable customer list. */
export function useCustomers(query?: CustomerListQuery) {
  return useQuery({
    queryKey: queryKeys.customers.list(query),
    queryFn: ({ signal }) => api.customers.list(query, signal),
  });
}

/** Aggregate stats for the header cards. */
export function useCustomerStats() {
  return useQuery({
    queryKey: queryKeys.customers.stats,
    queryFn: ({ signal }) => api.customers.stats(signal),
  });
}

export interface UpdateCustomerInput {
  id: string;
  body: UpdateCustomerRequest;
  /** Toast shown on success; falls back to the generic saved message. */
  successMessage?: string;
}

/**
 * Update a customer (block/unblock, balance). On success the detail cache is
 * primed and the list + stats queries are invalidated so the table and cards
 * reflect the new state immediately.
 */
export function useUpdateCustomer() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: ({ id, body }: UpdateCustomerInput) => api.customers.update(id, body),
    onSuccess: (customer: CustomerDto, { successMessage }) => {
      toast.success(successMessage ?? strings.toast.saved);
      client.setQueryData(queryKeys.customers.detail(customer.id), customer);
      void client.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
    onError: () => toast.error(strings.toast.failed),
  });
}
