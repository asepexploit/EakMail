/**
 * DELIVER_TO_CUSTOMER: terminal node that renders the delivery template and hands the
 * payload back to the engine as a successful terminal result. The interpreter/fulfillment
 * layer is responsible for the actual customer-side send + encrypted delivery record;
 * this node's job is to compute the final payload and mark the execution delivered.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';

export class DeliverToCustomerNode implements NodeExecutor<'DELIVER_TO_CUSTOMER'> {
  readonly type = 'DELIVER_TO_CUSTOMER' as const;

  async execute(
    node: WorkflowNode<'DELIVER_TO_CUSTOMER'>,
    ctx: ExecutionContext,
  ): Promise<NodeResult> {
    const message = ctx.render(node.config.template);
    ctx.emitter.log('info', 'Delivering payload to customer');
    return {
      outPort: '',
      output: { deliver: true, message },
      terminal: { kind: 'success', payload: { deliver: true, message } },
    };
  }
}
