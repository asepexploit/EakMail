/**
 * Focused tests for the variable layer beyond expression.test.ts:
 *  - resolvePath over dotted paths + missing intermediates
 *  - renderTemplate object stringification + unknown-token blanking
 *  - renderValue raw-type preservation
 *  - evaluateExpression: missing variable renders empty, boolean ops, != / <= operators
 */
import './_env.js';
import { describe, it, expect } from 'vitest';
import { renderTemplate, renderValue, resolvePath } from '../../src/workflow/variables.js';
import { evaluateExpression, evaluateSwitchValue } from '../../src/workflow/expression.js';

describe('resolvePath', () => {
  it('resolves nested dotted paths', () => {
    expect(resolvePath({ a: { b: { c: 5 } } }, 'a.b.c')).toBe(5);
  });
  it('returns undefined when an intermediate is missing', () => {
    expect(resolvePath({ a: {} }, 'a.b.c')).toBeUndefined();
    expect(resolvePath({}, 'x')).toBeUndefined();
  });
});

describe('renderTemplate', () => {
  it('stringifies objects as JSON', () => {
    expect(renderTemplate('v={{o}}', { o: { x: 1 } })).toBe('v={"x":1}');
  });
  it('renders null/undefined tokens as empty', () => {
    expect(renderTemplate('a={{a}} b={{b}}', { a: null })).toBe('a= b=');
  });
});

describe('renderValue', () => {
  it('returns the raw value for a single whitespace-padded token', () => {
    expect(renderValue('{{ n }}', { n: 42 })).toBe(42);
    expect(renderValue('{{ flag }}', { flag: false })).toBe(false);
  });
  it('returns a string when the template has surrounding text', () => {
    expect(renderValue('id-{{n}}', { n: 42 })).toBe('id-42');
  });
});

describe('evaluateExpression — additional coverage', () => {
  it('a missing variable renders empty and a bare token is falsy', () => {
    // A bare missing token → '' → falsy.
    expect(evaluateExpression('{{missing}}', {})).toBe(false);
    // A missing var quoted against a literal is a plain (false) string comparison.
    expect(evaluateExpression("'{{missing}}' == 'ok'", {})).toBe(false);
    expect(evaluateExpression("'{{missing}}' == ''", {})).toBe(true);
    // A present var still compares normally.
    expect(evaluateExpression("{{status}} == 'ok'", { status: 'ok' })).toBe(true);
  });
  it('inequality and <= operators', () => {
    expect(evaluateExpression('{{n}} != 3', { n: 4 })).toBe(true);
    expect(evaluateExpression('{{n}} <= 3', { n: 3 })).toBe(true);
    expect(evaluateExpression('{{n}} <= 3', { n: 4 })).toBe(false);
  });
  it('boolean literals and negation', () => {
    expect(evaluateExpression('true && !false', {})).toBe(true);
    expect(evaluateExpression('false || false', {})).toBe(false);
  });
  it('numeric vs string comparison is chosen sensibly', () => {
    // Both numeric-looking → numeric compare (10 > 9, not "10" > "9" lexically... which is also true,
    // so use a case that differs): 10 > 2 numerically true; lexically "10" < "2".
    expect(evaluateExpression('{{a}} > {{b}}', { a: 10, b: 2 })).toBe(true);
  });
});

describe('evaluateSwitchValue', () => {
  it('renders and trims the on-value', () => {
    expect(evaluateSwitchValue('  {{status}} ', { status: 'paid' })).toBe('paid');
  });
});
