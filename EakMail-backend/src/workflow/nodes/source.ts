/**
 * Resolve the "source text" a MATCH_TEXT / EXTRACT_DATA node reads from.
 * `source` is either the literal 'lastMessage' (default) or a variable name/path.
 */
import type { ExecutionContext } from '../engine/node-executor.js';
import { resolvePath } from '../variables.js';

export function resolveSourceText(
  source: string | undefined,
  ctx: ExecutionContext,
): string {
  if (!source || source === 'lastMessage') {
    return ctx.conversation?.lastMessage()?.text ?? '';
  }
  const value = resolvePath(ctx.variables, source);
  return value == null ? '' : String(value);
}
