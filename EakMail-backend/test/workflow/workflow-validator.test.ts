/**
 * Tests for the workflow graph validator. Builds a minimal valid graph and mutates it to
 * trigger each rejection (no START, dangling node, invalid fromPort, no terminal, missing
 * required config, SWITCH port/case mismatch), and asserts the canonical graph is accepted.
 */
import './_env.js';
import { describe, it, expect } from 'vitest';
import type { WorkflowGraph } from '@eakmail/shared-types';
import { validateWorkflowGraph } from '../../src/modules/workflows/workflow-validator.js';
import { canonicalWorkflowGraph } from '../../src/db/canonical-workflow.js';

/** START → SEND_MESSAGE → SUCCESS: the smallest valid graph. */
function minimalValidGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
      { id: 'send', type: 'SEND_MESSAGE', config: { text: 'hi' }, position: { x: 0, y: 0 } },
      { id: 'ok', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'start', fromPort: 'next', to: 'send' },
      { id: 'e2', from: 'send', fromPort: 'next', to: 'ok' },
    ],
  };
}

const hasError = (result: ReturnType<typeof validateWorkflowGraph>, needle: string): boolean =>
  result.issues.some((i) => i.severity === 'error' && i.message.includes(needle));

describe('validateWorkflowGraph', () => {
  it('accepts a minimal valid graph', () => {
    const result = validateWorkflowGraph(minimalValidGraph());
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('accepts the canonical seed graph', () => {
    const result = validateWorkflowGraph(canonicalWorkflowGraph());
    expect(result.valid).toBe(true);
  });

  it('rejects a graph with no START node', () => {
    const graph = minimalValidGraph();
    graph.nodes = graph.nodes.filter((n) => n.type !== 'START');
    graph.edges = graph.edges.filter((e) => e.from !== 'start');
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'exactly one START')).toBe(true);
  });

  it('rejects more than one START node', () => {
    const graph = minimalValidGraph();
    graph.nodes.push({ id: 'start2', type: 'START', config: {}, position: { x: 0, y: 0 } });
    graph.edges.push({ id: 'e3', from: 'start2', fromPort: 'next', to: 'send' });
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'exactly one START')).toBe(true);
  });

  it('rejects a dangling (unreachable) node', () => {
    const graph = minimalValidGraph();
    graph.nodes.push({ id: 'orphan', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } });
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'unreachable from START')).toBe(true);
  });

  it('rejects an edge using an invalid fromPort', () => {
    const graph = minimalValidGraph();
    // START only exposes "next"; use a bogus port.
    graph.edges[0]!.fromPort = 'bogus';
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'invalid output port')).toBe(true);
  });

  it('rejects a graph with no terminal node', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
        { id: 'send', type: 'SEND_MESSAGE', config: { text: 'hi' }, position: { x: 0, y: 0 } },
      ],
      edges: [{ id: 'e1', from: 'start', fromPort: 'next', to: 'send' }],
    };
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'at least one terminal node')).toBe(true);
  });

  it('rejects a node missing required config', () => {
    const graph = minimalValidGraph();
    // SEND_MESSAGE requires a non-empty text.
    (graph.nodes[1] as { config: { text: string } }).config.text = '';
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'SEND_MESSAGE requires')).toBe(true);
  });

  it('accepts a well-wired SWITCH but warns on an unconnected case port', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
        { id: 'sw', type: 'SWITCH', config: { on: '{{s}}', cases: [{ value: 'a' }, { value: 'b' }] }, position: { x: 0, y: 0 } },
        { id: 'ok', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } },
        { id: 'bad', type: 'FAIL', config: { reason: 'x' }, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', from: 'start', fromPort: 'next', to: 'sw' },
        { id: 'e2', from: 'sw', fromPort: 'case:a', to: 'ok' },
        // case:b is intentionally left unconnected → warning, not error.
        { id: 'e3', from: 'sw', fromPort: 'default', to: 'bad' },
      ],
    };
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.severity === 'warning' && i.message.includes('case:b'))).toBe(true);
  });

  it('rejects a SWITCH edge whose case port has no matching configured case', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
        { id: 'sw', type: 'SWITCH', config: { on: '{{s}}', cases: [{ value: 'a' }] }, position: { x: 0, y: 0 } },
        { id: 'ok', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', from: 'start', fromPort: 'next', to: 'sw' },
        // "case:zzz" is not a configured case → invalid output port.
        { id: 'e2', from: 'sw', fromPort: 'case:zzz', to: 'ok' },
      ],
    };
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'invalid output port')).toBe(true);
  });

  it('rejects duplicate SWITCH edges on the same case port', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
        { id: 'sw', type: 'SWITCH', config: { on: '{{s}}', cases: [{ value: 'a' }] }, position: { x: 0, y: 0 } },
        { id: 'ok', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } },
        { id: 'ok2', type: 'SUCCESS', config: {}, position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', from: 'start', fromPort: 'next', to: 'sw' },
        { id: 'e2', from: 'sw', fromPort: 'case:a', to: 'ok' },
        { id: 'e3', from: 'sw', fromPort: 'case:a', to: 'ok2' },
      ],
    };
    const result = validateWorkflowGraph(graph);
    expect(result.valid).toBe(false);
    expect(hasError(result, 'edges on port')).toBe(true);
  });
});
