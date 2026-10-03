/**
 * A tiny, safe expression evaluator for CONDITION / LOOP(while) / SWITCH.
 *
 * SECURITY: this never calls `eval`/`Function`. It renders `{{var}}` tokens first,
 * then tokenizes and recursive-descent parses a small grammar:
 *
 *   expr    := or
 *   or      := and ( ('||' | 'or') and )*
 *   and     := not ( ('&&' | 'and') not )*
 *   not     := ('!' | 'not') not | comparison
 *   comparison := primary ( ('==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'matches') primary )?
 *   primary := '(' expr ')' | literal
 *   literal := number | 'string' | "string" | true | false | null | bareword
 *
 * Operands are coerced sensibly: numeric comparisons when both sides look numeric,
 * otherwise string comparison. `contains` = substring, `matches` = regex test.
 */
import { renderTemplate } from './variables.js';

type TokenType =
  | 'lparen'
  | 'rparen'
  | 'op'
  | 'and'
  | 'or'
  | 'not'
  | 'value';

interface Token {
  type: TokenType;
  value: string;
}

const COMPARISON_OPS = ['>=', '<=', '==', '!=', '>', '<'] as const;
const WORD_OPS = new Set(['contains', 'matches']);

/** Break the rendered expression into tokens. Quoted strings keep their contents verbatim. */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i]!;

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    // Quoted string literal.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let str = '';
      while (j < n && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < n) {
          str += input[j + 1];
          j += 2;
        } else {
          str += input[j];
          j++;
        }
      }
      tokens.push({ type: 'value', value: str });
      i = j + 1;
      continue;
    }
    // Boolean operators.
    if (input.startsWith('&&', i)) {
      tokens.push({ type: 'and', value: '&&' });
      i += 2;
      continue;
    }
    if (input.startsWith('||', i)) {
      tokens.push({ type: 'or', value: '||' });
      i += 2;
      continue;
    }
    if (ch === '!' && input[i + 1] !== '=') {
      tokens.push({ type: 'not', value: '!' });
      i++;
      continue;
    }
    // Multi-char then single-char comparison operators.
    const cmp = COMPARISON_OPS.find((op) => input.startsWith(op, i));
    if (cmp) {
      tokens.push({ type: 'op', value: cmp });
      i += cmp.length;
      continue;
    }
    // Bareword: identifier, number, keyword (and/or/not/contains/matches/true/false/null).
    let j = i;
    let word = '';
    while (j < n && !/[\s()!<>=&|'"]/.test(input[j]!)) {
      word += input[j];
      j++;
    }
    if (word.length === 0) {
      // Unknown single character — skip to avoid infinite loop.
      i++;
      continue;
    }
    const lower = word.toLowerCase();
    if (lower === 'and') tokens.push({ type: 'and', value: '&&' });
    else if (lower === 'or') tokens.push({ type: 'or', value: '||' });
    else if (lower === 'not') tokens.push({ type: 'not', value: '!' });
    else if (WORD_OPS.has(lower)) tokens.push({ type: 'op', value: lower });
    else tokens.push({ type: 'value', value: word });
    i = j;
  }
  return tokens;
}

/** Recursive-descent parser + evaluator over the token stream. */
class Evaluator {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  evaluate(): boolean {
    const result = this.parseOr();
    return toBool(result);
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek()?.type === 'or') {
      this.next();
      const right = this.parseAnd();
      left = toBool(left) || toBool(right);
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseNot();
    while (this.peek()?.type === 'and') {
      this.next();
      const right = this.parseNot();
      left = toBool(left) && toBool(right);
    }
    return left;
  }

  private parseNot(): unknown {
    if (this.peek()?.type === 'not') {
      this.next();
      return !toBool(this.parseNot());
    }
    return this.parseComparison();
  }

  private parseComparison(): unknown {
    const left = this.parsePrimary();
    const opTok = this.peek();
    if (opTok?.type === 'op') {
      this.next();
      const right = this.parsePrimary();
      return applyComparison(opTok.value, left, right);
    }
    return left;
  }

  private parsePrimary(): unknown {
    const tok = this.next();
    if (!tok) return '';
    if (tok.type === 'lparen') {
      const inner = this.parseOr();
      if (this.peek()?.type === 'rparen') this.next();
      return inner;
    }
    return coerceLiteral(tok.value);
  }
}

/** Coerce a bareword/quoted token into number | boolean | null | string. */
function coerceLiteral(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw !== '' && !Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw.trim())) {
    return Number(raw);
  }
  return raw;
}

/** JS-like truthiness, with numeric-string awareness. */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (value == null) return false;
  const s = String(value).trim();
  if (s === '') return false;
  if (s === 'false' || s === '0' || s === 'null' || s === 'undefined') return false;
  return true;
}

/** Apply a comparison operator, choosing numeric vs string comparison. */
function applyComparison(op: string, left: unknown, right: unknown): boolean {
  if (op === 'contains') {
    return String(left).includes(String(right));
  }
  if (op === 'matches') {
    try {
      return new RegExp(String(right)).test(String(left));
    } catch {
      return false;
    }
  }

  const ln = asNumber(left);
  const rn = asNumber(right);
  const numeric = ln != null && rn != null;

  switch (op) {
    case '==':
      return numeric ? ln === rn : looseEqual(left, right);
    case '!=':
      return numeric ? ln !== rn : !looseEqual(left, right);
    case '>':
      return numeric ? ln! > rn! : String(left) > String(right);
    case '>=':
      return numeric ? ln! >= rn! : String(left) >= String(right);
    case '<':
      return numeric ? ln! < rn! : String(left) < String(right);
    case '<=':
      return numeric ? ln! <= rn! : String(left) <= String(right);
    default:
      return false;
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'boolean') return null;
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '' || Number.isNaN(Number(s))) return null;
  return Number(s);
}

function looseEqual(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

/**
 * Render `{{var}}` tokens against `vars`, then evaluate the resulting expression to a boolean.
 * Any parse/eval failure resolves to `false` (fail-safe) rather than throwing.
 */
export function evaluateExpression(expression: string, vars: Record<string, unknown>): boolean {
  const rendered = renderTemplate(expression, vars);
  try {
    const tokens = tokenize(rendered);
    if (tokens.length === 0) return false;
    return new Evaluator(tokens).evaluate();
  } catch {
    return false;
  }
}

/**
 * Evaluate the `on` value of a SWITCH: render + coerce to a comparable string.
 * Used to match against configured case values.
 */
export function evaluateSwitchValue(expression: string, vars: Record<string, unknown>): string {
  return renderTemplate(expression, vars).trim();
}
