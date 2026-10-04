import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Loader2, ExternalLink } from 'lucide-react';
import { useAccountQueue, useJoinQueueItemNow } from '../api/useMonitor';

interface Props {
  accountId: string;
  queuePending: number;
}

export function QueuePanel({ accountId, queuePending }: Props) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isLoading } = useAccountQueue(accountId, open);
  const joinNow = useJoinQueueItemNow();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  if (queuePending === 0) return null;

  async function handleJoinNow(queueId: string) {
    setJoiningId(queueId);
    try {
      const res = await joinNow.mutateAsync({ accountId, queueId });
      setResults((prev) => ({
        ...prev,
        [queueId]: res.ok ? 'Berhasil join' : (res.error ?? 'Gagal'),
      }));
    } catch {
      setResults((prev) => ({ ...prev, [queueId]: 'Gagal menghubungi server' }));
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-warning hover:bg-surface/60 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning/20 text-[10px] font-bold text-warning">
            {queuePending}
          </span>
          link sedang antri
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {isLoading ? (
            <p className="px-4 py-3 text-xs text-text-muted">Memuat antrian...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-xs text-text-muted">Antrian kosong</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const isDone = !!results[item.id];
                const isJoining = joiningId === item.id;
                return (
                  <li key={item.id} className="flex items-center gap-2 px-4 py-2">
                    <a
                      href={item.rawLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs text-brand hover:underline"
                      title={item.rawLink}
                    >
                      <ExternalLink className="mr-1 inline h-3 w-3 opacity-60" />
                      {item.rawLink}
                    </a>
                    {isDone ? (
                      <span className="shrink-0 text-xs text-success">{results[item.id]}</span>
                    ) : (
                      <button
                        onClick={() => handleJoinNow(item.id)}
                        disabled={isJoining || !!joiningId}
                        className="shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-brand border border-brand/30 hover:bg-brand/10 disabled:opacity-40 transition-colors"
                      >
                        {isJoining ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Join
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
