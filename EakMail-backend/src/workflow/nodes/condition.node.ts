/** CONDITION: evaluate a boolean expression over variables. Follows `true` or `false`. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { evaluateExpression } from '../expression.js';

export class ConditionNode implements NodeExecutor<'CONDITION'> {
  readonly type = 'CONDITION' as const;

  async execute(node: WorkflowNode<'CONDITION'>, ctx: ExecutionContext): Promise<NodeResult> {
    const result = evaluateExpression(node.config.expression, ctx.variables);
    return {
      outPort: result ? 'true' : 'false',
      output: { expression: node.config.expression, result },
    };
  }
}
