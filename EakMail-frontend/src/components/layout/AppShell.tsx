import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '@/stores/ui-store';
import { useSystemStatus } from '@/features/shared/useSystemStatus';
import { executionSocket } from '@/lib/ws';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { StatusBar, type WebSocketState } from './StatusBar';
import type { HealthLevel } from './HealthDot';

/** Map the raw WS connection state to the status bar's display state. */
function toWebSocketState(state: string): WebSocketState {
  if (state === 'open') return 'online';
  if (state === 'connecting' || state === 'reconnecting') return 'reconnecting';
  return 'offline';
}

/**
 * Application shell (DESIGN_SYSTEM.md §2.1): sidebar + topbar + content + status bar.
 * Wires live vitals: a global WS subscription keeps the socket connected and mirrors its
 * state into the store, and /api/status feeds worker/queue/active-execution counts.
 */
export function AppShell() {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const wsState = useUiStore((state) => state.wsState);
  const setWsState = useUiStore((state) => state.setWsState);

  const { data: status } = useSystemStatus();

  // Keep the shared socket connected to the global feed for the whole session, and
  // mirror its connection state into the store so the status bar reflects reality.
  useEffect(() => {
    const offState = executionSocket.onStateChange(setWsState);
    const unsubscribe = executionSocket.subscribe('all', () => {
      // The shell doesn't consume individual events; per-execution views do that.
      // Subscribing here just keeps the socket alive so its state is meaningful.
    });
    return () => {
      offState();
      unsubscribe();
    };
  }, [setWsState]);

  const bindAddress = `${window.location.hostname}:${window.location.port || '5173'}`;
  const websocketState = toWebSocketState(wsState);

  // Health dot aggregates the two things the shell knows about: worker + WS.
  const health: HealthLevel =
    status?.worker && websocketState === 'online'
      ? 'healthy'
      : status?.worker || websocketState === 'online'
        ? 'degraded'
        : 'down';

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <Sidebar collapsed={isSidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar onToggleSidebar={toggleSidebar} bindAddress={bindAddress} health={health} />
        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
        <StatusBar
          queueDepth={status?.queueDepth ?? 0}
          activeExecutions={status?.activeExecutions ?? 0}
          isWorkerOnline={status?.worker ?? false}
          websocketState={websocketState}
        />
      </div>
    </div>
  );
}
