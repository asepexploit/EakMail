/**
 * Variable templating + a small safe expression evaluator.
 *
 * Two independent concerns live here:
 *  - `renderTemplate`: substitutes `{{name}}` / `{{a.b}}` tokens in a string with
 *    values from a variables record (used by SEND_MESSAGE, DELIVER, SET_VARIABLE, ...).
 *    Also supports `{{#each array}}...{{/each}}` blocks with `{{@index}}` (0-based),
 *    `{{@index_1}}` (1-based), and bare field names scoped to the current item.
 *  - `evaluateExpression`: evaluates a boolean/comparison expression (used by
 *    CONDITION / LOOP `while` / SWITCH `on`). It parses a tiny grammar — NO `eval`,
 *    no arbitrary JS execution — supporting comparisons and boolean composition over
 *    rendered values and literals.
 *
 * Kept deliberately small and dependency-free so it is easy to audit. BLUEPRINT.md §12.
 */

/** Matches `{{ path.to.value }}` with optional surrounding whitespace. */
const TEMPLATE_TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Matches `{{#each varName}}...{{/each}}` blocks (non-greedy, dotall via [\s\S]). */
const EACH_BLOCK = /\{\{#each\s+([^}]+?)\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;

/** Resolve a dotted path (`a.b.c`) against a variables record. Returns undefined if absent. */
export function resolvePath(vars: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').map((p) => p.trim());
  let current: unknown = vars;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Convert any value to its string form for template substitution. */
function stringify(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Render one iteration of an `#each` body.
 * Inside the body, `{{@index}}` = 0-based, `{{@index_1}}` = 1-based,
 * and `{{fieldName}}` resolves against the current item first, then falls
 * back to the outer vars so outer variables remain accessible.
 */
function renderEachBody(
  body: string,
  item: unknown,
  index: number,
  outerVars: Record<string, unknown>,
): string {
  const itemFields: Record<string, unknown> =
    item != null && typeof item === 'object' ? (item as Record<string, unknown>) : {};
  const scopedVars: Record<string, unknown> = {
    ...outerVars,
    ...itemFields,
    '@index': index,
    '@index_1': index + 1,
  };
  return renderTemplate(body, scopedVars);
}

/**
 * Replace every `{{path}}` token in `template` with the corresponding variable value.
 * Also expands `{{#each array}}...{{/each}}` blocks.
 * Unknown tokens render to an empty string (never leak the raw `{{token}}`).
 */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  // First pass: expand #each blocks.
  const withEach = template.replace(EACH_BLOCK, (_full, varPath: string, body: string) => {
    const list = resolvePath(vars, varPath.trim());
    if (!Array.isArray(list)) return '';
    return list.map((item, i) => renderEachBody(body, item, i, vars)).join('');
  });

  // Second pass: substitute remaining {{token}} placeholders.
  return withEach.replace(TEMPLATE_TOKEN, (_full, path: string) =>
    stringify(resolvePath(vars, path)),
  );
}

/**
 * If the whole string is a single `{{path}}` token, return the raw (non-stringified)
 * value so callers can preserve numbers/booleans. Otherwise return the rendered string.
 */
export function renderValue(template: string, vars: Record<string, unknown>): unknown {
  const trimmed = template.trim();
  const single = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(trimmed);
  if (single && single[1]) {
    return resolvePath(vars, single[1]);
  }
  return renderTemplate(template, vars);
}
