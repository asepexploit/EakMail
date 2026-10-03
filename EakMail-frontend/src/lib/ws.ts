/**
 * WebSocket client for the live execution stream (ARCHITECTURE.md §9, events.ts contract).
 * A single shared socket multiplexes per-execution subscriptions; consumers subscribe by
 * executionId and receive typed WsEvent payloads. Handles reconnect with backoff and
 * re-subscribes active channels on reconnect. UI reads state; it never drives the engine.
 */
import { type WsEvent, type WsSubscribe } from '@eakmail/shared-types';

export type WsConnectionState = 'connecting' | 'open' | 'closed' | 'reconnecting';

type EventListener = (event: WsEvent) => void;
type StateListener = (state: WsConnectionState) => void;

/** Backend WS endpoint; proxied by Vite in dev (vite.config.ts). Uses the page origin. */
function resolveWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;

class ExecutionSocket {
  private socket: WebSocket | null = null;
  private state: WsConnectionState = 'closed';
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;

  /** executionId → set of listeners; presence also drives (re)subscription. */
  private readonly channels = new Map<string, Set<EventListener>>();
  private readonly stateListeners = new Set<StateListener>();

  getState(): WsConnectionState {
    return this.state;
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  /** Subscribe to an execution's events. Returns an unsubscribe function. */
  subscribe(executionId: string, listener: EventListener): () => void {
    let listeners = this.channels.get(executionId);
    if (!listeners) {
      listeners = new Set();
      this.channels.set(executionId, listeners);
      this.ensureConnected();
      this.send({ action: 'subscribe', executionId });
    }
    listeners.add(listener);

    return () => {
      const set = this.channels.get(executionId);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) {
        this.channels.delete(executionId);
        this.send({ action: 'unsubscribe', executionId });
        if (this.channels.size === 0) this.close();
      }
    };
  }

  private ensureConnected(): void {
    if (this.socket && (this.state === 'open' || this.state === 'connecting')) return;
    this.manualClose = false;
    this.connect();
  }

  private connect(): void {
    this.setState(this.socket ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(resolveWsUrl());
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.backoffMs = INITIAL_BACKOFF_MS;
      this.setState('open');
      // Re-subscribe every active channel after a (re)connect.
      for (const executionId of this.channels.keys()) {
        this.send({ action: 'subscribe', executionId });
      }
    });

    socket.addEventListener('message', (raw) => {
      const event = this.parse(raw.data);
      if (!event) return;
      const listeners = this.channels.get(event.executionId);
      if (!listeners) return;
      for (const listener of listeners) listener(event);
    });

    socket.addEventListener('close', () => {
      this.socket = null;
      if (this.manualClose || this.channels.size === 0) {
        this.setState('closed');
        return;
      }
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // The close handler drives reconnect; nothing extra needed here.
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private send(message: WsSubscribe): void {
    if (this.socket && this.state === 'open') {
      this.socket.send(JSON.stringify(message));
    }
    // If not open yet, the open handler replays subscriptions from `channels`.
  }

  private parse(data: unknown): WsEvent | null {
    if (typeof data !== 'string') return null;
    try {
      const parsed = JSON.parse(data) as WsEvent;
      if (parsed && typeof parsed === 'object' && 'type' in parsed && 'executionId' in parsed) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private close(): void {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.setState('closed');
  }

  private setState(next: WsConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const listener of this.stateListeners) listener(next);
  }
}

/** Process-wide singleton — one socket serves the whole dashboard. */
export const executionSocket = new ExecutionSocket();
