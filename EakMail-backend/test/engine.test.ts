/**
 * Canonical workflow, end-to-end against the production MockSessionManager
 * (config.USE_MOCKS path, no live Telegram). Runs the exact graph the seed installs and
 * asserts it reaches the DELIVER success terminal and extracts an account credential.
 *
 * This complements test/workflow/engine.e2e.test.ts (which drives a hand-written
 * MockConversation): here the interpreter is wired to the real mock manager the app uses.
 */
import './workflow/_env.js';
import { describe, expect, it } from 'vitest';
import { runExecution } from '../src/workflow/engine/interpreter.js';
import { RedisEventEmitter } from '../src/workflow/engine/emitter.js';
import { StepPersistence, type ExecutionStore } from '../src/workflow/engine/persistence.js';
import { MockSessionManager } from '../src/telegram/session-manager/mock-session-manager.js';
import { canonicalWorkflowGraph } from '../src/db/canonical-workflow.js';
import { validateWorkflowGraph } from '../src/modules/workflows/workflow-validator.js';

/** In-memory ExecutionStore capturing writes for assertions. */
function fakeStore() {
  const steps: Array<Record<string, unknown>> = [];
  const executionUpdates: Array<Record<string, unknown>> = [];
  let counter = 0;
  const store: ExecutionStore = {
    execution: {
      async update({ data }) {
        executionUpdates.push(data);
        return {};
      },
    },
    executionStep: {
      async create({ data }) {
        steps.push(data);
        return { id: `step_${++counter}` };
      },
    },
  };
  return { store, steps, executionUpdates };
}

/** Collect published events without a live Redis connection. */
function fakePublisher() {
  const published: Array<{ channel: string; event: Record<string, unknown> }> = [];
  return {
    publisher: {
      publish(channel: string, message: string) {
        published.push({ channel, event: JSON.parse(message) });
      },
    },
    published,
  };
}

let clock = 1_000;
const now = () => (clock += 1);

describe('workflow engine against the mock session manager', () => {
  it('canonical graph is valid', () => {
    const result = validateWorkflowGraph(canonicalWorkflowGraph());
    expect(result.valid).toBe(true);
  });

  it('runs the canonical workflow to DELIVER and extracts an account credential', async () => {
    const { store, steps } = fakeStore();
    const { publisher, published } = fakePublisher();
    const emitter = new RedisEventEmitter(publisher, 'exec-canonical', now);
    const persistence = new StepPersistence(store);
    const variables: Record<string, unknown> = {};

    const manager = new MockSessionManager();
    const conversation = await manager.openConversation('acc-seed', '@demo_supplier_bot');

    const result = await runExecution({
      executionId: 'exec-canonical',
      graph: canonicalWorkflowGraph(),
      variables,
      conversation,
      emitter,
      persistence,
      signal: new AbortController().signal,
      workflowId: 'wf-canonical',
      orderId: 'order-canonical',
    });

    // Reached a success terminal (DELIVER_TO_CUSTOMER emits terminal.kind === 'success').
    expect(result.state).toBe('SUCCEEDED');
    expect(result.terminal?.kind).toBe('success');
    expect(result.lastNodeId).toBe('deliver');

    // The account credentials were extracted from the supplier's scripted reply.
    expect(variables.email).toMatch(/^user\d+@mail\.com$/);
    expect(variables.password).toMatch(/^pw\d+$/);

    // The delivered payload rendered the extracted variables into the customer message.
    const payload = result.terminal?.payload as { message?: string } | undefined;
    expect(payload?.message).toContain(String(variables.email));
    expect(payload?.message).toContain(String(variables.password));

    // Every node produced an entered (RUNNING) step; the happy path visits 8 nodes.
    const entered = steps.filter((s) => s.status === 'RUNNING');
    expect(entered.length).toBe(8);

    // The finished event fanned out to both the per-execution and global channels.
    const finished = published.filter(
      (p) => (p.event as { type: string }).type === 'execution.finished',
    );
    expect(finished.map((f) => f.channel).sort()).toEqual([
      'exec:all',
      'exec:exec-canonical',
    ]);

    await conversation.close();
  });
});
