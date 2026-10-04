import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/http';

export interface MonitorAccountRow {
  id: string;
  label: string;
  phone: string;
  status: string;
  autoJoinEnabled: boolean;
  autoJoinMaxPerHour: number;
  messageLogEnabled: boolean;
  monitorRunning: boolean;
  groupStats: { active: number; readOnly: number; left: number; todayJoins: number };
  queuePending: number;
}

export interface MonitorMessageRow {
  id: string;
  accountId: string;
  accountLabel: string;
  chatId: string;
  chatTitle: string;
  senderId: string | null;
  senderName: string | null;
  text: string;
  hasLink: boolean;
  ts: string;
}

export interface MonitoredGroupRow {
  id: string;
  accountId: string;
  accountLabel: string;
  accountPhone: string;
  chatId: string;
  username: string | null;
  title: string;
  type: string;
  memberCount: number | null;
  canSendMessages: boolean;
  status: string;
  messageCount: number;
  joinedAt: string;
  leftAt: string | null;
  sourceLink: string | null;
}

export interface ActivityRow {
  id: string;
  accountId: string;
  accountLabel: string | null;
  sourceGroup: string;
  targetGroup: string;
  rawLink: string;
  ok: boolean;
  alreadyMember: boolean;
  error: string | null;
  joinedAt: string;
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useMonitorAccounts() {
  return useQuery<MonitorAccountRow[]>({
    queryKey: ['monitor-accounts'],
    queryFn: () => http.get('/monitor/accounts'),
    refetchInterval: 15_000,
  });
}

export function useUpdateMonitor() {
  const qc = useQueryClient();
  return useMutation<{ monitorRunning: boolean }, Error, {
    id: string;
    autoJoinEnabled?: boolean;
    autoJoinMaxPerHour?: number;
    messageLogEnabled?: boolean;
  }>({
    mutationFn: ({ id, ...body }) => http.patch(`/monitor/accounts/${id}/monitor`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor-accounts'] }),
  });
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function useMonitorMessages(accountId?: string, onlyLinks?: boolean) {
  return useQuery<MonitorMessageRow[]>({
    queryKey: ['monitor-messages', accountId, onlyLinks],
    queryFn: () => http.get('/monitor/messages', { query: { accountId, onlyLinks, limit: 100 } }),
    refetchInterval: 5_000,
  });
}

export function useSyncAccountGroups() {
  const qc = useQueryClient();
  return useMutation<{ activeGroups: number }, Error, string>({
    mutationFn: (id) => http.post(`/monitor/accounts/${id}/sync`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitor-accounts'] });
      qc.invalidateQueries({ queryKey: ['monitor-groups'] });
    },
  });
}

// ── Groups ────────────────────────────────────────────────────────────────────

export function useMonitorGroups(accountId?: string, status?: string) {
  return useQuery<MonitoredGroupRow[]>({
    queryKey: ['monitor-groups', accountId, status],
    queryFn: () => http.get('/monitor/groups', { query: { accountId, status } }),
    refetchInterval: 20_000,
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => http.post(`/monitor/groups/${id}/leave`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor-groups'] }),
  });
}

export function useLeaveReadOnly() {
  const qc = useQueryClient();
  return useMutation<{ results: Array<{ chatId: string; title: string; ok: boolean }> }, Error, string>({
    mutationFn: (accountId) => http.post(`/monitor/accounts/${accountId}/leave-readonly`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor-groups'] }),
  });
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export interface QueueItemRow {
  id: string;
  accountId: string;
  accountLabel: string;
  rawLink: string;
  sourceGroup: string;
  status: string;
  enqueuedAt: string;
}

export function useAccountQueue(accountId: string, enabled: boolean) {
  return useQuery<QueueItemRow[]>({
    queryKey: ['monitor-queue', accountId],
    queryFn: () => http.get('/monitor/queue', { query: { accountId, limit: 200 } }),
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useJoinQueueItemNow() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; error?: string }, Error, { accountId: string; queueId: string }>({
    mutationFn: ({ accountId, queueId }) =>
      http.post(`/monitor/accounts/${accountId}/queue/${queueId}/join-now`, {}),
    onSuccess: (_, { accountId }) => {
      qc.invalidateQueries({ queryKey: ['monitor-queue', accountId] });
      qc.invalidateQueries({ queryKey: ['monitor-accounts'] });
      qc.invalidateQueries({ queryKey: ['monitor-groups'] });
    },
  });
}

// ── Activity ──────────────────────────────────────────────────────────────────

export function useMonitorActivity(accountId?: string) {
  return useQuery<ActivityRow[]>({
    queryKey: ['monitor-activity', accountId],
    queryFn: () => http.get('/monitor/activity', { query: { accountId, limit: 200 } }),
    refetchInterval: 10_000,
  });
}
