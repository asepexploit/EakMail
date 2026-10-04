import { useState } from 'react';
import { Plus, Play, Pause, Archive, Trash2, Edit2, Clock, Users, Radio, LogIn } from 'lucide-react';
import type { PromotionCampaignDto, UpsertCampaignRequest } from '@eakmail/shared-types';
import { CampaignStatus } from '@eakmail/shared-types';
import { useToasts } from '@/features/shared/useToasts';
import {
  usePromotionCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useSetCampaignStatus,
  useDeleteCampaign,
  useJoinCampaignGroups,
} from '@/features/promotion/api/usePromotionCampaigns';
import { usePromotionAccounts } from '@/features/promotion/api/usePromotionAccounts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import { CampaignDrawer } from '@/features/promotion/components/CampaignDrawer';

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
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinResults, setJoinResults] = useState<{ campaignId: string; summary: string } | null>(null);

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
}: CampaignCardProps) {
  const isActive = c.status === CampaignStatus.ACTIVE;
  const isPaused = c.status === CampaignStatus.PAUSED;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-text">{c.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{c.message}</p>
        </div>
        <button onClick={onEdit} className="shrink-0 p-1 text-text-muted hover:text-brand">
          <Edit2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-text-muted">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span>Tiap {c.intervalMinutes} menit</span>
        </div>
        <div className="flex items-center gap-1">
          <Radio className="h-3.5 w-3.5" />
          <span>{c.targetGroups.length > 0 ? `${c.targetGroups.length} grup` : 'otomatis'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{accountCount} akun</span>
        </div>
      </div>

      {c.nextRunAt && isActive && (
        <p className="text-xs text-text-muted">
          Kirim berikutnya: {new Date(c.nextRunAt).toLocaleString('id-ID')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {isPaused && (
          <Button size="sm" variant="ghost" onClick={onActivate} className="text-success border-success/30">
            <Play className="h-3.5 w-3.5" />
            Aktifkan
          </Button>
        )}
        {isActive && (
          <Button size="sm" variant="ghost" onClick={onPause}>
            <Pause className="h-3.5 w-3.5" />
            Jeda
          </Button>
        )}
        {!isPaused && c.status !== CampaignStatus.ARCHIVED && (
          <Button size="sm" variant="ghost" onClick={onArchive} className="text-text-muted">
            <Archive className="h-3.5 w-3.5" />
            Arsip
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onJoinGroups}
          isLoading={isJoining}
          title="Auto-join semua target grup dengan akun yang terpilih"
        >
          <LogIn className="h-3.5 w-3.5" />
          Join Grup
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {joinSummary && (
        <p className="text-xs text-text-muted">{joinSummary}</p>
      )}
    </Card>
  );
}
