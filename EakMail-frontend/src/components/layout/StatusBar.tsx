import { Activity, Layers, Radio, Server } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';
import type { StatusTone } from '@/lib/status-tokens';

export type WebSocketState = 'online' | 'offline' | 'reconnecting';

export interface StatusBarProps {
  queueDepth?: number;
  activeExecutions?: number;
  isWorkerOnline?: boolean;
  websocketState?: WebSocketState;
}

const toneClass: Record<StatusTone, string> = {
  success: 'tone-success',
  running: 'tone-running',
  warning: 'tone-warning',
  danger: 'tone-danger',
  neutral: 'tone-neutral',
  info: 'tone-info',
};

const wsToneMap: Record<WebSocketState, { tone: StatusTone; label: string }> = {
  online: { tone: 'success', label: strings.statusBar.online },
  offline: { tone: 'danger', label: strings.statusBar.offline },
  reconnecting: { tone: 'warning', label: strings.statusBar.reconnecting },
};

function Vital({
  icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: StatusTone;
  pulse?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', tone && toneClass[tone])}>
      <span className="text-text-muted">{icon}</span>
      <span className="text-text-muted">{label}</span>
      {tone ? (
        <span className="inline-flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full tone-dot', pulse && 'animate-pulse')} aria-hidden />
          <span className="tone-fg font-medium">{value}</span>
        </span>
      ) : (
        <span className="font-medium tabular-nums text-text">{value}</span>
      )}
    </span>
  );
}

/**
 * Bottom status bar with operational vitals (DESIGN_SYSTEM.md §2.1).
 * Values are display props; live data is wired by feature/realtime code.
 */
export function StatusBar({
  queueDepth = 0,
  activeExecutions = 0,
  isWorkerOnline = false,
  websocketState = 'offline',
}: StatusBarProps) {
  const ws = wsToneMap[websocketState];
  return (
    <footer className="flex h-8 items-center gap-5 border-t border-border bg-surface px-4 text-[11px]">
      <Vital
        icon={<Layers className="h-3.5 w-3.5" />}
        label={strings.statusBar.queueDepth}
        value={queueDepth}
      />
      <Vital
        icon={<Activity className="h-3.5 w-3.5" />}
        label={strings.statusBar.activeExecutions}
        value={activeExecutions}
      />
      <Vital
        icon={<Server className="h-3.5 w-3.5" />}
        label={strings.statusBar.worker}
        value={isWorkerOnline ? strings.statusBar.online : strings.statusBar.offline}
        tone={isWorkerOnline ? 'success' : 'danger'}
      />
      <Vital
        icon={<Radio className="h-3.5 w-3.5" />}
        label={strings.statusBar.websocket}
        value={ws.label}
        tone={ws.tone}
        pulse={websocketState === 'reconnecting'}
      />
    </footer>
  );
}
