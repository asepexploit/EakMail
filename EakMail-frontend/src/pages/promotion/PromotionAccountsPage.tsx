import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, KeyRound, Search, RotateCcw, HeartPulse,
  ChevronDown, ChevronRight, UserPen, MoreVertical,
  LogIn, Clock,
} from 'lucide-react';
import { AccountJoinPanel } from '@/features/promotion/components/AccountJoinPanel';
import { AutoJoinSettings } from '@/features/promotion/components/AutoJoinSettings';
import { JoinAllPanel } from '@/features/promotion/components/JoinAllPanel';
import { BulkJoinScheduledPanel } from '@/features/promotion/components/BulkJoinScheduledPanel';
import { AutoReplyPanel } from '@/features/promotion/components/AutoReplyPanel';
import { AutoSearchPanel } from '@/features/promotion/components/AutoSearchPanel';
import { ProfileEditModal } from '@/features/promotion/components/ProfileEditModal';
import { TelegramDialogsModal } from '@/features/promotion/components/TelegramDialogsModal';
import type { PromotionAccountDto } from '@eakmail/shared-types';
import { PromotionAccountStatus } from '@eakmail/shared-types';
import {
  usePromotionAccounts,
  useStartPromotionLogin,
  useSubmitPromotionCode,
  useDeletePromotionAccount,
  useAccountStats,
  useHealthCheck,
} from '@/features/promotion/api/usePromotionAccounts';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/lib/status-tokens';

type LoginStep = 'idle' | 'phone' | 'code' | 'password';

const STATUS_LABEL: Record<string, string> = {
  [PromotionAccountStatus.CONNECTED]: 'Terhubung',
  [PromotionAccountStatus.DISCONNECTED]: 'Terputus',
  [PromotionAccountStatus.FLOOD_WAIT]: 'Flood Wait',
  [PromotionAccountStatus.BANNED]: 'Diblokir',
  [PromotionAccountStatus.FROZEN]: 'Dibekukan',
};

const STATUS_TONE: Record<string, StatusTone> = {
  [PromotionAccountStatus.CONNECTED]: 'success',
  [PromotionAccountStatus.DISCONNECTED]: 'danger',
  [PromotionAccountStatus.FLOOD_WAIT]: 'warning',
  [PromotionAccountStatus.BANNED]: 'danger',
  [PromotionAccountStatus.FROZEN]: 'info',
};

const STATUS_DETAIL: Partial<Record<string, string>> = {
  [PromotionAccountStatus.DISCONNECTED]: 'Sesi tidak valid atau kedaluwarsa. Login ulang untuk menghubungkan kembali.',
  [PromotionAccountStatus.BANNED]: 'Akun ini diblokir oleh Telegram. Gunakan akun lain atau hubungi Telegram support.',
  [PromotionAccountStatus.FROZEN]: 'Akun dibekukan oleh Telegram (read-only). Tidak bisa kirim pesan. Ajukan banding via @SpamBot atau login ulang.',
};

export default function PromotionAccountsPage() {
  const { data: accounts = [], isLoading } = usePromotionAccounts();
  const startLogin = useStartPromotionLogin();
  const submitCode = useSubmitPromotionCode();
  const deleteAccount = useDeletePromotionAccount();
  const healthCheck = useHealthCheck();
  const healthCheckRan = useRef(false);

  const [step, setStep] = useState<LoginStep>('idle');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && accounts.length > 0 && !healthCheckRan.current) {
      healthCheckRan.current = true;
      healthCheck.mutate();
    }
  }, [isLoading, accounts.length]);

  function openAddModal(prefill?: { label: string; phone: string }) {
    setStep('phone');
    setLabel(prefill?.label ?? '');
    setPhone(prefill?.phone ?? '');
    setCode('');
    setPassword('');
    setError('');
  }

  function closeModal() {
    setStep('idle');
    setError('');
  }

  async function handleSendCode() {
    setError('');
    try {
      const res = await startLogin.mutateAsync({ label, phone });
      setLoginId(res.loginId);
      setAccountId(res.accountId);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim kode');
    }
  }

  async function handleSubmitCode() {
    setError('');
    try {
      const res = await submitCode.mutateAsync({ accountId, loginId, code, password: password || undefined });
      if (res.needsPassword) {
        setStep('password');
      } else if (res.done) {
        closeModal();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kode salah atau expired');
    }
  }

  async function handleSubmitPassword() {
    setError('');
    try {
      const res = await submitCode.mutateAsync({ accountId, loginId, code, password });
      if (res.done) closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Password 2FA salah');
    }
  }

  const summary = accounts.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Akun Promosi</h1>
          <p className="text-sm text-text-muted">
            Kelola akun Telegram (MTProto) untuk pengiriman pesan promosi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => healthCheck.mutate()}
            isLoading={healthCheck.isPending}
            title="Cek kesehatan semua sesi akun"
          >
            <HeartPulse className="h-4 w-4" />
            {healthCheck.isPending ? 'Mengecek...' : 'Cek Sesi'}
          </Button>
          <Button onClick={() => openAddModal()}>
            <Plus className="h-4 w-4" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Health check result banner */}
      {healthCheck.data && !healthCheck.isPending && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
          healthCheck.data.dead.length > 0
            ? 'bg-danger/10 text-danger'
            : 'bg-success/10 text-success'
        }`}>
          <HeartPulse className="h-4 w-4 shrink-0" />
          {healthCheck.data.dead.length > 0
            ? `${healthCheck.data.dead.length} akun bermasalah terdeteksi — status diperbarui`
            : `${healthCheck.data.checked} akun dicek — semua sesi aktif`
          }
        </div>
      )}

      {/* Summary pills */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span className="font-medium text-text">{accounts.length} akun</span>
          <span className="text-border">|</span>
          {summary.CONNECTED && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              {summary.CONNECTED} terhubung
            </span>
          )}
          {summary.FROZEN && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-info" />
              {summary.FROZEN} dibekukan
            </span>
          )}
          {summary.DISCONNECTED && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {summary.DISCONNECTED} terputus
            </span>
          )}
          {summary.BANNED && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {summary.BANNED} diblokir
            </span>
          )}
          {summary.FLOOD_WAIT && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {summary.FLOOD_WAIT} flood wait
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-muted">Memuat data akun...</p>
      ) : accounts.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <KeyRound className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada akun promosi. Tambah akun untuk mulai kampanye.</p>
        </Card>
      ) : (
        <>
          {/* Tools toolbar — collapsible panels in one compact row */}
          <ToolsToolbar accounts={accounts} />

          {/* Accounts table */}
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    <th className="w-8 px-2 py-2.5" />
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Akun</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Nomor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Terkirim</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Gagal</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Grup</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">Kampanye</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">Terakhir Kirim</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc) => (
                    <AccountRow
                      key={acc.id}
                      account={acc}
                      expanded={expandedId === acc.id}
                      onToggle={() => setExpandedId(expandedId === acc.id ? null : acc.id)}
                      onDelete={() => deleteAccount.mutate(acc.id)}
                      onRelogin={() => openAddModal({ label: acc.label, phone: acc.phone })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-text-muted">
              <span>{accounts.length} akun</span>
              <span>Klik baris untuk detail & pengaturan</span>
            </div>
          </Card>
        </>
      )}

      {/* Login Dialog */}
      <Dialog open={step !== 'idle'} onClose={closeModal} title="Tambah Akun Promosi" size="sm">
        {step === 'phone' && (
          <div className="space-y-4">
            <Input label="Label akun" placeholder="Akun Promosi 1" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input label="Nomor HP" placeholder="+6281234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSendCode} isLoading={startLogin.isPending}>Kirim Kode OTP</Button>
            </div>
          </div>
        )}
        {step === 'code' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Kode OTP dikirim ke <strong>{phone}</strong> via Telegram/SMS.</p>
            <Input label="Kode OTP" placeholder="12345" value={code} onChange={(e) => setCode(e.target.value)} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSubmitCode} isLoading={submitCode.isPending}>Verifikasi</Button>
            </div>
          </div>
        )}
        {step === 'password' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Akun ini menggunakan 2FA. Masukkan password Telegram.</p>
            <Input label="Password 2FA" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSubmitPassword} isLoading={submitCode.isPending}>Masuk</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

type ToolTab = 'search' | 'join-all' | 'join-scheduled' | null;

function ToolsToolbar({ accounts }: { accounts: PromotionAccountDto[] }) {
  const [activeTab, setActiveTab] = useState<ToolTab>(null);

  function toggle(tab: ToolTab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  const connectedCount = accounts.filter(
    (a) => a.status === PromotionAccountStatus.CONNECTED,
  ).length;

  return (
    <Card noPadding>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolButton
          active={activeTab === 'search'}
          onClick={() => toggle('search')}
          icon={<Search className="h-3.5 w-3.5" />}
          label="Auto-Search"
        />
        <ToolButton
          active={activeTab === 'join-all'}
          onClick={() => toggle('join-all')}
          icon={<LogIn className="h-3.5 w-3.5" />}
          label="Join Semua"
          badge={connectedCount > 0 ? `${connectedCount}` : undefined}
        />
        <ToolButton
          active={activeTab === 'join-scheduled'}
          onClick={() => toggle('join-scheduled')}
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Join Terjadwal"
        />
      </div>

      {activeTab === 'search' && <AutoSearchPanel embedded />}
      {activeTab === 'join-all' && <JoinAllPanel accounts={accounts} embedded />}
      {activeTab === 'join-scheduled' && <BulkJoinScheduledPanel embedded />}
    </Card>
  );
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand/10 text-brand'
          : 'text-text-muted hover:bg-surface-2 hover:text-text'
      }`}
    >
      {icon}
      {label}
      {badge && (
        <span className="rounded-full bg-brand/15 px-1.5 py-px text-[10px] font-semibold text-brand">
          {badge}
        </span>
      )}
    </button>
  );
}

function AccountRow({
  account,
  expanded,
  onToggle,
  onDelete,
  onRelogin,
}: {
  account: PromotionAccountDto;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRelogin: () => void;
}) {
  const { data: stats } = useAccountStats(account.id);
  const isConnected = account.status === PromotionAccountStatus.CONNECTED;
  const needsAttention =
    account.status === PromotionAccountStatus.DISCONNECTED ||
    account.status === PromotionAccountStatus.BANNED ||
    account.status === PromotionAccountStatus.FROZEN;
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialogsOpen, setDialogsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const tone = STATUS_TONE[account.status] ?? 'neutral';
  const statusLabel = STATUS_LABEL[account.status] ?? account.status;

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-border/60 transition-colors cursor-pointer last:border-b-0 ${
          expanded ? 'bg-surface-2/50' : 'hover:bg-surface-2/30'
        } ${needsAttention ? 'bg-danger/[0.02]' : ''}`}
      >
        {/* Expand chevron */}
        <td className="px-2 py-3 text-text-muted">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>

        {/* Label */}
        <td className="px-4 py-3">
          <span className="font-semibold text-text">{account.label}</span>
        </td>

        {/* Phone */}
        <td className="px-4 py-3 font-mono text-[13px] text-text-muted">
          +{account.phone}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusPill tone={tone} label={statusLabel} pulse={account.status === PromotionAccountStatus.FLOOD_WAIT} />
        </td>

        {/* Sent */}
        <td className="px-4 py-3 text-right font-mono text-[13px]">
          <span className={stats && stats.totalSent > 0 ? 'text-success' : 'text-text-muted'}>
            {stats ? stats.totalSent.toLocaleString('id-ID') : '—'}
          </span>
        </td>

        {/* Failed */}
        <td className="px-4 py-3 text-right font-mono text-[13px]">
          <span className={stats && stats.totalFailed > 0 ? 'text-danger' : 'text-text-muted'}>
            {stats ? stats.totalFailed.toLocaleString('id-ID') : '—'}
          </span>
        </td>

        {/* Groups */}
        <td className="px-4 py-3 text-right font-mono text-[13px] text-text">
          {stats ? stats.activeGroupCount.toLocaleString('id-ID') : '—'}
        </td>

        {/* Campaigns */}
        <td className="px-4 py-3 text-right font-mono text-[13px] text-text">
          {stats ? stats.campaignCount.toLocaleString('id-ID') : '—'}
        </td>

        {/* Last sent */}
        <td className="px-4 py-3 text-xs text-text-muted max-w-[200px]">
          {stats?.lastSent ? (
            <div className="truncate">
              <span className="text-text">{stats.lastSent.targetGroup}</span>
              <span className="mx-1 text-text-muted/50">·</span>
              <span>{new Date(stats.lastSent.sentAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ) : (
            <span className="text-text-muted/40">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="relative inline-flex items-center gap-1">
            {isConnected && (
              <button
                onClick={() => setProfileOpen(true)}
                className="rounded p-1.5 text-text-muted hover:bg-primary/10 hover:text-primary transition-colors"
                title="Edit profil"
              >
                <UserPen className="h-3.5 w-3.5" />
              </button>
            )}
            {isConnected && (
              <button
                onClick={() => setDialogsOpen(true)}
                className="rounded p-1.5 text-text-muted hover:bg-brand/10 hover:text-brand transition-colors"
                title="Cek grup & channel"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
            {needsAttention && (
              <button
                onClick={onRelogin}
                className="rounded p-1.5 text-text-muted hover:bg-success/10 hover:text-success transition-colors"
                title="Login ulang"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded p-1.5 text-text-muted hover:bg-surface-2 transition-colors"
                title="Opsi lainnya"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-md border border-border bg-surface py-1 shadow-lg">
                    <button
                      onClick={() => { onDelete(); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Akun
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="border-b border-border/60">
          <td colSpan={10} className="bg-surface-2/30 px-0 py-0">
            <AccountDetail
              account={account}
              needsAttention={needsAttention}
              isConnected={isConnected}
              onRelogin={onRelogin}
            />
          </td>
        </tr>
      )}

      <ProfileEditModal accountId={account.id} accountLabel={account.label} open={profileOpen} onClose={() => setProfileOpen(false)} />
      <TelegramDialogsModal accountId={account.id} accountLabel={account.label} open={dialogsOpen} onClose={() => setDialogsOpen(false)} />
    </>
  );
}

function AccountDetail({
  account,
  needsAttention,
  isConnected,
  onRelogin,
}: {
  account: PromotionAccountDto;
  needsAttention: boolean;
  isConnected: boolean;
  onRelogin: () => void;
}) {
  return (
    <div className="space-y-0 divide-y divide-border/40">
      {/* Status alert */}
      {needsAttention && STATUS_DETAIL[account.status] && (
        <div className={`flex items-start gap-3 px-6 py-3 text-xs ${
          account.status === PromotionAccountStatus.FROZEN
            ? 'bg-info/5 text-info'
            : 'bg-danger/5 text-danger'
        }`}>
          <div className="flex-1">
            <p className="font-medium">{STATUS_DETAIL[account.status]}</p>
          </div>
          {(account.status === PromotionAccountStatus.DISCONNECTED || account.status === PromotionAccountStatus.FROZEN) && (
            <button
              onClick={onRelogin}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Login Ulang
            </button>
          )}
        </div>
      )}

      {/* Info row */}
      <div className="grid grid-cols-2 gap-4 px-6 py-4 text-xs sm:grid-cols-4">
        <InfoItem label="Auto Reply" value={account.autoReplyEnabled ? 'Aktif' : 'Nonaktif'} tone={account.autoReplyEnabled ? 'success' : 'neutral'} />
        <InfoItem label="Flood Wait" value={account.floodUntil ? `s/d ${new Date(account.floodUntil).toLocaleString('id-ID')}` : 'Tidak'} tone={account.floodUntil ? 'warning' : 'neutral'} />
        <InfoItem label="Terakhir Aktif" value={account.lastUsedAt ? new Date(account.lastUsedAt).toLocaleString('id-ID') : 'Belum pernah'} />
        <InfoItem label="Terdaftar" value={new Date(account.createdAt).toLocaleDateString('id-ID')} />
      </div>

      {/* Action panels */}
      {isConnected && (
        <div className="px-2 py-2 space-y-0">
          <AccountJoinPanel accountId={account.id} />
          <AutoJoinSettings accountId={account.id} />
          <AutoReplyPanel accountId={account.id} />
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, tone }: { label: string; value: string; tone?: StatusTone }) {
  const colorClass =
    tone === 'success' ? 'text-success' :
    tone === 'warning' ? 'text-warning' :
    tone === 'danger' ? 'text-danger' :
    'text-text';
  return (
    <div>
      <p className="text-text-muted mb-0.5">{label}</p>
      <p className={`font-medium ${colorClass}`}>{value}</p>
    </div>
  );
}
