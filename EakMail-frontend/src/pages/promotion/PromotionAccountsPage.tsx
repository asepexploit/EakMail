import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Clock, Ban, Plus, Trash2, KeyRound, Send, Users, Radio, AlertCircle, UserPen, Search, RotateCcw, HeartPulse, Snowflake } from 'lucide-react';
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
import { strings } from '@/lib/strings';

type LoginStep = 'idle' | 'phone' | 'code' | 'password';

const STATUS_ICON: Record<string, React.ReactNode> = {
  [PromotionAccountStatus.CONNECTED]: <Wifi className="h-4 w-4 text-success" />,
  [PromotionAccountStatus.DISCONNECTED]: <WifiOff className="h-4 w-4 text-text-muted" />,
  [PromotionAccountStatus.FLOOD_WAIT]: <Clock className="h-4 w-4 text-warning" />,
  [PromotionAccountStatus.BANNED]: <Ban className="h-4 w-4 text-danger" />,
  [PromotionAccountStatus.FROZEN]: <Snowflake className="h-4 w-4 text-info" />,
};

const STATUS_LABEL: Record<string, string> = {
  [PromotionAccountStatus.CONNECTED]: 'Terhubung',
  [PromotionAccountStatus.DISCONNECTED]: 'Terputus',
  [PromotionAccountStatus.FLOOD_WAIT]: 'Flood Wait',
  [PromotionAccountStatus.BANNED]: 'Diblokir',
  [PromotionAccountStatus.FROZEN]: 'Dibekukan',
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

  useEffect(() => {
    if (!isLoading && accounts.length > 0 && !healthCheckRan.current) {
      healthCheckRan.current = true;
      healthCheck.mutate();
    }
  }, [isLoading, accounts.length]);

  function openAddModal() {
    setStep('phone');
    setLabel('');
    setPhone('');
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Akun Promosi</h1>
          <p className="text-sm text-text-muted">
            Akun Telegram (MTProto) untuk mengirim pesan promosi ke grup
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
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {healthCheck.data && !healthCheck.isPending && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
          healthCheck.data.dead.length > 0
            ? 'bg-danger/10 text-danger'
            : 'bg-success/10 text-success'
        }`}>
          <HeartPulse className="h-4 w-4 shrink-0" />
          {healthCheck.data.dead.length > 0
            ? `${healthCheck.data.dead.length} akun sesi mati terdeteksi — status diperbarui`
            : `${healthCheck.data.checked} akun dicek — semua sesi aktif`
          }
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-text-muted">{strings.common.loading}</p>
      ) : accounts.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <KeyRound className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada akun promosi. Tambah akun untuk mulai kampanye.</p>
        </Card>
      ) : (
        <>
          <AutoSearchPanel />
          <JoinAllPanel accounts={accounts} />
          <BulkJoinScheduledPanel />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => (
              <AccountCard
                key={acc.id}
                account={acc}
                onDelete={() => deleteAccount.mutate(acc.id)}
                onRelogin={() => {
                  setLabel(acc.label);
                  setPhone(acc.phone);
                  openAddModal();
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Login Dialog */}
      <Dialog open={step !== 'idle'} onClose={closeModal} title="Tambah Akun Promosi" size="sm">
        {step === 'phone' && (
          <div className="space-y-4">
            <Input
              label="Label akun"
              placeholder="Akun Promosi 1"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Input
              label="Nomor HP"
              placeholder="+6281234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSendCode} isLoading={startLogin.isPending}>
                Kirim Kode OTP
              </Button>
            </div>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Kode OTP dikirim ke <strong>{phone}</strong> via Telegram/SMS.
            </p>
            <Input
              label="Kode OTP"
              placeholder="12345"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSubmitCode} isLoading={submitCode.isPending}>
                Verifikasi
              </Button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Akun ini menggunakan 2FA. Masukkan password Telegram.
            </p>
            <Input
              label="Password 2FA"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>Batal</Button>
              <Button onClick={handleSubmitPassword} isLoading={submitCode.isPending}>
                Masuk
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function AccountCard({ account, onDelete, onRelogin }: { account: PromotionAccountDto; onDelete: () => void; onRelogin: () => void }) {
  const { data: stats } = useAccountStats(account.id);
  const isConnected = account.status === PromotionAccountStatus.CONNECTED;
  const needsAttention = account.status === PromotionAccountStatus.DISCONNECTED || account.status === PromotionAccountStatus.BANNED || account.status === PromotionAccountStatus.FROZEN;
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialogsOpen, setDialogsOpen] = useState(false);

  return (
    <Card className={`flex flex-col gap-0 p-0 overflow-hidden ${needsAttention ? `ring-1 ${account.status === PromotionAccountStatus.FROZEN ? 'ring-info/30' : 'ring-danger/30'}` : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text">{account.label}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              account.status === PromotionAccountStatus.CONNECTED ? 'bg-success/10 text-success' :
              account.status === PromotionAccountStatus.FLOOD_WAIT ? 'bg-warning/10 text-warning' :
              account.status === PromotionAccountStatus.FROZEN ? 'bg-info/10 text-info' :
              account.status === PromotionAccountStatus.BANNED ? 'bg-danger/10 text-danger' :
              'bg-danger/10 text-danger'
            }`}>
              {STATUS_ICON[account.status]}
              {STATUS_LABEL[account.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted font-mono">+{account.phone}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isConnected && (
            <button
              onClick={() => setDialogsOpen(true)}
              className="rounded p-1.5 text-text-muted hover:bg-brand/10 hover:text-brand focus:outline-none transition-colors"
              title="Cek grup & channel Telegram"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
          {isConnected && (
            <button
              onClick={() => setProfileOpen(true)}
              className="rounded p-1.5 text-text-muted hover:bg-primary/10 hover:text-primary focus:outline-none transition-colors"
              title="Edit profil Telegram"
            >
              <UserPen className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger focus:outline-none transition-colors"
            title="Hapus akun"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status alert banner */}
      {needsAttention && (
        <div className={`mx-4 mb-2 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${
          account.status === PromotionAccountStatus.BANNED
            ? 'bg-danger/10 text-danger'
            : account.status === PromotionAccountStatus.FROZEN
            ? 'bg-info/10 text-info'
            : 'bg-warning/10 text-warning'
        }`}>
          {account.status === PromotionAccountStatus.BANNED ? (
            <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : account.status === PromotionAccountStatus.FROZEN ? (
            <Snowflake className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-medium leading-snug">
              {STATUS_DETAIL[account.status]}
            </p>
            {(account.status === PromotionAccountStatus.DISCONNECTED || account.status === PromotionAccountStatus.FROZEN) && (
              <button
                onClick={onRelogin}
                className="mt-1.5 inline-flex items-center gap-1 rounded bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand/90 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Login Ulang
              </button>
            )}
          </div>
        </div>
      )}

      <ProfileEditModal
        accountId={account.id}
        accountLabel={account.label}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <TelegramDialogsModal
        accountId={account.id}
        accountLabel={account.label}
        open={dialogsOpen}
        onClose={() => setDialogsOpen(false)}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-border border-y border-border bg-surface/50">
        <StatCell
          icon={<Send className="h-3.5 w-3.5" />}
          label="Total Terkirim"
          value={stats ? stats.totalSent.toLocaleString('id-ID') : '—'}
          accent={isConnected && stats && stats.totalSent > 0 ? 'success' : undefined}
        />
        <StatCell
          icon={<Users className="h-3.5 w-3.5" />}
          label="Grup Aktif"
          value={stats ? stats.activeGroupCount.toLocaleString('id-ID') : '—'}
        />
        <StatCell
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Kampanye"
          value={stats ? stats.campaignCount.toLocaleString('id-ID') : '—'}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 space-y-1.5">
        {account.floodUntil && (
          <div className="flex items-center gap-1.5 text-xs text-warning">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Flood wait s/d {new Date(account.floodUntil).toLocaleString('id-ID')}</span>
          </div>
        )}
        {stats?.totalFailed != null && stats.totalFailed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{stats.totalFailed} pengiriman gagal</span>
          </div>
        )}
        {stats?.lastSent ? (
          <div className="text-xs text-text-muted">
            <span className="text-text-muted">Terakhir kirim: </span>
            <span>{stats.lastSent.targetGroup}</span>
            <span className="mx-1">·</span>
            <span>{new Date(stats.lastSent.sentAt).toLocaleString('id-ID')}</span>
            <div className="truncate text-text-muted/70">via {stats.lastSent.campaignName}</div>
          </div>
        ) : account.lastUsedAt ? (
          <p className="text-xs text-text-muted">
            Terakhir aktif: {new Date(account.lastUsedAt).toLocaleString('id-ID')}
          </p>
        ) : (
          <p className="text-xs text-text-muted/50">Belum pernah mengirim</p>
        )}
      </div>

      {isConnected && <AccountJoinPanel accountId={account.id} />}
      {isConnected && <AutoJoinSettings accountId={account.id} />}
      {isConnected && <AutoReplyPanel accountId={account.id} />}
    </Card>
  );
}

function StatCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'success' | 'warning' | 'danger';
}) {
  const accentClass = accent === 'success' ? 'text-success' : accent === 'warning' ? 'text-warning' : accent === 'danger' ? 'text-danger' : 'text-text';
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-3">
      <span className="text-text-muted">{icon}</span>
      <span className={`text-lg font-bold leading-none ${accentClass}`}>{value}</span>
      <span className="text-center text-[10px] leading-tight text-text-muted">{label}</span>
    </div>
  );
}
