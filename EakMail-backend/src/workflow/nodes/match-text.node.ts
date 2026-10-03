/**
 * MATCH_TEXT: test a source text against a pattern.
 * Follows `matched` or `no-match`.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { matchText } from './helpers.js';
import { resolveSourceText } from './source.js';

export class MatchTextNode implements NodeExecutor<'MATCH_TEXT'> {
  readonly type = 'MATCH_TEXT' as const;

  async execute(node: WorkflowNode<'MATCH_TEXT'>, ctx: ExecutionContext): Promise<NodeResult> {
    const text = resolveSourceText(node.config.source, ctx);
    const pattern = ctx.render(node.config.pattern);
    const isMatch = matchText(text, node.config.mode, pattern, node.config.caseSensitive);
    return {
      outPort: isMatch ? 'matched' : 'no-match',
      output: { matched: isMatch, pattern },
    };
  }
}
