/**
 * Unit tests for the re-entrant control nodes (RETRY, TIMEOUT) and DELAY.
 * These nodes keep per-node counters in the reserved __nodeState namespace and are
 * driven by repeated visits (as the interpreter would on a loop-back edge). All delays
 * are kept tiny so the suite stays fast and offline.
 */
import '../_env.js';
import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '@eakmail/shared-types';
import { makeContext } from '../../support/node-context.js';
import { RetryNode } from '../../../src/workflow/nodes/retry.node.js';
import { TimeoutNode } from '../../../src/workflow/nodes/timeout.node.js';
import { DelayNode } from '../../../src/workflow/nodes/delay.node.js';

describe('RETRY node', () => {
  const executor = new RetryNode();
  const retryNode: WorkflowNode<'RETRY'> = {
    id: 'r',
    type: 'RETRY',
    config: { maxAttempts: 3, backoff: 'fixed', delayMs: 0 },
    position: { x: 0, y: 0 },
  };

  it('follows next while attempts remain, then exhausted', async () => {
    const { ctx, variables } = makeContext();
    // First visit: attempt 1 → next.
    let result = await executor.execute(retryNode, ctx);
    expect(result.outPort).toBe('next');
    expect((result.output as { attempt: number }).attempt).toBe(1);
    // Second visit: attempt 2 → next.
    result = await executor.execute(retryNode, ctx);
    expect(result.outPort).toBe('next');
    expect((result.output as { attempt: number }).attempt).toBe(2);
    // Third visit: attempt 3 → next (last usable attempt).
    result = await executor.execute(retryNode, ctx);
    expect(result.outPort).toBe('next');
    expect((result.output as { attempt: number }).attempt).toBe(3);
    // Fourth visit: budget spent → exhausted, and node state is reset.
    result = await executor.execute(retryNode, ctx);
    expect(result.outPort).toBe('exhausted');
    expect((variables.__nodeState as Record<string, unknown>).r).toBeUndefined();
  });

  it('a single-attempt retry exhausts on its second visit', async () => {
    const { ctx } = makeContext();
    const single: WorkflowNode<'RETRY'> = { ...retryNode, config: { maxAttempts: 1, backoff: 'fixed', delayMs: 0 } };
    expect((await executor.execute(single, ctx)).outPort).toBe('next');
    expect((await executor.execute(single, ctx)).outPort).toBe('exhausted');
  });
});

describe('TIMEOUT node', () => {
  const executor = new TimeoutNode();

  it('arms a deadline on first visit and follows next while within budget', async () => {
    const { ctx, variables } = makeContext();
    const node: WorkflowNode<'TIMEOUT'> = { id: 'to', type: 'TIMEOUT', config: { ms: 60_000 }, position: { x: 0, y: 0 } };
    const first = await executor.execute(node, ctx);
    expect(first.outPort).toBe('next');
    const deadline = (variables.__nodeState as Record<string, Record<string, number>>).to.deadline;
    expect(deadline).toBeGreaterThan(Date.now());
    // Second visit, still within the (60s) budget → next again.
    const second = await executor.execute(node, ctx);
    expect(second.outPort).toBe('next');
  });

  it('follows timeout once the deadline has passed', async () => {
    const { ctx, variables } = makeContext();
    const node: WorkflowNode<'TIMEOUT'> = { id: 'to', type: 'TIMEOUT', config: { ms: 0 }, position: { x: 0, y: 0 } };
    // First visit arms deadline = now + 0.
    await executor.execute(node, ctx);
    const result = await executor.execute(node, ctx);
    expect(result.outPort).toBe('timeout');
    // State reset after timeout.
    expect((variables.__nodeState as Record<string, unknown>).to).toBeUndefined();
  });
});

describe('DELAY node', () => {
  const executor = new DelayNode();

  it('waits (a tiny amount) and follows next', async () => {
    const { ctx } = makeContext();
    const node: WorkflowNode<'DELAY'> = { id: 'd', type: 'DELAY', config: { ms: 1 }, position: { x: 0, y: 0 } };
    const start = Date.now();
    const result = await executor.execute(node, ctx);
    expect(result.outPort).toBe('next');
    expect((result.output as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(1);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('rejects promptly when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx } = makeContext({ signal: controller.signal });
    const node: WorkflowNode<'DELAY'> = { id: 'd', type: 'DELAY', config: { ms: 5_000 }, position: { x: 0, y: 0 } };
    await expect(executor.execute(node, ctx)).rejects.toThrow();
  });
});
