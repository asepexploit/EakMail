/** SET_VARIABLE: assign a rendered literal/expression to a named variable. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { renderValue } from '../variables.js';

export class SetVariableNode implements NodeExecutor<'SET_VARIABLE'> {
  readonly type = 'SET_VARIABLE' as const;

  async execute(node: WorkflowNode<'SET_VARIABLE'>, ctx: ExecutionContext): Promise<NodeResult> {
    const { name, value } = node.config;
    const resolved = renderValue(value, ctx.variables);
    ctx.variables[name] = resolved;
    ctx.emitter.variableSet(name, resolved);
    return { outPort: 'next', output: { name, value: resolved } };
  }
}
