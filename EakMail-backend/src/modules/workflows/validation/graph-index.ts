/**
 * Lightweight lookup structures built once from a WorkflowGraph, so the
 * individual validation checks stay O(1) per lookup instead of re-scanning.
 */
import type { WorkflowGraph, WorkflowNode } from '@eakmail/shared-types';

export interface GraphIndex {
  /** Node id → node. */
  nodesById: Map<string, WorkflowNode>;
  /** Source node id → its outgoing edges. */
  outgoing: Map<string, WorkflowGraph['edges']>;
  /** Set of node ids that are the target of at least one edge. */
  hasIncoming: Set<string>;
}

export function buildGraphIndex(graph: WorkflowGraph): GraphIndex {
  const nodesById = new Map<string, WorkflowNode>();
  for (const node of graph.nodes) {
    nodesById.set(node.id, node);
  }

  const outgoing = new Map<string, WorkflowGraph['edges']>();
  const hasIncoming = new Set<string>();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
    hasIncoming.add(edge.to);
  }

  return { nodesById, outgoing, hasIncoming };
}
