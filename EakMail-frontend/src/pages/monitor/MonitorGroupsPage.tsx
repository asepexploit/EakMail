import { useState } from 'react';
import { LogOut, Send, Ban, Eye, Hash, Users, Filter, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useMonitorGroups,
  useLeaveGroup,
  useLeaveReadOnly,
  useMonitorAccounts,
  type MonitoredGroupRow,
} from '@/features/monitor/api/useMonitor';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Aktif',
  READ_ONLY: 'Read-only',
  LEFT: 'Keluar',
  BANNED: 'Diblokir',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  READ_ONLY: 'bg-warning/10 text-warning',
  LEFT: 'bg-surface text-text-muted',
  BANNED: 'bg-danger/10 text-danger',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  group: <Users className="h-3.5 w-3.5" />,
  supergroup: <Users className="h-3.5 w-3.5" />,
  channel: <Hash className="h-3.5 w-3.5" />,
};

export default function MonitorGroupsPage() {
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: groups = [], isLoading } = useMonitorGroups(
    filterAccountId || undefined,
    filterStatus || undefined,
  );
  const { data: accounts = [] } = useMonitorAccounts();
  const leaveGroup = useLeaveGroup();
  const leaveReadOnly = useLeaveReadOnly();

  const readOnlyCount = groups.filter((g) => g.status === 'READ_ONLY').length;
  const activeCount = groups.filter((g) => g.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">Grup & Channel</h1>
          <p className="text-sm text-text-muted">
            {activeCount} aktif · {readOnlyCount} read-only · total {groups.length}
          </p>
        </div>
        {readOnlyCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-warning shrink-0"
            onClick={() => {
              if (filterAccountId) {
                // Filtered to one account — leave only that account's read-only groups
                leaveReadOnly.mutate(filterAccountId);
              } else {
                // No filter — leave read-only groups for every account that has them
                const accountsWithReadOnly = [
                  ...new Set(groups.filter((g) => g.status === 'READ_ONLY').map((g) => g.accountId)),
                ];
                for (const id of accountsWithReadOnly) leaveReadOnly.mutate(id);
              }
            }}
            isLoading={leaveReadOnly.isPending}
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave semua read-only ({readOnlyCount})
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-text-muted" />
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1.5 text-xs text-text focus:outline-none"
          >
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-border bg-bg px-2 py-1.5 text-xs text-text focus:outline-none"
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="READ_ONLY">Read-only</option>
            <option value="LEFT">Keluar</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Memuat...</p>
      ) : groups.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <Users className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada grup. Aktifkan monitor lalu sinkron akun.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onLeave={() => leaveGroup.mutate(g.id)}
              isLeaving={leaveGroup.isPending && leaveGroup.variables === g.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group: g,
  onLeave,
  isLeaving,
}: {
  group: MonitoredGroupRow;
  onLeave: () => void;
  isLeaving: boolean;
}) {
  const isLeft = g.status === 'LEFT';

  return (
    <Card className={`flex flex-col gap-3 p-4 ${isLeft ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-text-muted">{TYPE_ICON[g.type]}</span>
            <p className="truncate font-medium text-text text-sm">{g.title}</p>
          </div>
          {g.username ? (
            <p className="text-xs text-brand font-mono">@{g.username}</p>
          ) : (
            <p className="text-xs text-text-muted font-mono">{g.chatId}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[g.status]}`}>
          {STATUS_LABEL[g.status]}
        </span>
      </div>

      {/* Capabilities row */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`flex items-center gap-1 ${g.canSendMessages ? 'text-success' : 'text-warning'}`}>
          {g.canSendMessages ? <Send className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {g.canSendMessages ? 'Bisa kirim' : 'Read-only'}
        </span>
        {g.type === 'channel' && (
          <span className="flex items-center gap-1 text-text-muted">
            <Hash className="h-3 w-3" />
            Channel
          </span>
        )}
        {g.memberCount != null && (
          <span className="flex items-center gap-1 text-text-muted">
            <Users className="h-3 w-3" />
            {g.memberCount.toLocaleString('id-ID')}
          </span>
        )}
        {g.messageCount > 0 && (
          <span className="flex items-center gap-1 text-text-muted">
            <MessageSquare className="h-3 w-3" />
            {g.messageCount.toLocaleString('id-ID')} pesan
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="space-y-0.5 text-[11px] text-text-muted">
        <p>Akun: {g.accountLabel}</p>
        <p>Join: {new Date(g.joinedAt).toLocaleDateString('id-ID')}</p>
        {g.sourceLink && (
          <p className="truncate">Sumber: <span className="font-mono">{g.sourceLink}</span></p>
        )}
      </div>

      {/* Actions */}
      {!isLeft && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-danger"
          onClick={onLeave}
          isLoading={isLeaving}
        >
          <LogOut className="h-3.5 w-3.5" />
          Leave
        </Button>
      )}
      {isLeft && g.leftAt && (
        <p className="text-center text-[11px] text-text-muted">
          Keluar {new Date(g.leftAt).toLocaleDateString('id-ID')}
        </p>
      )}

      {/* Warning: read-only but still joined */}
      {g.status === 'READ_ONLY' && (
        <div className="flex items-center gap-1.5 rounded bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          <Ban className="h-3 w-3 shrink-0" />
          Tidak bisa kirim pesan — disarankan leave
        </div>
      )}
    </Card>
  );
}
