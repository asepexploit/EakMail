import { describe, expect, it } from 'vitest';
import type { WorkflowGraph } from '@eakmail/shared-types';
import {
  emptyGraph,
  flowNodeType,
  fromFlow,
  toFlowEdges,
  toFlowNodes,
  type FlowEdge,
  type FlowNode,
} from './graph-adapter.js';

function sampleGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 'start', type: 'START', config: {}, position: { x: 0, y: 0 } },
      {
        id: 'msg',
        type: 'SEND_MESSAGE',
        config: { text: 'hi', parseMode: 'none' },
        position: { x: 200, y: 40 },
      },
    ],
    edges: [{ id: 'e1', from: 'start', fromPort: 'next', to: 'msg' }],
    variables: { foo: 'bar' },
  };
}

describe('emptyGraph', () => {
  it('starts with a single START node and no edges', () => {
    const graph = emptyGraph();
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe('START');
    expect(graph.edges).toEqual([]);
    expect(graph.variables).toEqual({});
  });
});

describe('flowNodeType', () => {
  it('maps a domain node type to a React Flow renderer key (identity)', () => {
    expect(flowNodeType('SWITCH')).toBe('SWITCH');
    expect(flowNodeType('START')).toBe('START');
  });
});

describe('toFlowNodes', () => {
  it('projects domain nodes to React Flow nodes carrying the domain node in data', () => {
    const flowNodes = toFlowNodes(sampleGraph());
    expect(flowNodes).toHaveLength(2);
    const [start, msg] = flowNodes;
    expect(start.id).toBe('start');
    expect(start.type).toBe('START');
    expect(start.position).toEqual({ x: 0, y: 0 });
    expect(start.data.node.id).toBe('start');
    expect(msg.data.node.config).toMatchObject({ text: 'hi' });
  });
});

describe('toFlowEdges', () => {
  it('maps from/to and the source port to sourceHandle', () => {
    const [edge] = toFlowEdges(sampleGraph());
    expect(edge.id).toBe('e1');
    expect(edge.source).toBe('start');
    expect(edge.target).toBe('msg');
    expect(edge.sourceHandle).toBe('next');
  });
});

describe('fromFlow (round trip)', () => {
  it('rebuilds a domain graph from React Flow nodes/edges preserving positions and ports', () => {
    const base = sampleGraph();
    const flowNodes = toFlowNodes(base);
    const flowEdges = toFlowEdges(base);

    // Simulate the user dragging the message node.
    const moved: FlowNode[] = flowNodes.map((n) =>
      n.id === 'msg' ? { ...n, position: { x: 320, y: 90 } } : n,
    );

    const rebuilt = fromFlow(moved, flowEdges, base);

    expect(rebuilt.variables).toEqual(base.variables); // base fields preserved
    expect(rebuilt.nodes).toHaveLength(2);
    const msg = rebuilt.nodes.find((n) => n.id === 'msg');
    expect(msg?.position).toEqual({ x: 320, y: 90 });
    expect(rebuilt.edges[0]).toEqual({ id: 'e1', from: 'start', fromPort: 'next', to: 'msg' });
  });

  it('defaults a missing sourceHandle back to the "next" port', () => {
    const base = emptyGraph();
    const flowNodes = toFlowNodes(base);
    const edges: FlowEdge[] = [{ id: 'e', source: 'start', target: 'start' }];
    const rebuilt = fromFlow(flowNodes, edges, base);
    expect(rebuilt.edges[0].fromPort).toBe('next');
  });
});
