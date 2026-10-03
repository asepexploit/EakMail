/**
 * TIMEOUT: a re-entrant control node bounding a downstream region by wall-clock time.
 * First visit arms a deadline (now + ms) and follows `next` into the region. When the
 * region's edge loops back here, it re-checks: still within budget → `next` again;
 * deadline passed → `timeout`. The deadline is stored in node state so it survives resume.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { getNodeCounter, setNodeCounter, resetNodeState } from './node-state.js';

export class TimeoutNode implements NodeExecutor<'TIMEOUT'> {
  readonly type = 'TIMEOUT' as const;

  async execute(node: WorkflowNode<'TIMEOUT'>, ctx: ExecutionContext): Promise<NodeResult> {
    const now = Date.now();
    let deadline = getNodeCounter(ctx.variables, node.id, 'deadline');

    if (deadline === 0) {
      deadline = now + Math.max(0, node.config.ms);
      setNodeCounter(ctx.variables, node.id, 'deadline', deadline);
      return { outPort: 'next', output: { deadline } };
    }

    if (now >= deadline) {
      resetNodeState(ctx.variables, node.id);
      return { outPort: 'timeout', output: { deadline, now } };
    }

    return { outPort: 'next', output: { deadline, remainingMs: deadline - now } };
  }
}
