import { useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  type NodeType as NodeTypeValue,
  type WorkflowGraph,
  type WorkflowNode,
} from '@eakmail/shared-types';
import { MousePointer2 } from 'lucide-react';
import { featureStrings } from '@/features/shared/feature-strings';
import { nodeTypes } from '../nodes/node-types.js';
import { DEFAULT_NODE_CONFIG, nodeColorVar } from '../node-catalog.js';
import {
  fromFlow,
  toFlowEdges,
  toFlowNodes,
  type FlowEdge,
  type FlowNode,
} from '../graph-adapter.js';
import type { NodeSeverity } from '../validation-map.js';
import { NODE_DRAG_TYPE } from './NodePalette.js';

export interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  /** Per-node validation severity from the last validate run (inline node badges, §8.4). */
  nodeSeverity?: Record<string, NodeSeverity>;
}

let nodeIdCounter = 0;
function createNodeId(type: NodeTypeValue): string {
  nodeIdCounter += 1;
  return `${type.toLowerCase()}-${Date.now().toString(36)}-${nodeIdCounter}`;
}

/**
 * Structural signature of the domain graph: node id+position + edge id/endpoints. Changes when
 * nodes/edges are added, removed, moved, or the whole graph is replaced (load/rollback). Used
 * to decide when to reseed React Flow from the prop, and — matched against flowSignature — when
 * to propagate a user edit back out. Config-only edits are handled by the config panel directly.
 */
function graphSignature(graph: WorkflowGraph): string {
  const nodes = graph.nodes
    .map((n) => `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`)
    .sort();
  const edges = graph.edges.map((e) => `${e.id}:${e.from}.${e.fromPort}>${e.to}`).sort();
  return `${nodes.join('|')}#${edges.join('|')}`;
}

/** The same structural signature computed from React Flow's node/edge state (see graphSignature). */
function flowSignature(nodes: FlowNode[], edges: FlowEdge[]): string {
  const n = nodes
    .map((node) => `${node.id}@${Math.round(node.position.x)},${Math.round(node.position.y)}`)
    .sort();
  const e = edges
    .map((edge) => `${edge.id}:${edge.source}.${edge.sourceHandle ?? 'next'}>${edge.target}`)
    .sort();
  return `${n.join('|')}#${e.join('|')}`;
}

/** Interactive React Flow builder canvas (DESIGN_SYSTEM.md §8). */
function CanvasInner({
  graph,
  selectedNodeId,
  onSelectNode,
  onGraphChange,
  nodeSeverity,
}: WorkflowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(graph));
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(toFlowEdges(graph));

  // Keep the latest base graph (variables/settings) + callback without stale closures.
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const onGraphChangeRef = useRef(onGraphChange);
  onGraphChangeRef.current = onGraphChange;

  // Reseed React Flow when the incoming graph is a structurally different set of nodes/edges
  // (workflow loaded, rolled back, node added/deleted from the page). Compares structural ids,
  // so ordinary drag/config edits — which flow OUT below — don't loop back in. This is
  // idempotent, so React StrictMode's double-invoke is harmless.
  const lastGraphSig = useRef(graphSignature(graph));
  useEffect(() => {
    const incoming = graphSignature(graph);
    if (incoming !== lastGraphSig.current) {
      lastGraphSig.current = incoming;
      setNodes(toFlowNodes(graph));
      setEdges(toFlowEdges(graph));
    }
  }, [graph, setNodes, setEdges]);

  // Write React Flow's state back to the domain graph — but ONLY when it structurally differs
  // from the graph we last seeded from. This makes the effect idempotent: re-running it with
  // the seeded state (first render, StrictMode replay, post-reseed) is a no-op, so a freshly
  // loaded graph is never overwritten by a stale seed. Only a genuine user edit (add/remove
  // node or edge, reconnect) changes the signature and propagates out.
  useEffect(() => {
    const currentSig = flowSignature(nodes, edges);
    if (currentSig === lastGraphSig.current) return;
    lastGraphSig.current = currentSig;
    onGraphChangeRef.current(fromFlow(nodes, edges, graphRef.current));
  }, [nodes, edges]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) =>
        addEdge(
          { ...connection, id: `edge-${Date.now().toString(36)}-${current.length}` },
          current,
        ),
      );
    },
    [setEdges],
  );

  // Remove a connection the admin double-clicks (deliberate enough to avoid accidents).
  // The write-back effect propagates the change to the domain graph.
  const onEdgeDoubleClick = useCallback(
    (_: unknown, edge: FlowEdge) => {
      setEdges((current) => current.filter((e) => e.id !== edge.id));
    },
    [setEdges],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(NODE_DRAG_TYPE) as NodeTypeValue;
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const domainNode: WorkflowNode = {
        id: createNodeId(type),
        type,
        config: structuredClone(DEFAULT_NODE_CONFIG[type]),
        position,
      };
      const flowNode: FlowNode = {
        id: domainNode.id,
        type,
        position,
        data: { node: domainNode },
      };
      setNodes((current) => [...current, flowNode]);
      onSelectNode(domainNode.id);
    },
    [screenToFlowPosition, setNodes, onSelectNode],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const minimapColor = useCallback((node: Node) => nodeColorVar(node.type as NodeTypeValue), []);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
        data: { ...node.data, validation: nodeSeverity?.[node.id] },
      })),
    [nodes, selectedNodeId, nodeSeverity],
  );

  // Empty when only the seeded START node remains — nudge the admin to drag nodes in.
  const isEmpty = nodes.length <= 1;

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        onEdgeDoubleClick={onEdgeDoubleClick}
        // Let the admin remove a selected edge/node with Delete or Backspace.
        deleteKeyCode={['Delete', 'Backspace']}
        edgesFocusable
        elementsSelectable
        defaultEdgeOptions={{ style: { stroke: 'var(--brand-accent)' } }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} color="var(--border)" />
        <Controls className="!border-border !bg-surface" />
        <MiniMap
          pannable
          zoomable
          nodeColor={minimapColor}
          maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
          className="!border-border !bg-surface-2"
        />
      </ReactFlow>
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <MousePointer2 className="h-8 w-8 text-text-muted" aria-hidden />
          <p className="text-sm font-medium text-text">
            {featureStrings.workflows.builder.emptyCanvas}
          </p>
          <p className="max-w-xs text-xs text-text-muted">
            {featureStrings.workflows.builder.emptyCanvasHint}
          </p>
        </div>
      )}
      {/* Persistent hint so the admin knows how to remove a wrong connection. */}
      {!isEmpty && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm border border-border bg-surface/90 px-3 py-1 text-[11px] text-text-muted">
          {featureStrings.workflows.builder.edgeDeleteHint}
        </div>
      )}
    </div>
  );
}

/** Public builder canvas wrapped in its own React Flow provider. */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
