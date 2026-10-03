/**
 * Collapsible panel on an AccountCard for manually joining Telegram groups.
 * Accepts t.me links, @usernames, or plain usernames — one per line.
 */
import { useState } from 'react';
import { LogIn, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useJoinAccountGroups } from '@/features/promotion/api/usePromotionAccounts';
import type { JoinGroupResult } from '@/features/promotion/api/usePromotionAccounts';

interface AccountJoinPanelProps {
  accountId: string;
}

export function AccountJoinPanel({ accountId }: AccountJoinPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<JoinGroupResult[] | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const joinMutation = useJoinAccountGroups(accountId);

  async function handleJoin() {
    const groups = input
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (groups.length === 0) return;
    setResults(null);
    setQueueCount(groups.length);
    try {
      const res = await joinMutation.mutateAsync(groups);
      setResults(res.results);
    } catch (e) {
      setResults([{
        group: '—',
        ok: false,
        error: e instanceof Error ? e.message : 'Gagal terhubung ke server',
      }]);
    } finally {
      setQueueCount(0);
    }
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-text-muted hover:text-text transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <LogIn className="h-3.5 w-3.5" />
          Join Grup / Channel
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <textarea
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              'https://t.me/BEBAS_SHARE_Link_Apk\n@grupku\nt.me/channelpromo\n-1001234567890'
            }
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand resize-none font-mono"
          />

          <Button
            size="sm"
            onClick={handleJoin}
            isLoading={joinMutation.isPending}
            disabled={!input.trim()}
            className="w-full"
          >
            <LogIn className="h-3.5 w-3.5" />
            {joinMutation.isPending
              ? `Joining ${queueCount} grup (random delay)...`
              : 'Join Semua'}
          </Button>

          {joinMutation.isPending && (
            <p className="text-center text-xs text-text-muted animate-pulse">
              Proses join dengan jeda acak 3–8 detik per grup untuk menghindari flood...
            </p>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-2">
              {/* Summary */}
              <div className="flex items-center gap-3 text-xs">
                {okCount > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {okCount} berhasil
                  </span>
                )}
                {failCount > 0 && (
                  <span className="flex items-center gap-1 text-danger">
                    <XCircle className="h-3.5 w-3.5" />
                    {failCount} gagal
                  </span>
                )}
              </div>

              {/* Per-group rows */}
              <div className="rounded-lg border border-border overflow-hidden">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-2 text-xs ${
                      i > 0 ? 'border-t border-border' : ''
                    } ${r.ok ? 'bg-success/5' : 'bg-danger/5'}`}
                  >
                    {r.ok ? (
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-text">{r.group}</p>
                      {r.alreadyMember && (
                        <p className="flex items-center gap-1 text-text-muted">
                          <AlertCircle className="h-3 w-3" />
                          Sudah jadi anggota
                        </p>
                      )}
                      {r.error && <p className="text-danger">{r.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
