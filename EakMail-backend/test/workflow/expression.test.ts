import { describe, it, expect } from 'vitest';
import { renderTemplate, renderValue } from '../../src/workflow/variables.js';
import { evaluateExpression } from '../../src/workflow/expression.js';

describe('renderTemplate', () => {
  it('substitutes tokens and dotted paths', () => {
    const vars = { name: 'Asep', order: { id: 42 } };
    expect(renderTemplate('Hi {{name}} #{{order.id}}', vars)).toBe('Hi Asep #42');
  });
  it('renders unknown tokens as empty', () => {
    expect(renderTemplate('x={{missing}}', {})).toBe('x=');
  });
  it('renderValue preserves raw type for a single token', () => {
    expect(renderValue('{{n}}', { n: 5 })).toBe(5);
    expect(renderValue('n={{n}}', { n: 5 })).toBe('n=5');
  });
});

describe('evaluateExpression', () => {
  const vars = { stock: 3, status: 'ok', name: 'Netflix Premium' };
  it('numeric comparisons', () => {
    expect(evaluateExpression('{{stock}} > 0', vars)).toBe(true);
    expect(evaluateExpression('{{stock}} >= 3', vars)).toBe(true);
    expect(evaluateExpression('{{stock}} < 3', vars)).toBe(false);
  });
  it('string equality and contains', () => {
    expect(evaluateExpression("{{status}} == 'ok'", vars)).toBe(true);
    expect(evaluateExpression("{{name}} contains 'Premium'", vars)).toBe(true);
  });
  it('boolean composition', () => {
    expect(evaluateExpression("{{stock}} > 0 && {{status}} == 'ok'", vars)).toBe(true);
    expect(evaluateExpression("{{stock}} > 5 || {{status}} == 'ok'", vars)).toBe(true);
    expect(evaluateExpression('!({{stock}} > 5)', vars)).toBe(true);
  });
  it('matches regex operator', () => {
    expect(evaluateExpression("{{name}} matches 'Net.+'", vars)).toBe(true);
  });
  it('fails safe on garbage', () => {
    expect(evaluateExpression('>>> ((', vars)).toBe(false);
  });
});
