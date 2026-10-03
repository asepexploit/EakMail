import { useState } from 'react';
import { Wifi, WifiOff, Clock, Ban, Plus, Trash2, KeyRound, Send, Users, Radio, AlertCircle } from 'lucide-react';
import { AccountJoinPanel } from '@/features/promotion/components/AccountJoinPanel';
import { AutoJoinSettings } from '@/features/promotion/components/AutoJoinSettings';
import type { PromotionAccountDto } from '@eakmail/shared-types';
import { PromotionAccountStatus } from '@eakmail/shared-types';
import {
  usePromotionAccounts,
  useStartPromotionLogin,
  useSubmitPromotionCode,
  useDeletePromotionAccount,
  useAccountStats,
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
};

const STATUS_LABEL: Record<string, string> = {
  [PromotionAccountStatus.CONNECTED]: 'Terhubung',
  [PromotionAccountStatus.DISCONNECTED]: 'Terputus',
  [PromotionAccountStatus.FLOOD_WAIT]: 'Flood Wait',
  [PromotionAccountStatus.BANNED]: 'Diblokir',
};

export default function PromotionAccountsPage() {
  const { data: accounts = [], isLoading } = usePromotionAccounts();
  const startLogin = useStartPromotionLogin();
  const submitCode = useSubmitPromotionCode();
  const deleteAccount = useDeletePromotionAccount();

  const [step, setStep] = useState<LoginStep>('idle');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">{strings.common.loading}</p>
      ) : accounts.length === 0 ? (
        <Card className="py-12 text-center text-text-muted">
          <KeyRound className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>Belum ada akun promosi. Tambah akun untuk mulai kampanye.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              onDelete={() => deleteAccount.mutate(acc.id)}
            />
          ))}
        </div>
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

function AccountCard({ account, onDelete }: { account: PromotionAccountDto; onDelete: () => void }) {
  const { data: stats } = useAccountStats(account.id);
  const isConnected = account.status === PromotionAccountStatus.CONNECTED;

  return (
    <Card className="flex flex-col gap-0 p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text">{account.label}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              account.status === PromotionAccountStatus.CONNECTED ? 'bg-success/10 text-success' :
              account.status === PromotionAccountStatus.FLOOD_WAIT ? 'bg-warning/10 text-warning' :
              account.status === PromotionAccountStatus.BANNED ? 'bg-danger/10 text-danger' :
              'bg-surface text-text-muted'
            }`}>
              {STATUS_ICON[account.status]}
              {STATUS_LABEL[account.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted font-mono">+{account.phone}</p>
        </div>
        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger focus:outline-none transition-colors"
          title="Hapus akun"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

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
          label="Grup Dijangkau"
          value={stats ? stats.uniqueGroupsSent.toLocaleString('id-ID') : '—'}
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
