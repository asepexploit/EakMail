/**
 * Test support: build a lightweight ExecutionContext for exercising a single node
 * executor in isolation, mirroring how the interpreter wires one (buildContext in
 * src/workflow/engine/interpreter.ts). No Redis, no DB, no Telegram — a recording
 * emitter and the real renderTemplate over the supplied variables.
 */
import type { ExecutionContext, EventEmitter } from '../../src/workflow/engine/node-executor.js';
import type { TelegramConversation } from '../../src/telegram/session-manager/types.js';
import { renderTemplate } from '../../src/workflow/variables.js';

export interface RecordedEmitter extends EventEmitter {
  readonly sent: Array<{ nodeId: string; text: string }>;
  readonly received: Array<{ nodeId: string | null; text: string }>;
  readonly variables: Array<{ name: string; value: unknown }>;
  readonly logs: Array<{ level: 'info' | 'warn' | 'error'; message: string }>;
}

/** An emitter that records every event for assertions. */
export function recordingEmitter(): RecordedEmitter {
  const sent: Array<{ nodeId: string; text: string }> = [];
  const received: Array<{ nodeId: string | null; text: string }> = [];
  const variables: Array<{ name: string; value: unknown }> = [];
  const logs: Array<{ level: 'info' | 'warn' | 'error'; message: string }> = [];
  return {
    sent,
    received,
    variables,
    logs,
    messageSent: (nodeId, text) => sent.push({ nodeId, text }),
    messageReceived: (nodeId, text) => received.push({ nodeId, text }),
    variableSet: (name, value) => variables.push({ name, value }),
    log: (level, message) => logs.push({ level, message }),
  };
}

export interface TestContextOptions {
  variables?: Record<string, unknown>;
  conversation?: TelegramConversation | null;
  signal?: AbortSignal;
  emitter?: RecordedEmitter;
}

export interface TestContext {
  ctx: ExecutionContext;
  emitter: RecordedEmitter;
  variables: Record<string, unknown>;
}

/** Build an ExecutionContext + return the shared handles for assertions. */
export function makeContext(options: TestContextOptions = {}): TestContext {
  const variables = options.variables ?? {};
  const emitter = options.emitter ?? recordingEmitter();
  const ctx: ExecutionContext = {
    executionId: 'exec-test',
    variables,
    conversation: options.conversation ?? null,
    emitter,
    render: (template: string) => renderTemplate(template, variables),
    signal: options.signal ?? new AbortController().signal,
  };
  return { ctx, emitter, variables };
}
