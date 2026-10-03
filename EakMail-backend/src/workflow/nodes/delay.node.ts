/** DELAY: pause for a fixed duration plus optional random jitter (human-like pacing). */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { delay } from './helpers.js';

export class DelayNode implements NodeExecutor<'DELAY'> {
  readonly type = 'DELAY' as const;

  async execute(node: WorkflowNode<'DELAY'>, ctx: ExecutionContext): Promise<NodeResult> {
    const base = Math.max(0, node.config.ms);
    const jitter = node.config.jitterMs ? Math.floor(Math.random() * node.config.jitterMs) : 0;
    const total = base + jitter;
    await delay(total, ctx.signal);
    return { outPort: 'next', output: { waitedMs: total } };
  }
}
