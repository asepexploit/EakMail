/**
 * Auto-reply DM panel per AccountCard.
 * Toggle + custom message — saved to backend, starts/stops the persistent listener.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquareReply, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { http } from '@/lib/http';
import type { AutoReplySettingsDto } from '@eakmail/shared-types';

const DEFAULT_MSG = 'Halo! Untuk memesan produk, silakan hubungi @EakMailBot ya 😊';

function useAutoReplySettings(accountId: string) {
  return useQuery<AutoReplySettingsDto>({
    queryKey: ['auto-reply', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/auto-reply`),
    staleTime: 30_000,
  });
}

function useSetAutoReply(accountId: string) {
  const qc = useQueryClient();
  return useMutation<AutoReplySettingsDto, Error, { enabled: boolean; message?: string }>({
    mutationFn: (body) => http.patch(`/promotion/accounts/${accountId}/auto-reply`, body),
    onSuccess: (data) => {
      qc.setQueryData(['auto-reply', accountId], data);
      qc.invalidateQueries({ queryKey: ['promotion-accounts'] });
    },
  });
}

interface AutoReplyPanelProps {
  accountId: string;
}

export function AutoReplyPanel({ accountId }: AutoReplyPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { data, isLoading } = useAutoReplySettings(accountId);
  const save = useSetAutoReply(accountId);

  // sync draft when data loads
  useEffect(() => {
    if (data) {
      setDraft(data.autoReplyMessage ?? '');
    }
  }, [data]);

  const isEnabled = data?.autoReplyEnabled ?? false;

  function handleToggle() {
    save.mutate({
      enabled: !isEnabled,
      message: draft.trim() || undefined,
    });
  }

  function handleSaveMessage() {
    save.mutate({
      enabled: isEnabled,
      message: draft.trim() || undefined,
    });
  }

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-text-muted hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          <MessageSquareReply className="h-3.5 w-3.5" />
          Auto-Reply DM
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              isEnabled ? 'bg-success/10 text-success' : 'bg-surface text-text-muted'
            }`}>
              {isEnabled ? 'Aktif' : 'Nonaktif'}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text">Balas otomatis pesan DM</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Jika ada yang DM akun ini, langsung dibalas otomatis
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={save.isPending}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                isEnabled ? 'bg-brand' : 'bg-surface-hover'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                isEnabled ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Message template */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-text-muted">
              Pesan balasan (kosong = default)
            </label>
            <textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={DEFAULT_MSG}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-brand resize-none"
            />
            <p className="mt-1 text-[10px] text-text-muted">
              Default: <span className="italic">{DEFAULT_MSG}</span>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleSaveMessage}
              disabled={save.isPending}
              className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20 disabled:opacity-50 transition-colors"
            >
              {save.isPending ? 'Menyimpan...' : 'Simpan Pesan'}
            </button>
            {save.isSuccess && (
              <span className="text-[11px] text-success">✓ Tersimpan</span>
            )}
            {save.isError && (
              <span className="text-[11px] text-danger">{save.error.message}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
