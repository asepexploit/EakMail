import { useState } from 'react';
import { Plus, Play, Pause, Archive, Trash2, Edit2, Clock, Users, Radio, LogIn, Zap } from 'lucide-react';
import type { PromotionCampaignDto, UpsertCampaignRequest } from '@eakmail/shared-types';
import { CampaignStatus, CampaignSendMode } from '@eakmail/shared-types';
import { useToasts } from '@/features/shared/useToasts';
import {
  usePromotionCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useSetCampaignStatus,
  useDeleteCampaign,
  useJoinCampaignGroups,
  useTriggerCampaign,
} from '@/features/promotion/api/usePromotionCampaigns';
import { usePromotionAccounts } from '@/features/promotion/api/usePromotionAccounts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import { CampaignDrawer } from '@/features/promotion/components/CampaignDrawer';

const SEND_MODE_LABEL: Record<string, string> = {
  [CampaignSendMode.ROUND_ROBIN]: 'giliran',
  [CampaignSendMode.ALL_ACCOUNTS]: 'semua',
  [CampaignSendMode.RANDOM]: 'acak',
};

const STATUS_COLOR: Record<string, string> = {
  [CampaignStatus.ACTIVE]: 'bg-success/10 text-success',
  [CampaignStatus.PAUSED]: 'bg-warning/10 text-warning',
  [CampaignStatus.ARCHIVED]: 'bg-surface text-text-muted',
};

const STATUS_LABEL: Record<string, string> = {
  [CampaignStatus.ACTIVE]: 'Aktif',
  [CampaignStatus.PAUSED]: 'Dijeda',
  [CampaignStatus.ARCHIVED]: 'Diarsip',
};

export default function PromotionCampaignsPage() {
  const { data: campaigns = [], isLoading } = usePromotionCampaigns();
  const { data: accounts = [] } = usePromotionAccounts();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const setStatus = useSetCampaignStatus();
  const deleteCampaign = useDeleteCampaign();
  const toast = useToasts();

  const joinGroups = useJoinCampaignGroups();
  const triggerCampaign = useTriggerCampaign();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinResults, setJoinResults] = useState<{ campaignId: string; summary: string } | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionCampaignDto | null>(null);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(c: PromotionCampaignDto) {
    setEditing(c);
    setDrawerOpen(true);
  }

  async function handleTrigger(id: string) {
    setTriggeringId(id);
    try {
      await triggerCampaign.mutateAsync(id);
      toast.success('Kampanye dikirim', 'Pesan sedang dikirim ke grup sekarang');
    } catch {
      toast.error('Gagal trigger kampanye');
    } finally {
      setTriggeringId(null);
    }
  }

  async function handleJoinGroups(id: string) {
    setJoiningId(id);
    setJoinResults(null);
    try {
      const res = await joinGroups.mutateAsync(id);
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.filter((r) => !r.ok).length;
      setJoinResults({ campaignId: id, summary: `${ok} berhasil join, ${fail} gagal` });
    } catch {
      setJoinResults({ campaignId: id, summary: 'Gagal menghubungi server' });
    } finally {
      setJoiningId(null);
    }
  }

  async function handleSubmit(data: UpsertCampaignRequest) {
    try {
      if (editing) {
        await updateCampaign.mutateAsync({ id: editing.id, ...data });
      } else {
        await createCampaign.mutateAsync(data);
      }
      setDrawerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan kampanye');
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Kampanye Promosi</h1>
          <p className="text-sm text-text-muted">
            Jadwalkan pesan promosi otomatis ke grup/channel Telegram
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Buat Kampanye
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">{strings.common.loading}</p>
      ) : campaigns.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <Radio className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada kampanye. Buat kampanye pertama untuk mulai promosi otomatis.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              accountCount={c.accountIds.length}
              onEdit={() => openEdit(c)}
              onActivate={() => setStatus.mutate({ id: c.id, status: 'ACTIVE' })}
              onPause={() => setStatus.mutate({ id: c.id, status: 'PAUSED' })}
              onArchive={() => setStatus.mutate({ id: c.id, status: 'ARCHIVED' })}
              onDelete={() => deleteCampaign.mutate(c.id)}
              onJoinGroups={() => handleJoinGroups(c.id)}
              isJoining={joiningId === c.id}
              joinSummary={joinResults?.campaignId === c.id ? joinResults.summary : undefined}
              onTrigger={() => handleTrigger(c.id)}
              isTriggering={triggeringId === c.id}
            />
          ))}
        </div>
      )}

      <CampaignDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campaign={editing}
        accounts={accounts}
        onSubmit={handleSubmit}
        isSubmitting={createCampaign.isPending || updateCampaign.isPending}
      />
    </div>
  );
}

interface CampaignCardProps {
  campaign: PromotionCampaignDto;
  accountCount: number;
  onEdit: () => void;
  onActivate: () => void;
  onPause: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onJoinGroups: () => void;
  isJoining: boolean;
  joinSummary?: string;
  onTrigger: () => void;
  isTriggering: boolean;
}

function CampaignCard({
  campaign: c,
  accountCount,
  onEdit,
  onActivate,
  onPause,
  onArchive,
  onDelete,
  onJoinGroups,
  isJoining,
  joinSummary,
  onTrigger,
  isTriggering,
}: CampaignCardProps) {
  const isActive = c.status === CampaignStatus.ACTIVE;
  const isPaused = c.status === CampaignStatus.PAUSED;
  const isArchived = c.status === CampaignStatus.ARCHIVED;

  return (
    <Card className="flex flex-col gap-0 overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-text">{c.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.message}</p>
        </div>
        <button onClick={onEdit} className="mt-0.5 shrink-0 rounded p-1 text-text-muted hover:bg-surface hover:text-brand">
          <Edit2 className="h-4 w-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-surface/40">
        <div className="flex flex-col items-center gap-0.5 px-3 py-2.5">
          <Clock className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text">{c.intervalMinutes}m</span>
          <span className="text-[10px] text-text-muted">interval</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2.5">
          <Radio className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text">
            {c.targetGroups.length > 0 ? c.targetGroups.length : '—'}
          </span>
          <span className="text-[10px] text-text-muted">
            {c.targetGroups.length > 0 ? 'grup' : 'otomatis'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3 py-2.5">
          <Users className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text">{accountCount}</span>
          <span className="text-[10px] text-text-muted">
            akun · {SEND_MODE_LABEL[c.sendMode] ?? c.sendMode.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Next run */}
      {c.nextRunAt && isActive && (
        <div className="border-b border-border px-4 py-2 text-xs text-text-muted">
          Kirim berikutnya: <span className="font-medium text-text">{new Date(c.nextRunAt).toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 p-3">
        {/* Kirim Sekarang — primary trigger */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onTrigger}
          isLoading={isTriggering}
          className="text-brand border-brand/30 hover:bg-brand/10"
          title="Kirim pesan kampanye sekarang, abaikan jadwal aktif"
        >
          <Zap className="h-3.5 w-3.5" />
          Kirim Sekarang
        </Button>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {isPaused && (
          <Button size="sm" variant="ghost" onClick={onActivate} className="text-success">
            <Play className="h-3.5 w-3.5" />
            Aktifkan
          </Button>
        )}
        {isActive && (
          <Button size="sm" variant="ghost" onClick={onPause} className="text-warning">
            <Pause className="h-3.5 w-3.5" />
            Jeda
          </Button>
        )}
        {!isArchived && (
          <Button size="sm" variant="ghost" onClick={onArchive} className="text-text-muted">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onJoinGroups}
          isLoading={isJoining}
          className="text-text-muted"
          title="Auto-join semua target grup"
        >
          <LogIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {joinSummary && (
        <p className="border-t border-border px-4 pb-3 pt-2 text-xs text-text-muted">{joinSummary}</p>
      )}
    </Card>
  );
}
