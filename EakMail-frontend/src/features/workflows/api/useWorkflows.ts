import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpsertWorkflowRequest } from '@eakmail/shared-types';
import { api, type ListQuery } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-client';
import { strings } from '@/lib/strings';
import { useToasts } from '@/features/shared/useToasts';

export function useWorkflows(query?: ListQuery) {
  return useQuery({
    queryKey: queryKeys.workflows.list(query),
    queryFn: ({ signal }) => api.workflows.list(query, signal),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.workflows.detail(id) : queryKeys.workflows.detail('none'),
    queryFn: ({ signal }) => api.workflows.get(id as string, signal),
    enabled: Boolean(id),
  });
}

export function useSaveWorkflow() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id?: string; body: UpsertWorkflowRequest }) =>
      input.id ? api.workflows.update(input.id, input.body) : api.workflows.create(input.body),
    onSuccess: (workflow) => {
      toast.success(strings.toast.saved);
      client.setQueryData(queryKeys.workflows.detail(workflow.id), workflow);
      void client.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : strings.toast.failed;
      toast.error(msg);
    },
  });
}

export function useToggleWorkflowActive() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      api.workflows.toggleActive(input.id, input.isActive),
    onSuccess: (workflow) => {
      toast.success(strings.toast.saved);
      client.setQueryData(queryKeys.workflows.detail(workflow.id), workflow);
      void client.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : strings.toast.failed;
      toast.error(msg);
    },
  });
}

export function useValidateWorkflow() {
  return useMutation({
    mutationFn: (body: UpsertWorkflowRequest) => api.workflows.validate(body),
  });
}

export function useRollbackWorkflow() {
  const client = useQueryClient();
  const toast = useToasts();
  return useMutation({
    mutationFn: (input: { id: string; version: number }) =>
      api.workflows.rollback(input.id, input.version),
    onSuccess: (workflow) => {
      toast.success(strings.toast.saved);
      client.setQueryData(queryKeys.workflows.detail(workflow.id), workflow);
      void client.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : strings.toast.failed;
      toast.error(msg);
    },
  });
}
