/**
 * Unit tests for the logic + data node executors that were not covered by the e2e path:
 * MATCH_TEXT (contains/regex/equals + no-match), EXTRACT_DATA (named groups → variables,
 * assignTo, no-match, invalid regex), CONDITION (true/false), SWITCH (case/default),
 * TRANSFORM (op pipeline), SET_VARIABLE. Each runs the executor directly against a
 * hand-built ExecutionContext (no engine, no Redis, no Telegram).
 */
import '../_env.js';
import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '@eakmail/shared-types';
import { makeContext } from '../../support/node-context.js';
import { MatchTextNode } from '../../../src/workflow/nodes/match-text.node.js';
import { ExtractDataNode } from '../../../src/workflow/nodes/extract-data.node.js';
import { ConditionNode } from '../../../src/workflow/nodes/condition.node.js';
import { SwitchNode } from '../../../src/workflow/nodes/switch.node.js';
import { TransformNode } from '../../../src/workflow/nodes/transform.node.js';
import { SetVariableNode } from '../../../src/workflow/nodes/set-variable.node.js';

function node<T extends WorkflowNode>(n: T): T {
  return n;
}

describe('MATCH_TEXT node', () => {
  const executor = new MatchTextNode();

  it('contains: matches a substring of the last message', async () => {
    const { ctx } = makeContext({ variables: { src: 'Silakan pilih produk' } });
    const result = await executor.execute(
      node({ id: 'm', type: 'MATCH_TEXT', config: { mode: 'contains', pattern: 'pilih', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('matched');
    expect(result.output).toEqual({ matched: true, pattern: 'pilih' });
  });

  it('equals: exact comparison is case-insensitive by default', async () => {
    const { ctx } = makeContext({ variables: { src: 'OK' } });
    const result = await executor.execute(
      node({ id: 'm', type: 'MATCH_TEXT', config: { mode: 'equals', pattern: 'ok', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('matched');
  });

  it('regex: matches via a pattern', async () => {
    const { ctx } = makeContext({ variables: { src: 'harga: 15000' } });
    const result = await executor.execute(
      node({ id: 'm', type: 'MATCH_TEXT', config: { mode: 'regex', pattern: '\\d{4,}', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('matched');
  });

  it('no-match: follows no-match when the pattern is absent', async () => {
    const { ctx } = makeContext({ variables: { src: 'tidak ada' } });
    const result = await executor.execute(
      node({ id: 'm', type: 'MATCH_TEXT', config: { mode: 'contains', pattern: 'stok', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('no-match');
    expect((result.output as { matched: boolean }).matched).toBe(false);
  });

  it('renders {{var}} in the pattern before matching', async () => {
    const { ctx } = makeContext({ variables: { src: 'produk Netflix', want: 'Netflix' } });
    const result = await executor.execute(
      node({ id: 'm', type: 'MATCH_TEXT', config: { mode: 'contains', pattern: '{{want}}', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('matched');
    expect((result.output as { pattern: string }).pattern).toBe('Netflix');
  });
});

describe('EXTRACT_DATA node', () => {
  const executor = new ExtractDataNode();

  it('named groups become variables and emit variableSet', async () => {
    const { ctx, emitter, variables } = makeContext({
      variables: { src: 'Email: a@b.com Pass: s3cret' },
    });
    const result = await executor.execute(
      node({
        id: 'x',
        type: 'EXTRACT_DATA',
        config: { regex: 'Email: (?<email>\\S+) Pass: (?<password>\\S+)', source: 'src' },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('extracted');
    expect(variables.email).toBe('a@b.com');
    expect(variables.password).toBe('s3cret');
    expect(emitter.variables).toContainEqual({ name: 'email', value: 'a@b.com' });
  });

  it('assignTo writes the first unnamed group', async () => {
    const { ctx, variables } = makeContext({ variables: { src: 'CODE-9182' } });
    const result = await executor.execute(
      node({
        id: 'x',
        type: 'EXTRACT_DATA',
        config: { regex: 'CODE-(\\d+)', source: 'src', assignTo: 'code' },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('extracted');
    expect(variables.code).toBe('9182');
  });

  it('follows no-match when the regex does not match', async () => {
    const { ctx } = makeContext({ variables: { src: 'nothing here' } });
    const result = await executor.execute(
      node({ id: 'x', type: 'EXTRACT_DATA', config: { regex: 'Email: (?<email>\\S+)', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('no-match');
  });

  it('an invalid regex logs an error and follows no-match', async () => {
    const { ctx, emitter } = makeContext({ variables: { src: 'x' } });
    const result = await executor.execute(
      node({ id: 'x', type: 'EXTRACT_DATA', config: { regex: '(', source: 'src' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('no-match');
    expect(emitter.logs.some((l) => l.level === 'error')).toBe(true);
    expect((result.output as { error: string }).error).toBe('invalid-regex');
  });
});

describe('CONDITION node', () => {
  const executor = new ConditionNode();

  it('follows true when the expression evaluates truthy', async () => {
    const { ctx } = makeContext({ variables: { stock: 3 } });
    const result = await executor.execute(
      node({ id: 'c', type: 'CONDITION', config: { expression: '{{stock}} > 0' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('true');
    expect((result.output as { result: boolean }).result).toBe(true);
  });

  it('follows false when the expression evaluates falsy', async () => {
    const { ctx } = makeContext({ variables: { stock: 0 } });
    const result = await executor.execute(
      node({ id: 'c', type: 'CONDITION', config: { expression: '{{stock}} > 0' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('false');
  });
});

describe('SWITCH node', () => {
  const executor = new SwitchNode();

  it('routes to the matching case port', async () => {
    const { ctx } = makeContext({ variables: { status: 'paid' } });
    const result = await executor.execute(
      node({
        id: 's',
        type: 'SWITCH',
        config: { on: '{{status}}', cases: [{ value: 'paid' }, { value: 'failed' }] },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('case:paid');
    expect((result.output as { matched: boolean }).matched).toBe(true);
  });

  it('falls back to default when no case matches', async () => {
    const { ctx } = makeContext({ variables: { status: 'unknown' } });
    const result = await executor.execute(
      node({
        id: 's',
        type: 'SWITCH',
        config: { on: '{{status}}', cases: [{ value: 'paid' }] },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('default');
    expect((result.output as { matched: boolean }).matched).toBe(false);
  });
});

describe('TRANSFORM node', () => {
  const executor = new TransformNode();

  it('applies an op pipeline in order and writes the output variable', async () => {
    const { ctx, variables, emitter } = makeContext({ variables: { raw: '  Email: a@b.com  ' } });
    const result = await executor.execute(
      node({
        id: 't',
        type: 'TRANSFORM',
        config: {
          input: 'raw',
          output: 'clean',
          operations: [
            { op: 'trim' },
            { op: 'split', separator: ': ', index: 1 },
            { op: 'lowercase' },
          ],
        },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('next');
    expect(variables.clean).toBe('a@b.com');
    expect(emitter.variables).toContainEqual({ name: 'clean', value: 'a@b.com' });
  });

  it('replace and template ops compose over the running value', async () => {
    const { ctx, variables } = makeContext({ variables: { name: 'net-flix', suffix: 'PRO' } });
    const result = await executor.execute(
      node({
        id: 't',
        type: 'TRANSFORM',
        config: {
          input: 'name',
          output: 'label',
          operations: [
            { op: 'replace', find: '-', replaceWith: ' ' },
            { op: 'uppercase' },
            { op: 'template', template: '{{value}} {{suffix}}' },
          ],
        },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(result.outPort).toBe('next');
    expect(variables.label).toBe('NET FLIX PRO');
  });

  it('treats a missing input variable as an empty string', async () => {
    const { ctx, variables } = makeContext({ variables: {} });
    await executor.execute(
      node({
        id: 't',
        type: 'TRANSFORM',
        config: { input: 'missing', output: 'out', operations: [{ op: 'uppercase' }] },
        position: { x: 0, y: 0 },
      }),
      ctx,
    );
    expect(variables.out).toBe('');
  });
});

describe('SET_VARIABLE node', () => {
  const executor = new SetVariableNode();

  it('renders a template value and stores it', async () => {
    const { ctx, variables, emitter } = makeContext({ variables: { name: 'Asep' } });
    const result = await executor.execute(
      node({ id: 'v', type: 'SET_VARIABLE', config: { name: 'greeting', value: 'Halo {{name}}' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(result.outPort).toBe('next');
    expect(variables.greeting).toBe('Halo Asep');
    expect(emitter.variables).toContainEqual({ name: 'greeting', value: 'Halo Asep' });
  });

  it('preserves the raw type for a single-token value', async () => {
    const { ctx, variables } = makeContext({ variables: { count: 7 } });
    await executor.execute(
      node({ id: 'v', type: 'SET_VARIABLE', config: { name: 'n', value: '{{count}}' }, position: { x: 0, y: 0 } }),
      ctx,
    );
    expect(variables.n).toBe(7);
  });
});
