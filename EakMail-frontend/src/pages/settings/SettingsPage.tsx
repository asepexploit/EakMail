import { useEffect, useState } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { Badge, Button, Card, Input, SecretField } from '@/components/ui';
import { strings } from '@/lib/strings';
import { PageHeader } from '@/components/layout/PageHeader';
import { QueryBoundary } from '@/features/shared/QueryBoundary';
import { featureStrings } from '@/features/shared/feature-strings';
import { useCurrentUser } from '@/features/auth/useAuth';
import {
  useSettings, useSetupTotp, useEnableTotp, useDisableTotp, useUpdatePakasir,
  useBotProfile, useUpdateBotProfile,
} from '@/features/settings/api/useSettings';
import type { PakasirConfigUpdate } from '@/lib/api';
import { cn } from '@/lib/cn';

/**
 * Settings (Pengaturan) page (DESIGN_SYSTEM.md §Settings, TASKS Phase 7).
 * Bind address/port and secret flags come from GET /api/settings — no hardcoded values.
 * Secrets are write-only per ARCHITECTURE.md §10 (the server never returns secret values).
 */
export function SettingsPage() {
  const userQuery = useCurrentUser();
  const settingsQuery = useSettings();

  // TOTP flow state
  const [totpPhase, setTotpPhase] = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle');
  const [totpCode, setTotpCode] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [qrSecret, setQrSecret] = useState('');

  const setupTotp = useSetupTotp();
  const enableTotp = useEnableTotp();
  const disableTotp = useDisableTotp();
  const updatePakasir = useUpdatePakasir();
  const botProfileQuery = useBotProfile();
  const updateBotProfile = useUpdateBotProfile();

  const [botDraft, setBotDraft] = useState({ name: '', description: '', shortDescription: '' });

  useEffect(() => {
    if (botProfileQuery.data) {
      setBotDraft({
        name: botProfileQuery.data.name,
        description: botProfileQuery.data.description,
        shortDescription: botProfileQuery.data.shortDescription,
      });
    }
  }, [botProfileQuery.data]);

  const settings = settingsQuery.data;
  const totpEnabled = userQuery.data?.totpEnabled ?? false;

  // Pakasir config draft — synced from server on first load.
  const [pakasirDraft, setPakasirDraft] = useState<PakasirConfigUpdate>({
    mode: 'production',
    baseUrl: '', slug: '', apiKey: '', webhookSecret: '',
  });

  useEffect(() => {
    if (settings?.pakasir) {
      setPakasirDraft((d) => ({
        ...d,
        mode: settings.pakasir.mode,
        baseUrl: settings.pakasir.baseUrl,
        slug: settings.pakasir.slug,
      }));
    }
  }, [settings?.pakasir]);

  async function handleStartSetup() {
    const result = await setupTotp.mutateAsync();
    setOtpauthUri(result.otpauthUri);
    setQrSecret(result.secret);
    setTotpCode('');
    setTotpPhase('setup');
  }

  async function handleConfirmEnable() {
    await enableTotp.mutateAsync(totpCode);
    setTotpPhase('idle');
    setTotpCode('');
  }

  async function handleConfirmDisable() {
    await disableTotp.mutateAsync(totpCode);
    setTotpPhase('idle');
    setTotpCode('');
  }

  return (
    <div className="space-y-5">
      <PageHeader title={strings.nav.settings} description={featureStrings.settings.subtitle} />

      <QueryBoundary
        isLoading={settingsQuery.isLoading}
        isError={settingsQuery.isError}
        onRetry={settingsQuery.refetch}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={featureStrings.settings.sections.general}>
            <div className="space-y-4">
              <Input
                label={featureStrings.settings.bindAddress}
                value={settings?.host ?? '…'}
                readOnly
                mono
                helperText={featureStrings.settings.readOnlyHint}
              />
              <Input
                label={featureStrings.settings.port}
                value={settings ? String(settings.port) : '…'}
                readOnly
                mono
              />
            </div>
          </Card>

          <Card title={featureStrings.settings.sections.security}>
            <div className="space-y-4">
              {/* TOTP status + actions */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-text">{featureStrings.settings.totp}</span>
                {totpEnabled ? (
                  <Badge tone="success">{featureStrings.settings.totpEnabled}</Badge>
                ) : (
                  <Badge tone="neutral">{featureStrings.settings.totpDisabled}</Badge>
                )}
              </div>

              {totpPhase === 'idle' && (
                <div className="flex gap-2">
                  {!totpEnabled ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={setupTotp.isPending}
                      onClick={handleStartSetup}
                    >
                      Aktifkan 2FA
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setTotpCode('');
                        setTotpPhase('disable');
                      }}
                    >
                      Nonaktifkan 2FA
                    </Button>
                  )}
                </div>
              )}

              {totpPhase === 'setup' && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-text">Scan QR ini dengan aplikasi authenticator</p>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUri)}`}
                    alt="TOTP QR code"
                    className="rounded border border-border"
                    width={180}
                    height={180}
                  />
                  <p className="font-mono text-xs text-text-muted break-all">
                    Kunci manual: {qrSecret}
                  </p>
                  <p className="text-xs text-text-muted">
                    Setelah scan, masukkan kode 6-digit dari aplikasi untuk mengonfirmasi.
                  </p>
                  <Input
                    label="Kode konfirmasi"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    mono
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      isLoading={enableTotp.isPending}
                      disabled={totpCode.length !== 6}
                      onClick={handleConfirmEnable}
                    >
                      Konfirmasi & Aktifkan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTotpPhase('idle')}
                    >
                      {strings.actions.cancel}
                    </Button>
                  </div>
                </div>
              )}

              {totpPhase === 'disable' && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm text-text">
                    Masukkan kode TOTP dari aplikasi untuk menonaktifkan 2FA.
                  </p>
                  <Input
                    label="Kode TOTP"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    mono
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={disableTotp.isPending}
                      disabled={totpCode.length !== 6}
                      onClick={handleConfirmDisable}
                    >
                      Nonaktifkan 2FA
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTotpPhase('idle')}
                    >
                      {strings.actions.cancel}
                    </Button>
                  </div>
                </div>
              )}

              <SecretField
                label={featureStrings.settings.sessionSecret}
                isSet={settings?.secrets.sessionSecretSet}
                helperText={featureStrings.settings.readOnlyHint}
                disabled
              />
            </div>
          </Card>

          <Card title={featureStrings.settings.sections.payment} className="lg:col-span-2">
            <div className="space-y-5">
              {/* Mode selector */}
              <div>
                <p className="mb-2 text-sm font-medium text-text">Mode Pakasir</p>
                <div className="flex gap-2">
                  {(['production', 'testing'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPakasirDraft((d) => ({ ...d, mode: m }))}
                      className={cn(
                        'flex-1 rounded-md border py-2.5 text-sm font-medium transition',
                        pakasirDraft.mode === m
                          ? m === 'production'
                            ? 'border-success bg-success/10 text-success'
                            : 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                          : 'border-border text-text-muted hover:border-border/80',
                      )}
                    >
                      {m === 'production' ? '✅ Produksi (.env)' : '🧪 Testing (custom)'}
                    </button>
                  ))}
                </div>
                {pakasirDraft.mode === 'production' && (
                  <p className="mt-2 text-xs text-text-muted">
                    Menggunakan nilai dari <span className="font-mono">.env</span>: PAKASIR_BASE_URL, PAKASIR_SLUG, PAKASIR_API_KEY, PAKASIR_WEBHOOK_SECRET.
                    {' '}Status: API Key {settings?.secrets.pakasirApiKeySet ? '✓ diset' : '✗ kosong'}, Webhook {settings?.secrets.pakasirWebhookSecretSet ? '✓ diset' : '✗ kosong'}.
                  </p>
                )}
              </div>

              {/* Testing mode fields */}
              {pakasirDraft.mode === 'testing' && (
                <div className="rounded-md border border-brand-accent/30 bg-brand-accent/5 p-4 space-y-4">
                  <p className="text-xs text-text-muted">
                    Nilai di bawah akan digunakan menggantikan <span className="font-mono">.env</span>. Kosongkan untuk tetap memakai nilai .env sebagai fallback.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Base URL (misal: https://sandbox.pakasir.com)"
                      value={pakasirDraft.baseUrl ?? ''}
                      mono
                      placeholder="https://app.pakasir.com"
                      onChange={(e) => setPakasirDraft((d) => ({ ...d, baseUrl: e.target.value }))}
                    />
                    <Input
                      label="Slug"
                      value={pakasirDraft.slug ?? ''}
                      mono
                      placeholder="nama-toko-testing"
                      onChange={(e) => setPakasirDraft((d) => ({ ...d, slug: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SecretField
                      label="API Key (Testing)"
                      isSet={settings?.pakasir.apiKeySet && settings.pakasir.mode === 'testing'}
                      value={pakasirDraft.apiKey ?? ''}
                      onValueChange={(v) => setPakasirDraft((d) => ({ ...d, apiKey: v }))}
                    />
                    <SecretField
                      label="Webhook Secret (Testing)"
                      isSet={settings?.pakasir.webhookSecretSet && settings.pakasir.mode === 'testing'}
                      value={pakasirDraft.webhookSecret ?? ''}
                      onValueChange={(v) => setPakasirDraft((d) => ({ ...d, webhookSecret: v }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => updatePakasir.mutate(pakasirDraft)}
                  isLoading={updatePakasir.isPending}
                >
                  {strings.actions.save} Konfigurasi Pakasir
                </Button>
              </div>
            </div>
          </Card>

          {/* Bot profile card */}
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-text">Profil Bot Telegram</h3>
            </div>

            {botProfileQuery.isLoading ? (
              <div className="flex items-center gap-2 py-4 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mengambil profil bot...</span>
              </div>
            ) : botProfileQuery.isError ? (
              <p className="text-sm text-danger">
                Gagal mengambil profil bot. Pastikan STOREFRONT_BOT_TOKEN sudah dikonfigurasi.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Current info preview */}
                {botProfileQuery.data && (
                  <div className="rounded-lg border border-border bg-surface/60 px-3 py-2.5 text-xs text-text-muted space-y-0.5">
                    <p className="font-medium text-text-muted/80 mb-1">Profil saat ini</p>
                    <p><span className="text-text-muted/60">Nama: </span><span className="text-text">{botProfileQuery.data.name || '—'}</span></p>
                    <p><span className="text-text-muted/60">Deskripsi: </span><span className="text-text">{botProfileQuery.data.description || '—'}</span></p>
                    <p><span className="text-text-muted/60">Deskripsi singkat: </span><span className="text-text">{botProfileQuery.data.shortDescription || '—'}</span></p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Nama bot"
                    placeholder="Nama tampilan bot (maks 64 karakter)"
                    value={botDraft.name}
                    onChange={(e) => setBotDraft((d) => ({ ...d, name: e.target.value }))}
                    maxLength={64}
                  />
                  <Input
                    label="Deskripsi singkat"
                    placeholder="Ditampilkan di profil bot (maks 120 karakter)"
                    value={botDraft.shortDescription}
                    onChange={(e) => setBotDraft((d) => ({ ...d, shortDescription: e.target.value }))}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    Deskripsi bot
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    rows={4}
                    maxLength={512}
                    placeholder="Ditampilkan saat pengguna membuka bot pertama kali — 'Apa yang bisa bot ini lakukan?' (maks 512 karakter)"
                    value={botDraft.description}
                    onChange={(e) => setBotDraft((d) => ({ ...d, description: e.target.value }))}
                  />
                  <p className="mt-1 text-xs text-text-muted text-right">
                    {botDraft.description.length}/512
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateBotProfile.mutate(botDraft)}
                    isLoading={updateBotProfile.isPending}
                  >
                    Simpan Profil Bot
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </QueryBoundary>
    </div>
  );
}
