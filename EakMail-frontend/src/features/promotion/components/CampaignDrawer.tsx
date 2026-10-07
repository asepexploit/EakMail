import { useEffect, useState } from 'react';
import { Search, RefreshCw, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { PromotionCampaignDto, PromotionAccountDto, UpsertCampaignRequest } from '@eakmail/shared-types';
import { Drawer } from '@/components/ui';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { strings } from '@/lib/strings';
import { useAccountGroups } from '@/features/promotion/api/usePromotionAccounts';
import type { TelegramGroup } from '@/features/promotion/api/usePromotionAccounts';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const SEND_MODE_OPTIONS = [
  { value: 'ROUND_ROBIN', label: 'Round-robin (gilir akun)' },
  { value: 'ALL_ACCOUNTS', label: 'Semua akun sekaligus' },
  { value: 'RANDOM', label: 'Acak per run' },
];

interface CampaignFormState {
  name: string;
  messages: string[]; // 1–5 variants; index 0 is the primary/only message
  imageUrl: string;
  targetGroupsText: string; // newline-separated
  intervalMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  delayBetweenGroupsSeconds: number;
  sendMode: string;
  accountIds: string[];
}

function toForm(c: PromotionCampaignDto | null): CampaignFormState {
  if (!c) {
    return {
      name: '',
      messages: [''],
      imageUrl: '',
      targetGroupsText: '',
      intervalMinutes: 60,
      activeHoursStart: 8,
      activeHoursEnd: 22,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      delayBetweenGroupsSeconds: 10,
      sendMode: 'ROUND_ROBIN',
      accountIds: [],
    };
  }
  return {
    name: c.name,
    messages: c.messages && c.messages.length > 0 ? c.messages : [c.message],
    imageUrl: c.imageUrl ?? '',
    targetGroupsText: c.targetGroups.join('\n'),
    intervalMinutes: c.intervalMinutes,
    activeHoursStart: c.activeHoursStart,
    activeHoursEnd: c.activeHoursEnd,
    activeDays: c.activeDays,
    delayBetweenGroupsSeconds: c.delayBetweenGroupsSeconds,
    sendMode: c.sendMode,
    accountIds: c.accountIds,
  };
}

// ── GroupPicker ───────────────────────────────────────────────────────────────

interface GroupPickerProps {
  accountIds: string[];
  accounts: PromotionAccountDto[];
  selectedGroups: string[];
  onAdd: (identifier: string) => void;
  onRemove: (identifier: string) => void;
  onAddAll: (identifiers: string[]) => void;
}

function GroupPicker({ accountIds, accounts, selectedGroups, onAdd, onRemove, onAddAll }: GroupPickerProps) {
  const [open, setOpen] = useState(false);
  const [fetchAccountId, setFetchAccountId] = useState(accountIds[0] ?? '');
  const [search, setSearch] = useState('');
  const { data: groups = [], isFetching, refetch } = useAccountGroups(open ? fetchAccountId : null);

  const filtered = groups.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    (g.username?.toLowerCase() ?? '').includes(search.toLowerCase()),
  );

  function identifier(g: TelegramGroup): string {
    return g.username ? `@${g.username}` : g.id;
  }

  const TYPE_LABEL: Record<string, string> = {
    group: 'Grup',
    supergroup: 'Supergrup',
    channel: 'Channel',
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-brand hover:underline"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Pilih dari grup akun
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border bg-surface p-3 space-y-3">
          {/* Account selector */}
          {accountIds.length > 1 && (
            <select
              value={fetchAccountId}
              onChange={(e) => setFetchAccountId(e.target.value)}
              className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs text-text focus:outline-none"
            >
              {accountIds.map((aid) => {
                const acc = accounts.find((a) => a.id === aid);
                return (
                  <option key={aid} value={aid}>
                    {acc?.label ?? aid}
                  </option>
                );
              })}
            </select>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Cari grup..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded border border-border bg-bg py-1.5 pl-7 pr-3 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded p-1.5 text-text-muted hover:text-brand"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isFetching && groups.length === 0 ? (
            <p className="text-center text-xs text-text-muted py-4">Memuat daftar grup...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-text-muted py-4">
              {groups.length === 0 ? 'Tidak ada grup ditemukan' : 'Tidak ada hasil pencarian'}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{filtered.length} grup ditemukan</span>
                <button
                  type="button"
                  className="text-brand hover:underline"
                  onClick={() => onAddAll(filtered.map(identifier))}
                >
                  + Tambah semua
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filtered.map((g) => {
                  const id = identifier(g);
                  const checked = selectedGroups.includes(id);
                  return (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => checked ? onRemove(id) : onAdd(id)}
                        className="accent-brand shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text">{g.title}</p>
                        <p className="truncate text-xs text-text-muted">
                          {g.username ? `@${g.username}` : g.id}
                          {' · '}
                          {TYPE_LABEL[g.type]}
                          {g.memberCount != null ? ` · ${g.memberCount.toLocaleString('id-ID')} anggota` : ''}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface CampaignDrawerProps {
  open: boolean;
  onClose: () => void;
  campaign: PromotionCampaignDto | null;
  accounts: PromotionAccountDto[];
  onSubmit: (data: UpsertCampaignRequest) => void;
  isSubmitting: boolean;
}

export function CampaignDrawer({
  open,
  onClose,
  campaign,
  accounts,
  onSubmit,
  isSubmitting,
}: CampaignDrawerProps) {
  const [form, setForm] = useState(toForm(null));

  useEffect(() => {
    if (open) setForm(toForm(campaign));
  }, [open, campaign]);

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day].sort(),
    }));
  }

  function toggleAccount(id: string) {
    setForm((prev) => ({
      ...prev,
      accountIds: prev.accountIds.includes(id)
        ? prev.accountIds.filter((a) => a !== id)
        : [...prev.accountIds, id],
    }));
  }

  function setMessage(idx: number, value: string) {
    setForm((p) => {
      const msgs = [...p.messages];
      msgs[idx] = value;
      return { ...p, messages: msgs };
    });
  }

  function addVariant() {
    if (form.messages.length >= 5) return;
    setForm((p) => ({ ...p, messages: [...p.messages, ''] }));
  }

  function removeVariant(idx: number) {
    if (form.messages.length <= 1) return;
    setForm((p) => ({ ...p, messages: p.messages.filter((_, i) => i !== idx) }));
  }

  function handleSubmit() {
    const targetGroups = form.targetGroupsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const messages = form.messages.map((m) => m.trim()).filter(Boolean);

    onSubmit({
      name: form.name,
      message: messages[0] ?? '',
      messages,
      imageUrl: form.imageUrl || null,
      targetGroups,
      intervalMinutes: form.intervalMinutes,
      activeHoursStart: form.activeHoursStart,
      activeHoursEnd: form.activeHoursEnd,
      activeDays: form.activeDays,
      delayBetweenGroupsSeconds: form.delayBetweenGroupsSeconds,
      sendMode: form.sendMode as UpsertCampaignRequest['sendMode'],
      accountIds: form.accountIds,
    });
  }

  const canSubmit =
    form.name.trim() !== '' &&
    (form.messages[0]?.trim() ?? '') !== '' &&
    form.accountIds.length > 0 &&
    form.activeDays.length > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={campaign ? 'Edit Kampanye' : 'Buat Kampanye Baru'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {strings.actions.cancel}
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!canSubmit}>
            {strings.actions.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Nama Kampanye"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />

        <div>
          <label className="mb-2 block text-xs font-medium text-text-muted">
            Akun yang Dipakai <span className="text-danger">*</span>
          </label>
          {accounts.length === 0 ? (
            <p className="text-xs text-text-muted">Belum ada akun promosi. Tambah dulu di halaman Akun Promosi.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <label key={acc.id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={form.accountIds.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    className="accent-brand"
                  />
                  <span>{acc.label}</span>
                  <span className="text-xs text-text-muted">({acc.phone})</span>
                  <span className={`ml-auto text-xs ${acc.status === 'CONNECTED' ? 'text-success' : 'text-text-muted'}`}>
                    {acc.status}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-text-muted">
              Pesan (Markdown) <span className="text-danger">*</span>
              {form.messages.length > 1 && (
                <span className="ml-1.5 font-normal text-brand">
                  — {form.messages.length} varian (dipilih acak per akun)
                </span>
              )}
            </label>
            {form.messages.length < 5 && (
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah varian
              </button>
            )}
          </div>
          <div className="space-y-3">
            {form.messages.map((msg, idx) => (
              <div key={idx} className="relative">
                {form.messages.length > 1 && (
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-text-muted">Varian {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="flex items-center gap-1 text-[11px] text-danger hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                      Hapus
                    </button>
                  </div>
                )}
                <Textarea
                  rows={5}
                  value={msg}
                  onChange={(e) => setMessage(idx, e.target.value)}
                  placeholder={idx === 0 ? 'Halo! Cek produk terbaru kami di toko kami 🎉' : `Pesan varian ${idx + 1}...`}
                />
              </div>
            ))}
          </div>
        </div>

        <Input
          label="URL Gambar (opsional)"
          value={form.imageUrl}
          mono
          placeholder="https://..."
          onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">
            Target Grup / Channel{' '}
            <span className="font-normal text-text-muted">(opsional)</span>
          </label>
          <p className="mb-2 text-[11px] text-text-muted leading-relaxed">
            Kosongkan untuk otomatis kirim ke semua grup aktif yang dipantau oleh akun terpilih.
            Isi manual jika ingin menargetkan grup tertentu saja (@username atau chat_id, satu per baris).
          </p>
          <Textarea
            rows={3}
            value={form.targetGroupsText}
            onChange={(e) => setForm((p) => ({ ...p, targetGroupsText: e.target.value }))}
            placeholder={'Kosongkan untuk auto-detect dari MonitoredGroup\natau isi: @grupku'}
          />
          {form.accountIds.length > 0 && (
            <GroupPicker
              accountIds={form.accountIds}
              accounts={accounts}
              selectedGroups={form.targetGroupsText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)}
              onAdd={(identifier) => {
                const current = form.targetGroupsText
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (!current.includes(identifier)) {
                  setForm((p) => ({
                    ...p,
                    targetGroupsText: [...current, identifier].join('\n'),
                  }));
                }
              }}
              onRemove={(identifier) => {
                const current = form.targetGroupsText
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .filter((g) => g !== identifier);
                setForm((p) => ({ ...p, targetGroupsText: current.join('\n') }));
              }}
              onAddAll={(identifiers) => {
                const current = form.targetGroupsText
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                const merged = Array.from(new Set([...current, ...identifiers]));
                setForm((p) => ({ ...p, targetGroupsText: merged.join('\n') }));
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Interval (menit)"
            type="number"
            min={1}
            max={10080}
            value={form.intervalMinutes}
            onChange={(e) => setForm((p) => ({ ...p, intervalMinutes: Number(e.target.value) }))}
          />
          <Input
            label="Delay antar grup (detik)"
            type="number"
            min={0}
            max={300}
            value={form.delayBetweenGroupsSeconds}
            onChange={(e) => setForm((p) => ({ ...p, delayBetweenGroupsSeconds: Number(e.target.value) }))}
          />
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              className="accent-brand"
              checked={form.activeHoursStart === 0 && form.activeHoursEnd === 23}
              onChange={(e) => {
                if (e.target.checked) {
                  setForm((p) => ({ ...p, activeHoursStart: 0, activeHoursEnd: 23 }));
                } else {
                  setForm((p) => ({ ...p, activeHoursStart: 8, activeHoursEnd: 22 }));
                }
              }}
            />
            <span className="font-medium">24 jam penuh (kirim kapan saja)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Jam aktif mulai (0–23)"
              type="number"
              min={0}
              max={23}
              value={form.activeHoursStart}
              disabled={form.activeHoursStart === 0 && form.activeHoursEnd === 23}
              onChange={(e) => setForm((p) => ({ ...p, activeHoursStart: Number(e.target.value) }))}
            />
            <Input
              label="Jam aktif selesai (0–23)"
              type="number"
              min={0}
              max={23}
              value={form.activeHoursEnd}
              disabled={form.activeHoursStart === 0 && form.activeHoursEnd === 23}
              onChange={(e) => setForm((p) => ({ ...p, activeHoursEnd: Number(e.target.value) }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-text-muted">Hari Aktif</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  form.activeDays.includes(idx)
                    ? 'bg-brand text-white'
                    : 'bg-surface text-text-muted hover:bg-surface-hover'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <Select
          label="Mode Kirim"
          options={SEND_MODE_OPTIONS}
          value={form.sendMode}
          onChange={(e) => setForm((p) => ({ ...p, sendMode: e.target.value }))}
        />

      </div>
    </Drawer>
  );
}
