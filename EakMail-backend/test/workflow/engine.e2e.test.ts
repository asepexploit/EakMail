/**
 * End-to-end interpreter test against the mock conversation.
 * Verifies the canonical workflow:
 *   START → SEND /beli → WAIT MESSAGE → MATCH TEXT → CLICK BUTTON
 *         → WAIT RESPONSE → EXTRACT DATA → SUCCESS → DELIVER
 * with step logs, live events, variable extraction, and pause/cancel controls.
 */
import './_env.js';
import { describe, it, expect } from 'vitest';
import type { WorkflowGraph } from '@eakmail/shared-types';
import { runExecution } from '../../src/workflow/engine/interpreter.js';
import { RedisEventEmitter } from '../../src/workflow/engine/emitter.js';
import { StepPersistence, type ExecutionStore } from '../../src/workflow/engine/persistence.js';
import type { ControlDecision, ExecutionControl } from '../../src/workflow/engine/interpreter.js';
import { MockConversation } from '../../src/workflow/testing/mock-conversation.js';

// ---- fakes ------------------------------------------------------------------

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

let time = 1_000;
const now = () => (time += 1);

// ---- canonical graph --------------------------------------------------------

function canonicalGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
      {
        id: 'send',
        type: 'SEND_COMMAND',
        config: { command: '/beli' },
        position: { x: 0, y: 0 },
      },
      { id: 'wait1', type: 'WAIT_MESSAGE', config: {}, position: { x: 0, y: 0 } },
      {
        id: 'match',
        type: 'MATCH_TEXT',
        config: { mode: 'contains', pattern: 'pilih produk' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'click',
        type: 'CLICK_BUTTON',
        config: { strategy: 'label', value: 'Netflix' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'wait2',
        type: 'WAIT_RESPONSE',
        config: { mode: 'contains', pattern: 'akun' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'extract',
        type: 'EXTRACT_DATA',
        config: { regex: 'Email: (?<email>\\S+) Pass: (?<password>\\S+)' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'deliver',
        type: 'DELIVER_TO_CUSTOMER',
        config: { template: 'Akun: {{email}} / {{password}}' },
        position: { x: 0, y: 0 },
      },
    ],
    edges: [
      { id: 'e1', from: 'start', fromPort: 'next', to: 'send' },
      { id: 'e2', from: 'send', fromPort: 'next', to: 'wait1' },
      { id: 'e3', from: 'wait1', fromPort: 'received', to: 'match' },
      { id: 'e4', from: 'match', fromPort: 'matched', to: 'click' },
      { id: 'e5', from: 'click', fromPort: 'clicked', to: 'wait2' },
      { id: 'e6', from: 'wait2', fromPort: 'received', to: 'extract' },
      { id: 'e7', from: 'extract', fromPort: 'extracted', to: 'deliver' },
    ],
  };
}

function canonicalConversation() {
  return new MockConversation([
    // turn 0: reply to SEND /beli
    [{ text: 'Silakan pilih produk:', buttons: [{ text: 'Netflix', row: 0, col: 0 }] }],
    // turn 1: reply to CLICK Netflix
    [{ text: 'Ini akun kamu. Email: user@x.com Pass: s3cret' }],
  ]);
}

// ---- tests ------------------------------------------------------------------

describe('workflow interpreter e2e', () => {
  it('runs the canonical workflow to SUCCESS and extracts variables', async () => {
    const { store, steps } = fakeStore();
    const { publisher, published } = fakePublisher();
    const emitter = new RedisEventEmitter(publisher, 'exec1', now);
    const persistence = new StepPersistence(store);
    const variables: Record<string, unknown> = {};

    const result = await runExecution({
      executionId: 'exec1',
      graph: canonicalGraph(),
      variables,
      conversation: canonicalConversation(),
      emitter,
      persistence,
      signal: new AbortController().signal,
      workflowId: 'wf1',
      orderId: 'order1',
    });

    expect(result.state).toBe('SUCCEEDED');
    expect(result.terminal?.kind).toBe('success');
    expect(variables.email).toBe('user@x.com');
    expect(variables.password).toBe('s3cret');

    // Every node produced an entered + exited step.
    const enteredCount = steps.filter((s) => s.status === 'RUNNING').length;
    expect(enteredCount).toBe(8);

    // Live events reached both the per-exec and global channels.
    const finished = published.filter(
      (p) => (p.event as { type: string }).type === 'execution.finished',
    );
    expect(finished.length).toBe(2);
    expect(finished.map((f) => f.channel).sort()).toEqual(['exec:all', 'exec:exec1']);
  });

  it('routes to no-match / FAIL path when the response does not match', async () => {
    const { store } = fakeStore();
    const { publisher } = fakePublisher();
    const emitter = new RedisEventEmitter(publisher, 'exec2', now);
    const persistence = new StepPersistence(store);

    const graph = canonicalGraph();
    graph.nodes.push({ id: 'fail', type: 'FAIL', config: { reason: 'no product' }, position: { x: 0, y: 0 } });
    graph.edges.push({ id: 'e8', from: 'match', fromPort: 'no-match', to: 'fail' });
    // Supplier sends a non-matching message.
    const convo = new MockConversation([[{ text: 'Maaf, tidak ada.', buttons: [] }]]);

    const result = await runExecution({
      executionId: 'exec2',
      graph,
      variables: {},
      conversation: convo,
      emitter,
      persistence,
      signal: new AbortController().signal,
      workflowId: 'wf1',
      orderId: null,
    });

    expect(result.state).toBe('FAILED');
    expect(result.terminal?.reason).toBe('no product');
    expect(result.terminal?.refund).toBe(true);
  });

  it('cancels cooperatively when control returns cancel', async () => {
    const { store } = fakeStore();
    const { publisher } = fakePublisher();
    const emitter = new RedisEventEmitter(publisher, 'exec3', now);
    const persistence = new StepPersistence(store);

    const control: ExecutionControl = {
      async check(nodeId): Promise<ControlDecision> {
        return nodeId === 'send' ? 'cancel' : 'continue';
      },
      async awaitResume(): Promise<ControlDecision> {
        return 'continue';
      },
    };

    const result = await runExecution({
      executionId: 'exec3',
      graph: canonicalGraph(),
      variables: {},
      conversation: canonicalConversation(),
      emitter,
      persistence,
      signal: new AbortController().signal,
      control,
      workflowId: 'wf1',
      orderId: null,
    });

    expect(result.state).toBe('CANCELLED');
  });
});
