import { useMemo } from 'react';
import {
  StepStatus,
  WsEventType,
  type ExecutionStepDto,
  type WsEvent,
} from '@eakmail/shared-types';
import { LiveLog, type LogLine } from '@/components/ui';
import type { StatusTone } from '@/lib/status-tokens';
import { featureStrings } from '@/features/shared/feature-strings';

export interface ExecutionEventLogProps {
  events: WsEvent[];
  /** Persisted steps used as a fallback when no live events are available (execution finished). */
  historySteps?: ExecutionStepDto[];
  height?: number;
}

/**
 * Extract a short human-readable hint from a node's config so the log entry says
 * something useful (e.g. "label: Beli" or "regex: GMAIL-OLD") without being verbose.
 */
function nodeHint(nodeType: string, input: unknown): string {
  if (!input || typeof input !== 'object') return featureStrings.monitoring.eventLog.stepEntered;
  const cfg = input as Record<string, unknown>;
  // Use the user-supplied label first (most nodes support it).
  if (cfg.label && typeof cfg.label === 'string' && cfg.label.trim()) {
    return `→ masuk node  · ${cfg.label}`;
  }
  switch (nodeType) {
    case 'CLICK_BUTTON': {
      const strategy = cfg.strategy ?? 'label';
      const val = cfg.value ?? '';
      return `→ masuk node  · ${strategy}: ${val}`;
    }
    case 'SEND_MESSAGE':
    case 'SEND_COMMAND': {
      const text = String(cfg.text ?? cfg.command ?? '');
      return `→ masuk node  · ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`;
    }
    case 'WAIT_MESSAGE':
    case 'WAIT_RESPONSE': {
      const pat = cfg.pattern ? `pattern: ${cfg.pattern}` : '';
      const ms = cfg.timeoutMs ? `${cfg.timeoutMs}ms` : '';
      return `→ masuk node${pat ? `  · ${pat}` : ''}${ms ? `  · ${ms}` : ''}`;
    }
    case 'DELAY':
      return `→ masuk node  · ${cfg.ms ?? '?'}ms`;
    case 'SET_VARIABLE':
      return `→ masuk node  · ${cfg.name ?? ''}`;
    case 'EXTRACT_DATA':
      return `→ masuk node  · ${cfg.assignTo ?? ''}`;
    default:
      return featureStrings.monitoring.eventLog.stepEntered;
  }
}

/** Turns raw WS events into color-coded log lines (DESIGN_SYSTEM.md §9.3). */
function toLine(event: WsEvent, index: number): LogLine {
  const id = `${event.ts}-${index}`;
  const base = { id, timestamp: event.ts };
  const neutral: StatusTone = 'neutral';

  switch (event.type) {
    case WsEventType.STEP_ENTERED:
      return {
        ...base,
        label: event.nodeType,
        message: nodeHint(event.nodeType, event.input),
        tone: 'running',
      };
    case WsEventType.STEP_EXITED:
      return {
        ...base,
        label: event.nodeType,
        message: event.error ? `✕ ${event.error}` : `ok ${event.outPort ?? ''}`,
        tone: event.error ? 'danger' : 'success',
        trailing: `${event.durationMs}ms`,
      };
    case WsEventType.MESSAGE_SENT:
      return { ...base, label: 'SEND', message: `→ ${event.text}`, tone: neutral };
    case WsEventType.MESSAGE_RECEIVED:
      return { ...base, label: 'RECV', message: `← ${event.text}`, tone: 'info' };
    case WsEventType.VARIABLE_SET:
      return {
        ...base,
        label: 'VAR',
        message: `${event.name} = ${JSON.stringify(event.value)}`,
        tone: 'info',
      };
    case WsEventType.LOG:
      return {
        ...base,
        label: 'LOG',
        message: event.message,
        tone: event.level === 'warn' ? 'warning' : event.level === 'error' ? 'danger' : neutral,
      };
    case WsEventType.EXECUTION_STATE:
    case WsEventType.EXECUTION_FINISHED:
      return { ...base, label: 'STATE', message: event.state, tone: neutral };
    case WsEventType.EXECUTION_STARTED:
      return {
        ...base,
        label: 'START',
        message: featureStrings.monitoring.eventLog.executionStarted,
        tone: 'running',
      };
    default:
      return { ...base, message: '', tone: neutral };
  }
}

/** Render a persisted step as two log lines (entered + exited), matching the live-event look. */
function stepToLines(step: ExecutionStepDto, index: number): LogLine[] {
  const neutral: StatusTone = 'neutral';
  const base = { id: `step-${step.id}-${index}`, timestamp: step.ts };

  const enteredLine: LogLine = {
    ...base,
    id: `${base.id}-in`,
    label: step.nodeType,
    message: nodeHint(step.nodeType, step.input),
    tone: 'running',
  };

  if (step.status === StepStatus.RUNNING) {
    return [enteredLine];
  }

  const tone: StatusTone =
    step.status === StepStatus.SUCCEEDED
      ? 'success'
      : step.status === StepStatus.FAILED || step.status === StepStatus.TIMED_OUT
        ? 'danger'
        : step.status === StepStatus.SKIPPED
          ? 'warning'
          : neutral;

  const exitedLine: LogLine = {
    ...base,
    id: `${base.id}-out`,
    label: step.nodeType,
    message: step.error ? `✕ ${step.error}` : `ok`,
    tone,
  };

  return [enteredLine, exitedLine];
}

export function ExecutionEventLog({ events, historySteps, height }: ExecutionEventLogProps) {
  const lines = useMemo(() => {
    if (events.length > 0) return events.map(toLine);
    if (historySteps && historySteps.length > 0) return historySteps.flatMap(stepToLines);
    return [];
  }, [events, historySteps]);
  return <LiveLog lines={lines} height={height} />;
}
