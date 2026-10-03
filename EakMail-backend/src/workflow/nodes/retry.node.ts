/**
 * RETRY: a re-entrant control node guarding a downstream region. Each visit consumes one
 * attempt: while attempts remain it follows `next` (re-run the region); once the attempt
 * budget is spent it follows `exhausted`. The region's failure edge must loop back to this
 * RETRY node. Backoff delay (fixed/exponential) is applied before each re-attempt.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { getNodeCounter, setNodeCounter, resetNodeState } from './node-state.js';
import { backoffDelay, delay } from './helpers.js';

export class RetryNode implements NodeExecutor<'RETRY'> {
  readonly type = 'RETRY' as const;

  async execute(node: WorkflowNode<'RETRY'>, ctx: ExecutionContext): Promise<NodeResult> {
    const attempt = getNodeCounter(ctx.variables, node.id, 'attempt');
    const maxAttempts = Math.max(1, node.config.maxAttempts);

    if (attempt >= maxAttempts) {
      resetNodeState(ctx.variables, node.id);
      return { outPort: 'exhausted', output: { attempt, maxAttempts } };
    }

    if (attempt > 0) {
      const wait = backoffDelay(
        { maxAttempts, backoff: node.config.backoff, delayMs: node.config.delayMs },
        attempt,
      );
      await delay(wait, ctx.signal);
    }

    setNodeCounter(ctx.variables, node.id, 'attempt', attempt + 1);
    return { outPort: 'next', output: { attempt: attempt + 1, maxAttempts } };
  }
}
