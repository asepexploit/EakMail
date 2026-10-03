import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StepStatus, WorkflowGraph } from '@eakmail/shared-types';
import { nodeTypes } from '../nodes/node-types.js';
import { toFlowEdges, toFlowNodes, type FlowNode } from '../graph-adapter.js';

export interface ReadOnlyCanvasProps {
  graph: WorkflowGraph;
  /** nodeId → live step status (from useExecutionStream). */
  nodeStatus: Record<string, StepStatus>;
  activeNodeId: string | null;
}

/**
 * Read-only graph that lights up per live event — shared by monitoring and the test
 * overlay (DESIGN_SYSTEM.md §8.4, §9.1). Editing is disabled; only status halos update.
 */
function ReadOnlyInner({ graph, nodeStatus, activeNodeId }: ReadOnlyCanvasProps) {
  const nodes = useMemo<FlowNode[]>(
    () =>
      toFlowNodes(graph).map((node) => ({
        ...node,
        draggable: false,
        selectable: false,
        connectable: false,
        data: {
          ...node.data,
          liveStatus: nodeStatus[node.id],
          isActive: node.id === activeNodeId,
        },
      })),
    [graph, nodeStatus, activeNodeId],
  );

  const edges = useMemo(
    () =>
      toFlowEdges(graph).map((edge) => ({
        ...edge,
        animated: edge.source === activeNodeId,
        style: { stroke: 'var(--brand-accent)' },
      })),
    [graph, activeNodeId],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} color="var(--border)" />
      <Controls showInteractive={false} className="!border-border !bg-surface" />
    </ReactFlow>
  );
}

export function ReadOnlyCanvas(props: ReadOnlyCanvasProps) {
  return (
    <ReactFlowProvider>
      <ReadOnlyInner {...props} />
    </ReactFlowProvider>
  );
}
