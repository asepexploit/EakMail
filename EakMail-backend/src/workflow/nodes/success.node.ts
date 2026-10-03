/** SUCCESS: terminal node marking a successful execution with an optional payload. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';

export class SuccessNode implements NodeExecutor<'SUCCESS'> {
  readonly type = 'SUCCESS' as const;

  async execute(node: WorkflowNode<'SUCCESS'>, ctx: ExecutionContext): Promise<NodeResult> {
    const payload = node.config.payload ? ctx.render(node.config.payload) : undefined;
    return {
      outPort: '',
      output: { payload },
      terminal: { kind: 'success', payload },
    };
  }
}
