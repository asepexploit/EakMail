/**
 * React hook over the shared execution WebSocket. Subscribes to one execution's live
 * events, keeps a bounded event buffer and a derived per-node status map for the
 * read-only canvas (monitoring + test overlay, DESIGN_SYSTEM.md §8.4 / §9.1).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExecutionState,
  StepStatus,
  WsEventType,
  type ExecutionState as ExecutionStateType,
  type StepStatus as StepStatusType,
  type WsEvent,
} from '@eakmail/shared-types';
import { executionSocket, type WsConnectionState } from './ws.js';
import { useUiStore } from '../stores/ui-store.js';

/** Keep memory bounded on long-running streams. */
const MAX_BUFFERED_EVENTS = 500;

export interface ExecutionStream {
  events: WsEvent[];
  /** nodeId → latest step status, for lighting up the canvas. */
  nodeStatus: Record<string, StepStatusType>;
  /** Currently executing node (pulsing), or null. */
  activeNodeId: string | null;
  /** Latest known execution state from the stream, if any. */
  state: ExecutionStateType | null;
  connection: WsConnectionState;
  /** Clear the buffered event list (does not affect the live subscription). */
  clear: () => void;
}

function reduceNodeStatus(
  previous: Record<string, StepStatusType>,
  event: WsEvent,
): Record<string, StepStatusType> {
  if (event.type === WsEventType.STEP_ENTERED) {
    return { ...previous, [event.nodeId]: StepStatus.RUNNING };
  }
  if (event.type === WsEventType.STEP_EXITED) {
    return { ...previous, [event.nodeId]: event.status };
  }
  return previous;
}

export function useExecutionStream(executionId: string | null): ExecutionStream {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [nodeStatus, setNodeStatus] = useState<Record<string, StepStatusType>>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [state, setState] = useState<ExecutionStateType | null>(null);
  const setWsState = useUiStore((s) => s.setWsState);
  const [connection, setConnection] = useState<WsConnectionState>(executionSocket.getState());

  // Reset derived state whenever the subscribed execution changes.
  const currentId = useRef<string | null>(null);
  if (currentId.current !== executionId) {
    currentId.current = executionId;
  }

  useEffect(() => {
    const unsubscribeState = executionSocket.onStateChange((next) => {
      setConnection(next);
      setWsState(next);
    });
    return unsubscribeState;
  }, [setWsState]);

  useEffect(() => {
    setEvents([]);
    setNodeStatus({});
    setActiveNodeId(null);
    setState(null);
    if (!executionId) return;

    const unsubscribe = executionSocket.subscribe(executionId, (event) => {
      setEvents((prev) => {
        const next = prev.length >= MAX_BUFFERED_EVENTS ? prev.slice(1) : prev.slice();
        next.push(event);
        return next;
      });
      setNodeStatus((prev) => reduceNodeStatus(prev, event));

      if (event.type === WsEventType.STEP_ENTERED) setActiveNodeId(event.nodeId);
      if (event.type === WsEventType.STEP_EXITED && event.status !== StepStatus.RUNNING) {
        setActiveNodeId((prev) => (prev === event.nodeId ? null : prev));
      }
      if (
        event.type === WsEventType.EXECUTION_STATE ||
        event.type === WsEventType.EXECUTION_FINISHED
      ) {
        setState(event.state);
        if (
          event.state === ExecutionState.SUCCEEDED ||
          event.state === ExecutionState.FAILED ||
          event.state === ExecutionState.CANCELLED ||
          event.state === ExecutionState.TIMED_OUT
        ) {
          setActiveNodeId(null);
        }
      }
    });

    return unsubscribe;
  }, [executionId]);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, nodeStatus, activeNodeId, state, connection, clear };
}
