/**
 * Adapter between the frozen WorkflowGraph contract and React Flow's node/edge model.
 * The stored graph is the source of truth (@eakmail/shared-types); React Flow is only a
 * view of it. Node `data` carries the domain node so custom node components can render it.
 */
import type { Edge, Node } from '@xyflow/react';
import type {
  NodeType as NodeTypeValue,
  StepStatus,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from '@eakmail/shared-types';

/** Data attached to each React Flow node. */
export interface FlowNodeData extends Record<string, unknown> {
  node: WorkflowNode;
  /** Live per-node status when rendered in monitoring / test mode. */
  liveStatus?: StepStatus;
  /** Whether this node is the currently executing (pulsing) one. */
  isActive?: boolean;
  /** Worst validation severity for this node, from the validate endpoint (§8.4). */
  validation?: 'error' | 'warning';
}

export type FlowNode = Node<FlowNodeData>;
export type FlowEdge = Edge;

/** The React Flow node `type` — one custom renderer keyed by domain node type. */
export function flowNodeType(type: NodeTypeValue): string {
  return type;
}

export function toFlowNodes(graph: WorkflowGraph): FlowNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: flowNodeType(node.type),
    position: node.position,
    data: { node },
  }));
}

export function toFlowEdges(graph: WorkflowGraph): FlowEdge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    sourceHandle: edge.fromPort,
    target: edge.to,
    animated: false,
  }));
}

export function fromFlow(nodes: FlowNode[], edges: FlowEdge[], base: WorkflowGraph): WorkflowGraph {
  const domainNodes: WorkflowNode[] = nodes.map((flowNode) => ({
    ...flowNode.data.node,
    position: { x: flowNode.position.x, y: flowNode.position.y },
  }));

  const domainEdges: WorkflowEdge[] = edges.map((edge) => ({
    id: edge.id,
    from: edge.source,
    fromPort: edge.sourceHandle ?? 'next',
    to: edge.target,
  }));

  return {
    ...base,
    nodes: domainNodes,
    edges: domainEdges,
  };
}

/** An empty starter graph with a single START node. */
export function emptyGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: 'start',
        type: 'START',
        config: {},
        position: { x: 120, y: 120 },
      },
    ],
    edges: [],
    variables: {},
  };
}
