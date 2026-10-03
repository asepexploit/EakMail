/**
 * TRANSFORM: read an input variable, apply a pipeline of string operations, and write
 * the result to an output variable. Ops are applied in order. BLUEPRINT.md §12.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode, TransformOp } from '@eakmail/shared-types';
import { resolvePath, renderTemplate } from '../variables.js';

export class TransformNode implements NodeExecutor<'TRANSFORM'> {
  readonly type = 'TRANSFORM' as const;

  async execute(node: WorkflowNode<'TRANSFORM'>, ctx: ExecutionContext): Promise<NodeResult> {
    const initial = resolvePath(ctx.variables, node.config.input);
    let value = initial == null ? '' : String(initial);

    for (const op of node.config.operations) {
      value = applyOp(value, op, ctx.variables);
    }

    ctx.variables[node.config.output] = value;
    ctx.emitter.variableSet(node.config.output, value);
    return { outPort: 'next', output: { input: node.config.input, output: value } };
  }
}

/** Apply a single transform operation to a string value. */
function applyOp(value: string, op: TransformOp, vars: Record<string, unknown>): string {
  switch (op.op) {
    case 'trim':
      return value.trim();
    case 'lowercase':
      return value.toLowerCase();
    case 'uppercase':
      return value.toUpperCase();
    case 'split': {
      const parts = value.split(op.separator);
      if (op.index === undefined) return parts[0] ?? '';
      return parts[op.index] ?? '';
    }
    case 'replace':
      return value.split(op.find).join(op.replaceWith);
    case 'template':
      return renderTemplate(op.template, { ...vars, value });
    default:
      return value;
  }
}
