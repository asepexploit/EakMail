/** FAIL: terminal node marking a failed execution, optionally triggering the refund path. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';

export class FailNode implements NodeExecutor<'FAIL'> {
  readonly type = 'FAIL' as const;

  async execute(node: WorkflowNode<'FAIL'>, ctx: ExecutionContext): Promise<NodeResult> {
    const reason = ctx.render(node.config.reason);
    const refund = node.config.refund ?? true;
    ctx.emitter.log('error', `Execution failed: ${reason}`);
    return {
      outPort: '',
      output: { reason, refund },
      terminal: { kind: 'fail', reason, refund },
    };
  }
}
