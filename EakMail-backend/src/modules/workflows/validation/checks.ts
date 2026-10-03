/**
 * Individual, independent validation checks over a WorkflowGraph. Each check is a
 * pure function that appends WorkflowValidationIssue[] for its concern only.
 * The orchestrator (../workflow-validator.ts) runs them and aggregates results.
 */
import {
  NodeType,
  type WorkflowGraph,
  type WorkflowValidationIssue,
} from '@eakmail/shared-types';
import type { GraphIndex } from './graph-index.js';
import { checkRequiredConfig } from './node-config-rules.js';
import { reachableFrom } from './reachability.js';
import { validPortsFor } from './port-utils.js';

const TERMINAL_TYPES: ReadonlySet<NodeType> = new Set([
  NodeType.SUCCESS,
  NodeType.FAIL,
  NodeType.DELIVER_TO_CUSTOMER,
]);

const error = (message: string, nodeId?: string): WorkflowValidationIssue => ({
  severity: 'error',
  message,
  ...(nodeId ? { nodeId } : {}),
});

const warning = (message: string, nodeId?: string): WorkflowValidationIssue => ({
  severity: 'warning',
  message,
  ...(nodeId ? { nodeId } : {}),
});

/** Every referenced node id exists; no duplicate node ids. */
export function checkNodeIntegrity(graph: WorkflowGraph, index: GraphIndex): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (seen.has(node.id)) {
      issues.push(error(`Duplicate node id "${node.id}".`, node.id));
    }
    seen.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!index.nodesById.has(edge.from)) {
      issues.push(error(`Edge "${edge.id}" starts from unknown node "${edge.from}".`));
    }
    if (!index.nodesById.has(edge.to)) {
      issues.push(error(`Edge "${edge.id}" points to unknown node "${edge.to}".`));
    }
  }
  return issues;
}

/** Exactly one START node. */
export function checkSingleStart(graph: WorkflowGraph): WorkflowValidationIssue[] {
  const starts = graph.nodes.filter((node) => node.type === NodeType.START);
  if (starts.length === 0) {
    return [error('Workflow must have exactly one START node; found none.')];
  }
  if (starts.length > 1) {
    return starts.map((node) =>
      error(`Workflow must have exactly one START node; found ${starts.length}.`, node.id),
    );
  }
  return [];
}

/** At least one terminal node (SUCCESS / FAIL / DELIVER_TO_CUSTOMER). */
export function checkHasTerminal(graph: WorkflowGraph): WorkflowValidationIssue[] {
  const hasTerminal = graph.nodes.some((node) => TERMINAL_TYPES.has(node.type));
  return hasTerminal
    ? []
    : [error('Workflow must have at least one terminal node (SUCCESS, FAIL, or DELIVER_TO_CUSTOMER).')];
}

/** Every edge's fromPort is a valid output port for its source node's type. */
export function checkEdgePorts(graph: WorkflowGraph, index: GraphIndex): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  for (const edge of graph.edges) {
    const source = index.nodesById.get(edge.from);
    if (!source) continue; // already reported by checkNodeIntegrity
    const validPorts = validPortsFor(source);
    if (!validPorts.has(edge.fromPort)) {
      issues.push(
        error(
          `Edge "${edge.id}" uses invalid output port "${edge.fromPort}" for a ${source.type} node.`,
          source.id,
        ),
      );
    }
  }
  return issues;
}

/** No dangling nodes: every node is reachable from START. */
export function checkReachability(graph: WorkflowGraph, index: GraphIndex): WorkflowValidationIssue[] {
  const start = graph.nodes.find((node) => node.type === NodeType.START);
  if (!start) return []; // START error already reported by checkSingleStart
  const reachable = reachableFrom(start.id, index);
  return graph.nodes
    .filter((node) => !reachable.has(node.id))
    .map((node) => error(`Node "${node.id}" (${node.type}) is unreachable from START.`, node.id));
}

/** Required config present per node type. */
export function checkNodeConfigs(graph: WorkflowGraph): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  for (const node of graph.nodes) {
    for (const message of checkRequiredConfig(node.type, node.config)) {
      issues.push(error(message, node.id));
    }
  }
  return issues;
}

/**
 * SWITCH sanity: each configured case should have exactly one outgoing edge, and
 * no two edges target the same case port. Missing wiring is a warning (the graph
 * still runs, falling through to `default`), duplicates are errors.
 */
export function checkSwitchWiring(graph: WorkflowGraph, index: GraphIndex): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  for (const node of graph.nodes) {
    if (node.type !== NodeType.SWITCH) continue;
    const edges = index.outgoing.get(node.id) ?? [];
    const portCounts = new Map<string, number>();
    for (const edge of edges) {
      portCounts.set(edge.fromPort, (portCounts.get(edge.fromPort) ?? 0) + 1);
    }
    for (const [port, count] of portCounts) {
      if (count > 1) {
        issues.push(error(`SWITCH node "${node.id}" has ${count} edges on port "${port}".`, node.id));
      }
    }
    for (const port of validPortsFor(node)) {
      if (port !== 'default' && !portCounts.has(port)) {
        issues.push(warning(`SWITCH node "${node.id}" case port "${port}" is not connected.`, node.id));
      }
    }
  }
  return issues;
}
