/** START: the single entry node. Emits nothing, just proceeds to `next`. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';

export class StartNode implements NodeExecutor<'START'> {
  readonly type = 'START' as const;

  async execute(_node: WorkflowNode<'START'>, _ctx: ExecutionContext): Promise<NodeResult> {
    return { outPort: 'next' };
  }
}
