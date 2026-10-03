/**
 * Read-only indexing over a WorkflowGraph: node lookup by id, START discovery, and
 * next-node resolution by (nodeId, outPort). Keeps traversal logic out of the interpreter.
 */
import type { WorkflowGraph, WorkflowNode } from '@eakmail/shared-types';
import { WorkflowError } from '../../lib/errors.js';

export class GraphIndex {
  private readonly nodesById = new Map<string, WorkflowNode>();
  /** key: `${fromNodeId}::${fromPort}` -> target node id (first edge wins). */
  private readonly edgeMap = new Map<string, string>();

  constructor(private readonly graph: WorkflowGraph) {
    for (const node of graph.nodes) {
      this.nodesById.set(node.id, node);
    }
    for (const edge of graph.edges) {
      const key = edgeKey(edge.from, edge.fromPort);
      if (!this.edgeMap.has(key)) this.edgeMap.set(key, edge.to);
    }
  }

  /** The START node; throws if the graph has none or more than one. */
  findStart(): WorkflowNode<'START'> {
    const starts = this.graph.nodes.filter((n) => n.type === 'START');
    if (starts.length === 0) throw new WorkflowError('Workflow graph has no START node');
    if (starts.length > 1) throw new WorkflowError('Workflow graph has multiple START nodes');
    return starts[0] as WorkflowNode<'START'>;
  }

  getNode(id: string): WorkflowNode {
    const node = this.nodesById.get(id);
    if (!node) throw new WorkflowError(`Node not found: ${id}`);
    return node;
  }

  hasNode(id: string): boolean {
    return this.nodesById.has(id);
  }

  /** Resolve the next node id following `outPort` from `nodeId`, or null if the edge is absent. */
  nextNodeId(nodeId: string, outPort: string): string | null {
    return this.edgeMap.get(edgeKey(nodeId, outPort)) ?? null;
  }
}

function edgeKey(from: string, port: string): string {
  return `${from}::${port}`;
}
