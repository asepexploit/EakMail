import { create } from 'zustand';

/** Live WebSocket connection state, mirrored here for the status bar (DESIGN_SYSTEM.md §2.1). */
export type WsConnectionState = 'connecting' | 'open' | 'closed' | 'reconnecting';

const SIDEBAR_STORAGE_KEY = 'eakmail.sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Ignore persistence failures (private mode / blocked storage).
  }
}

interface UiState {
  /** Sidebar collapsed to icons-only (DESIGN_SYSTEM.md §13.3). */
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Live WS connection state, updated by the realtime client (ws.ts). */
  wsState: WsConnectionState;
  setWsState: (state: WsConnectionState) => void;
}

/** Shell-level UI state (sidebar collapse + WS status). Presentational, no domain logic. */
export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: readCollapsed(),
  toggleSidebar: () =>
    set((state) => {
      const next = !state.isSidebarCollapsed;
      persistCollapsed(next);
      return { isSidebarCollapsed: next };
    }),
  setSidebarCollapsed: (collapsed) => {
    persistCollapsed(collapsed);
    set({ isSidebarCollapsed: collapsed });
  },

  wsState: 'closed',
  setWsState: (wsState) => set({ wsState }),
}));
