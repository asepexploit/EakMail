import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WsEventType,
  ExecutionState,
  StepStatus,
  type ExecutionStartedEvent,
  type StepExitedEvent,
  type WsEvent,
  type WsSubscribe,
} from '@eakmail/shared-types';

/**
 * ws.ts is tested in the `node` environment (no jsdom). We install a minimal `window`
 * and a fake WebSocket on globalThis BEFORE importing the module so the singleton and
 * its reconnect timers can be driven deterministically with fake timers.
 */

// ---- Fake browser surface ----------------------------------------------------
interface FakeListeners {
  open: Array<() => void>;
  message: Array<(ev: { data: unknown }) => void>;
  close: Array<() => void>;
  error: Array<() => void>;
}

let sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  static OPEN = 1;
  readonly url: string;
  readonly sent: string[] = [];
  closed = false;
  private readonly listeners: FakeListeners = { open: [], message: [], close: [], error: [] };

  constructor(url: string) {
    this.url = url;
    sockets.push(this);
  }

  addEventListener<K extends keyof FakeListeners>(type: K, cb: FakeListeners[K][number]): void {
    (this.listeners[type] as Array<typeof cb>).push(cb);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    for (const cb of this.listeners.close) cb();
  }

  // Test-only drivers:
  emitOpen(): void {
    for (const cb of this.listeners.open) cb();
  }
  emitMessage(data: unknown): void {
    for (const cb of this.listeners.message) cb({ data });
  }
  emitError(): void {
    for (const cb of this.listeners.error) cb();
  }

  get parsedSent(): WsSubscribe[] {
    return this.sent.map((s) => JSON.parse(s) as WsSubscribe);
  }
}

beforeEach(() => {
  sockets = [];
  vi.stubGlobal('window', { location: { protocol: 'http:', host: 'localhost:5173' } });
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadSocket() {
  // Fresh module per test so the singleton's internal state does not leak.
  const mod = await import('./ws.js');
  return mod.executionSocket;
}

describe('executionSocket connection + URL', () => {
  it('derives a ws:// URL from the page origin and connects on first subscribe', async () => {
    const socket = await loadSocket();
    socket.subscribe('exec-1', () => {});
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe('ws://localhost:5173/ws');
    expect(socket.getState()).toBe('connecting');
  });

  it('uses wss:// when the page is served over https', async () => {
    vi.stubGlobal('window', { location: { protocol: 'https:', host: 'app.example.com' } });
    const socket = await loadSocket();
    socket.subscribe('exec-1', () => {});
    expect(sockets[0].url).toBe('wss://app.example.com/ws');
  });

  it('sends a subscribe frame once the socket opens and reports open state', async () => {
    const socket = await loadSocket();
    socket.subscribe('exec-42', () => {});
    sockets[0].emitOpen();
    expect(socket.getState()).toBe('open');
    expect(sockets[0].parsedSent).toContainEqual({ action: 'subscribe', executionId: 'exec-42' });
  });
});

describe('event parsing + dispatch', () => {
  it('parses a JSON WsEvent and delivers it, typed, to the matching channel listener', async () => {
    const socket = await loadSocket();
    const received: WsEvent[] = [];
    socket.subscribe('exec-1', (e) => received.push(e));
    sockets[0].emitOpen();

    const event: ExecutionStartedEvent = {
      type: WsEventType.EXECUTION_STARTED,
      executionId: 'exec-1',
      ts: 1_700_000_000_000,
      workflowId: 'wf-1',
      orderId: null,
    };
    sockets[0].emitMessage(JSON.stringify(event));

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe(WsEventType.EXECUTION_STARTED);
    // Narrow on the discriminant to prove the typed event survives the round trip.
    if (received[0].type === WsEventType.EXECUTION_STARTED) {
      expect(received[0].workflowId).toBe('wf-1');
      expect(received[0].orderId).toBeNull();
    }
  });

  it('routes an event only to listeners of its executionId', async () => {
    const socket = await loadSocket();
    const a: WsEvent[] = [];
    const b: WsEvent[] = [];
    socket.subscribe('exec-A', (e) => a.push(e));
    socket.subscribe('exec-B', (e) => b.push(e));
    sockets[0].emitOpen();

    const step: StepExitedEvent = {
      type: WsEventType.STEP_EXITED,
      executionId: 'exec-B',
      ts: 1,
      nodeId: 'n1',
      nodeType: 'SEND_MESSAGE',
      status: StepStatus.SUCCEEDED,
      output: null,
      error: null,
      outPort: 'next',
      durationMs: 12,
    };
    sockets[0].emitMessage(JSON.stringify(step));

    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });

  it('ignores non-string, malformed, and shape-invalid messages', async () => {
    const socket = await loadSocket();
    const received: WsEvent[] = [];
    socket.subscribe('exec-1', (e) => received.push(e));
    sockets[0].emitOpen();

    sockets[0].emitMessage(123); // not a string
    sockets[0].emitMessage('{ not json');
    sockets[0].emitMessage(JSON.stringify({ hello: 'world' })); // missing type/executionId
    sockets[0].emitMessage(JSON.stringify({ type: 'x' })); // missing executionId

    expect(received).toHaveLength(0);
  });

  it('stops delivering after unsubscribe', async () => {
    const socket = await loadSocket();
    const received: WsEvent[] = [];
    const unsubscribe = socket.subscribe('exec-1', (e) => received.push(e));
    sockets[0].emitOpen();
    unsubscribe();

    const finished = {
      type: WsEventType.EXECUTION_FINISHED,
      executionId: 'exec-1',
      ts: 1,
      state: ExecutionState.SUCCEEDED,
    };
    // The socket closes once the last channel unsubscribes; use whatever socket exists.
    const live = sockets[sockets.length - 1];
    live.emitMessage(JSON.stringify(finished));
    expect(received).toHaveLength(0);
  });
});

describe('reconnect + backoff', () => {
  it('reconnects with exponential backoff after an unexpected close', async () => {
    const socket = await loadSocket();
    socket.subscribe('exec-1', () => {});
    sockets[0].emitOpen();
    expect(socket.getState()).toBe('open');

    // Simulate a dropped connection (not a manual close).
    sockets[0].close();
    expect(socket.getState()).toBe('reconnecting');
    expect(sockets).toHaveLength(1); // not reconnected yet

    // First backoff is 500ms.
    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2); // reconnect attempt fired

    // Second drop → backoff doubles to 1000ms.
    sockets[1].close();
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
  });

  it('re-subscribes every active channel after a reconnect opens', async () => {
    const socket = await loadSocket();
    socket.subscribe('exec-1', () => {});
    socket.subscribe('exec-2', () => {});
    sockets[0].emitOpen();

    sockets[0].close(); // drop
    vi.advanceTimersByTime(500); // reconnect
    const reconnected = sockets[1];
    reconnected.emitOpen();

    const ids = reconnected.parsedSent
      .filter((m) => m.action === 'subscribe')
      .map((m) => m.executionId)
      .sort();
    expect(ids).toEqual(['exec-1', 'exec-2']);
  });

  it('does not reconnect after the last channel unsubscribes (manual close)', async () => {
    const socket = await loadSocket();
    const unsubscribe = socket.subscribe('exec-1', () => {});
    sockets[0].emitOpen();
    unsubscribe(); // last channel gone → close()
    expect(socket.getState()).toBe('closed');

    vi.advanceTimersByTime(60_000);
    // No new socket should have been created by a reconnect timer.
    expect(sockets).toHaveLength(1);
  });
});

describe('state listeners', () => {
  it('notifies subscribers of state transitions and reports the current state immediately', async () => {
    const socket = await loadSocket();
    const states: string[] = [];
    socket.onStateChange((s) => states.push(s));
    expect(states[0]).toBe('closed'); // current state on register

    socket.subscribe('exec-1', () => {});
    sockets[0].emitOpen();
    expect(states).toContain('connecting');
    expect(states).toContain('open');
  });
});
