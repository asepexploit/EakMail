/**
 * Bulk join panel: one textarea → one backend call → all CONNECTED accounts join at once.
 * Backend runs all accounts in parallel (POST /promotion/accounts/join-all).
 */
import { useState } from 'react';
import { LogIn, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { http } from '@/lib/http';
import { Button } from '@/components/ui/Button';
import type { PromotionAccountDto } from '@eakmail/shared-types';
import { PromotionAccountStatus } from '@eakmail/shared-types';

interface JoinGroupResult {
  group: string;
  ok: boolean;
  alreadyMember?: boolean;
  error?: string;
}

interface AccountJoinResult {
  accountId: string;
  label: string;
  phone: string;
  results: JoinGroupResult[];
}

interface JoinAllResponse {
  accounts: AccountJoinResult[];
}

function useJoinAll() {
  return useMutation<JoinAllResponse, Error, string[]>({
    mutationFn: (groups) => http.post('/promotion/accounts/join-all', { groups }),
  });
}

interface JoinAllPanelProps {
  accounts: PromotionAccountDto[];
}

export function JoinAllPanel({ accounts }: JoinAllPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const mutation = useJoinAll();

  const connectedCount = accounts.filter(
    (a) => a.status === PromotionAccountStatus.CONNECTED,
  ).length;

  async function handleJoin() {
    const groups = input.split('\n').map((s) => s.trim()).filter(Boolean);
    if (groups.length === 0 || connectedCount === 0) return;
    mutation.reset();
    await mutation.mutateAsync(groups).catch(() => undefined);
  }

  const accountResults = mutation.data?.accounts ?? [];
  const totalOk = accountResults.reduce((s, a) => s + a.results.filter((r) => r.ok).length, 0);
  const totalFail = accountResults.reduce((s, a) => s + a.results.filter((r) => !r.ok).length, 0);

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text hover:bg-surface/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-brand" />
          Join Semua Akun ke Grup / Channel
          {connectedCount > 0 && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand font-medium">
              {connectedCount} akun terhubung
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {connectedCount === 0 ? (
            <p className="text-xs text-text-muted">Tidak ada akun yang terhubung.</p>
          ) : (
            <>
              <p className="text-xs text-text-muted">
                Masukkan link/username grup — semua <strong>{connectedCount} akun</strong> yang terhubung akan join sekaligus.
              </p>

              <textarea
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={mutation.isPending}
                placeholder={'https://t.me/grupku\n@namagrup\nt.me/channel\n-1001234567890'}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand resize-none font-mono disabled:opacity-50"
              />

              <Button
                size="sm"
                onClick={handleJoin}
                isLoading={mutation.isPending}
                disabled={!input.trim() || mutation.isPending}
                className="w-full"
              >
                <LogIn className="h-3.5 w-3.5" />
                {mutation.isPending
                  ? `Joining di ${connectedCount} akun...`
                  : `Join ke ${connectedCount} Akun Sekaligus`}
              </Button>

              {mutation.isPending && (
                <p className="text-center text-xs text-text-muted animate-pulse">
                  Mengirim join request ke semua akun secara paralel... (tanpa delay antar-grup)
                </p>
              )}

              {/* Error from HTTP */}
              {mutation.isError && (
                <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                  {mutation.error.message}
                </div>
              )}

              {/* Results */}
              {accountResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs font-medium">
                    {totalOk > 0 && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {totalOk} berhasil
                      </span>
                    )}
                    {totalFail > 0 && (
                      <span className="flex items-center gap-1 text-danger">
                        <XCircle className="h-3.5 w-3.5" />
                        {totalFail} gagal
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    {accountResults.map((acc) => {
                      const ok = acc.results.filter((r) => r.ok).length;
                      const fail = acc.results.filter((r) => !r.ok).length;
                      return (
                        <div key={acc.accountId} className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div>
                              <span className="text-xs font-medium text-text">{acc.label}</span>
                              <span className="text-xs text-text-muted ml-1.5 font-mono">+{acc.phone}</span>
                            </div>
                            <span className="flex items-center gap-1.5 text-xs">
                              {ok > 0 && <span className="text-success">{ok} ✓</span>}
                              {fail > 0 && <span className="text-danger">{fail} ✗</span>}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            {acc.results.map((r, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[11px]">
                                {r.ok ? (
                                  <CheckCircle className="h-3 w-3 text-success shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-danger shrink-0 mt-0.5" />
                                )}
                                <span className="font-mono truncate text-text-muted">{r.group}</span>
                                {r.alreadyMember && (
                                  <span className="text-text-muted/70 shrink-0 flex items-center gap-0.5">
                                    <AlertCircle className="h-2.5 w-2.5" />
                                    sudah member
                                  </span>
                                )}
                                {r.error && <span className="text-danger shrink-0 truncate">{r.error}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
