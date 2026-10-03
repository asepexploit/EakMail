/**
 * SWITCH: render the `on` value and route to the matching `case:<value>` port,
 * falling back to `default` when no case matches.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { evaluateSwitchValue } from '../expression.js';

export class SwitchNode implements NodeExecutor<'SWITCH'> {
  readonly type = 'SWITCH' as const;

  async execute(node: WorkflowNode<'SWITCH'>, ctx: ExecutionContext): Promise<NodeResult> {
    const value = evaluateSwitchValue(node.config.on, ctx.variables);
    const matched = node.config.cases.find((c) => c.value === value);
    const outPort = matched ? `case:${matched.value}` : 'default';
    return { outPort, output: { value, matched: matched != null } };
  }
}
