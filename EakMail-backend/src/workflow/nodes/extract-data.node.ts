/**
 * EXTRACT_DATA: run a regex over the source text and write captures to variables.
 * Named groups (`(?<key>...)`) become `variables[key]`. When the regex has a single
 * unnamed group and `assignTo` is set, that group is written to `variables[assignTo]`.
 *
 * mode='first' (default): only the first match. mode='all': every match — each named group is
 * collected across all matches and joined with `joinWith` (default newline), plus `assignTo`
 * (or `account` fallback) holds the joined full-match/first-group. This handles a supplier that
 * sends many lines at once (e.g. 10 `email|password` accounts). BLUEPRINT.md §12.
 *
 * Follows `extracted` when at least one match is found, `no-match` otherwise.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { resolveSourceText } from './source.js';

export class ExtractDataNode implements NodeExecutor<'EXTRACT_DATA'> {
  readonly type = 'EXTRACT_DATA' as const;

  async execute(node: WorkflowNode<'EXTRACT_DATA'>, ctx: ExecutionContext): Promise<NodeResult> {
    const text = resolveSourceText(node.config.source, ctx);
    const mode = node.config.mode ?? 'first';
    const joinWith = node.config.joinWith ?? '\n';

    let regex: RegExp;
    try {
      // 'all' mode needs the global flag for matchAll, and multiline so per-line patterns with
      // ^/$ anchors match each line (suppliers list one account per line).
      regex = new RegExp(node.config.regex, mode === 'all' ? 'gm' : undefined);
    } catch {
      ctx.emitter.log('error', `Invalid EXTRACT_DATA regex: ${node.config.regex}`);
      return { outPort: 'no-match', output: { error: 'invalid-regex' } };
    }

    return mode === 'all'
      ? this.extractAll(node, ctx, text, regex, joinWith)
      : this.extractFirst(node, ctx, text, regex);
  }

  /** Original single-match behaviour. */
  private extractFirst(
    node: WorkflowNode<'EXTRACT_DATA'>,
    ctx: ExecutionContext,
    text: string,
    regex: RegExp,
  ): NodeResult {
    const match = regex.exec(text);
    if (!match) {
      this.clearStale(node, ctx);
      return { outPort: 'no-match', output: { regex: node.config.regex } };
    }

    const extracted: Record<string, string> = {};
    if (match.groups) {
      for (const [key, value] of Object.entries(match.groups)) {
        if (value !== undefined) this.assign(ctx, extracted, key, value);
      }
    }
    if (node.config.assignTo && match[1] !== undefined) {
      this.assign(ctx, extracted, node.config.assignTo, match[1]);
    }
    return { outPort: 'extracted', output: { extracted } };
  }

  /** Capture every match; collect each named group across matches, joined with `joinWith`. */
  private extractAll(
    node: WorkflowNode<'EXTRACT_DATA'>,
    ctx: ExecutionContext,
    text: string,
    regex: RegExp,
    joinWith: string,
  ): NodeResult {
    const matches = [...text.matchAll(regex)];
    if (matches.length === 0) {
      this.clearStale(node, ctx);
      return { outPort: 'no-match', output: { regex: node.config.regex } };
    }

    const grouped: Record<string, string[]> = {};
    const wholes: string[] = [];
    for (const m of matches) {
      wholes.push((m[1] ?? m[0]) as string);
      if (m.groups) {
        for (const [key, value] of Object.entries(m.groups)) {
          if (value !== undefined) (grouped[key] ??= []).push(value);
        }
      }
    }

    const extracted: Record<string, string> = {};
    for (const [key, values] of Object.entries(grouped)) {
      this.assign(ctx, extracted, key, values.join(joinWith));
    }
    // Also expose the joined list under assignTo (or a sensible `account` default) so the
    // DELIVER template can send the whole block with a single {{variable}}.
    const listKey = node.config.assignTo ?? (Object.keys(grouped).length === 0 ? 'account' : null);
    if (listKey) this.assign(ctx, extracted, listKey, wholes.join(joinWith));

    return { outPort: 'extracted', output: { extracted, count: matches.length } };
  }

  private assign(
    ctx: ExecutionContext,
    extracted: Record<string, string>,
    key: string,
    value: string,
  ): void {
    ctx.variables[key] = value;
    ctx.emitter.variableSet(key, value);
    extracted[key] = value;
  }

  /**
   * On no-match, blank out the target variables so a previous iteration's capture never leaks
   * downstream. Without this, in a quantity>1 run, iteration N's DELIVER could render the
   * credentials captured by iteration N-1 — a serious data-correctness bug.
   */
  private clearStale(node: WorkflowNode<'EXTRACT_DATA'>, ctx: ExecutionContext): void {
    const target = node.config.assignTo;
    if (target && target in ctx.variables) {
      ctx.variables[target] = '';
      ctx.emitter.variableSet(target, '');
    }
    // Named groups cannot be known without a match — but by convention supplier flows pair
    // `assignTo` with the full line and define named groups like `email`/`pass`. Clear those
    // common ones too if present from a prior iteration.
    for (const key of Object.keys(ctx.variables)) {
      // Heuristic: only touch simple string variables that were likely written by an EXTRACT.
      // We skip workflow seed vars (orderId/quantity/etc) and object/list values.
      if (
        typeof ctx.variables[key] === 'string' &&
        key !== target &&
        isLikelyExtractedKey(key)
      ) {
        ctx.variables[key] = '';
        ctx.emitter.variableSet(key, '');
      }
    }
  }
}

/**
 * Heuristic: keys we treat as "likely captured by a prior EXTRACT iteration" and safe to blank
 * on no-match. We never clear the fixed seed names from fulfillment-context.ts.
 */
const SEED_KEYS = new Set([
  'orderId',
  'quantity',
  'amount',
  'productId',
  'productName',
  'productSku',
  'customerTelegramId',
  'language',
  'itemIndex',
  'itemTotal',
]);
function isLikelyExtractedKey(key: string): boolean {
  return !SEED_KEYS.has(key) && !key.startsWith('__');
}
