/**
 * LOOP: a re-entrant control node. Each visit decides whether to run the body again.
 *  - `count` mode: iterate `count` times.
 *  - `while` mode: iterate while `whileExpression` is true.
 * A hard `maxIterations` cap always applies (guards runaway loops). The loop body must
 * route its final edge back to this LOOP node so the counter advances on each pass.
 * Follows `body` to run another iteration, `done` when finished.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { evaluateExpression } from '../expression.js';
import { getNodeCounter, setNodeCounter, resetNodeState } from './node-state.js';

export class LoopNode implements NodeExecutor<'LOOP'> {
  readonly type = 'LOOP' as const;

  async execute(node: WorkflowNode<'LOOP'>, ctx: ExecutionContext): Promise<NodeResult> {
    const iterations = getNodeCounter(ctx.variables, node.id, 'iterations');
    const maxIterations = Math.max(1, node.config.maxIterations);

    // Expose the current 0-based iteration index for the body to read as {{__loop.<id>}}.
    ctx.variables[`__loop_${node.id}`] = iterations;

    if (iterations >= maxIterations) {
      resetNodeState(ctx.variables, node.id);
      return { outPort: 'done', output: { iterations, reason: 'max-iterations' } };
    }

    const shouldContinue =
      node.config.mode === 'count'
        ? iterations < Math.max(0, node.config.count ?? 0)
        : evaluateExpression(node.config.whileExpression ?? 'false', ctx.variables);

    if (!shouldContinue) {
      resetNodeState(ctx.variables, node.id);
      return { outPort: 'done', output: { iterations } };
    }

    setNodeCounter(ctx.variables, node.id, 'iterations', iterations + 1);
    return { outPort: 'body', output: { iteration: iterations } };
  }
}
