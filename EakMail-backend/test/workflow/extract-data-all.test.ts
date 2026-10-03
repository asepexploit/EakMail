/**
 * EXTRACT_DATA mode='all' — capturing many accounts from one supplier message
 * (the real "supplier sends 10 email|password lines at once" case).
 */
import { describe, expect, it, vi } from 'vitest';
import type { WorkflowNode } from '@eakmail/shared-types';
import { ExtractDataNode } from '../../src/workflow/nodes/extract-data.node.js';
import type { ExecutionContext } from '../../src/workflow/engine/node-executor.js';

const SUPPLIER_MESSAGE = [
  '🎁 GMAIL-FRESH',
  'aisyahsitiii589@gmail.com|@Fresh123',
  'melatiindah6281@gmail.com|@Fresh123',
  'aryaarawr31@gmail.com|@Fresh123',
  'saniraisa852@gmail.com|@Fresh123',
].join('\n');

function makeCtx(lastText: string): ExecutionContext {
  return {
    executionId: 'test',
    variables: {},
    conversation: {
      lastMessage: () => ({ id: 1, peer: 'x', text: lastText, buttons: [], date: 0 }),
    } as unknown as ExecutionContext['conversation'],
    emitter: {
      messageSent: vi.fn(),
      messageReceived: vi.fn(),
      variableSet: vi.fn(),
      log: vi.fn(),
    },
    render: (t: string) => t,
    signal: new AbortController().signal,
  };
}

function node(config: Record<string, unknown>): WorkflowNode<'EXTRACT_DATA'> {
  return {
    id: 'extract',
    type: 'EXTRACT_DATA',
    position: { x: 0, y: 0 },
    config: config as WorkflowNode<'EXTRACT_DATA'>['config'],
  };
}

describe('EXTRACT_DATA mode=all', () => {
  const exec = new ExtractDataNode();

  it('captures every account line and joins named groups', async () => {
    const ctx = makeCtx(SUPPLIER_MESSAGE);
    const result = await exec.execute(
      node({ regex: '^(?<email>\\S+@\\S+?)\\|(?<pass>\\S+)$', mode: 'all' }),
      ctx,
    );

    expect(result.outPort).toBe('extracted');
    // Four accounts (the emoji header line is correctly ignored).
    expect((result.output as { count: number }).count).toBe(4);
    const emails = String(ctx.variables.email).split('\n');
    expect(emails).toHaveLength(4);
    expect(emails[0]).toBe('aisyahsitiii589@gmail.com');
    expect(String(ctx.variables.pass).split('\n')).toHaveLength(4);
  });

  it('builds a deliverable account list under assignTo', async () => {
    const ctx = makeCtx(SUPPLIER_MESSAGE);
    await exec.execute(
      node({ regex: '^\\S+@\\S+\\|\\S+$', mode: 'all', assignTo: 'accounts' }),
      ctx,
    );
    const lines = String(ctx.variables.accounts).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('aisyahsitiii589@gmail.com|@Fresh123');
  });

  it('mode=first (default) still captures only the first match', async () => {
    const ctx = makeCtx(SUPPLIER_MESSAGE);
    await exec.execute(
      node({ regex: '(?<email>\\S+@\\S+?)\\|(?<pass>\\S+)' }),
      ctx,
    );
    expect(ctx.variables.email).toBe('aisyahsitiii589@gmail.com');
    expect(String(ctx.variables.email)).not.toContain('\n');
  });

  it('returns no-match when nothing matches', async () => {
    const ctx = makeCtx('no accounts here');
    const result = await exec.execute(
      node({ regex: '^\\S+@\\S+\\|\\S+$', mode: 'all' }),
      ctx,
    );
    expect(result.outPort).toBe('no-match');
  });
});
