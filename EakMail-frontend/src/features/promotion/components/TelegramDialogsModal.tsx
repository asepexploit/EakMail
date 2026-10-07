/**
 * Modal showing all Telegram dialogs for a promotion account, fetched directly
 * from MTProto (not from DB). Categorized into: Grup, Channel, Chat.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Radio, MessageSquare, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { http } from '@/lib/http';
import { Dialog } from '@/components/ui/Dialog';
import type { TelegramDialogsResult, TelegramDialogItem } from '@eakmail/shared-types';

function useTelegramDialogs(accountId: string, enabled: boolean) {
  return useQuery<TelegramDialogsResult>({
    queryKey: ['telegram-dialogs', accountId],
    queryFn: () => http.get(`/promotion/accounts/${accountId}/dialogs`),
    enabled,
    staleTime: 60_000,
  });
}

type Tab = 'groups' | 'channels' | 'chats';

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode; field: keyof TelegramDialogsResult }[] = [
  { key: 'groups', label: 'Grup', icon: <Users className="h-3.5 w-3.5" />, field: 'groups' },
  { key: 'channels', label: 'Channel', icon: <Radio className="h-3.5 w-3.5" />, field: 'channels' },
  { key: 'chats', label: 'Chat', icon: <MessageSquare className="h-3.5 w-3.5" />, field: 'chats' },
];

function DialogItem({ item }: { item: TelegramDialogItem }) {
  const tgLink = item.username
    ? `https://t.me/${item.username}`
    : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-surface-hover rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{item.title || '(Tanpa nama)'}</p>
        {item.username && (
          <p className="text-xs text-text-muted font-mono">@{item.username}</p>
        )}
        {!item.username && item.id && (
          <p className="text-xs text-text-muted font-mono">{item.id}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.memberCount != null && (
          <span className="text-[11px] text-text-muted">{item.memberCount.toLocaleString('id-ID')} anggota</span>
        )}
        {tgLink && (
          <a
            href={tgLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-brand transition-colors"
            title="Buka di Telegram"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

interface TelegramDialogsModalProps {
  accountId: string;
  accountLabel: string;
  open: boolean;
  onClose: () => void;
}

export function TelegramDialogsModal({ accountId, accountLabel, open, onClose }: TelegramDialogsModalProps) {
  const [tab, setTab] = useState<Tab>('groups');
  const { data, isLoading, isError, refetch, isFetching } = useTelegramDialogs(accountId, open);

  const items: TelegramDialogItem[] = data ? (data[tab] as TelegramDialogItem[]) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Dialog Telegram — ${accountLabel}`}
      size="md"
    >
      <div className="space-y-4">
        {/* Summary + refresh */}
        <div className="flex items-center justify-between">
          {data ? (
            <p className="text-xs text-text-muted">
              Total: <span className="font-medium text-text">{data.total}</span> dialog
              ({data.groups.length} grup · {data.channels.length} channel · {data.chats.length} chat)
            </p>
          ) : (
            <p className="text-xs text-text-muted">Mengambil data dari Telegram...</p>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {TAB_CONFIG.map(({ key, label, icon, field }) => {
            const count = data ? (data[field] as TelegramDialogItem[]).length : null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === key
                    ? 'bg-bg text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {icon}
                {label}
                {count != null && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === key ? 'bg-brand/10 text-brand' : 'bg-surface-hover'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Mengambil dialog dari Telegram...</span>
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-sm text-danger">
              Gagal mengambil data. Pastikan akun masih terhubung.
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-muted">
              Tidak ada {tab === 'groups' ? 'grup' : tab === 'channels' ? 'channel' : 'chat'}.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <DialogItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
