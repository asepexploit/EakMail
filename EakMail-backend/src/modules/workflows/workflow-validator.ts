/**
 * Workflow graph validator — a pure function over the shared WorkflowGraph
 * contract, producing a WorkflowValidationResult. Used by the API validate
 * endpoint and before activating a workflow.
 *
 * Checks (see task spec / BLUEPRINT.md §8):
 *  - exactly one START node
 *  - every edge fromPort is valid per NODE_OUTPUT_PORTS (+ SWITCH case ports)
 *  - no dangling nodes (all reachable from START)
 *  - at least one terminal node (SUCCESS / FAIL / DELIVER_TO_CUSTOMER)
 *  - required config present per node type
 *  - SWITCH ports match its configured cases
 *
 * Each concern is a small, independent check in ./validation/checks.ts; this file
 * only orchestrates and aggregates. Pure: no I/O, deterministic output.
 */
import type { WorkflowGraph, WorkflowValidationResult } from '@eakmail/shared-types';
import { buildGraphIndex } from './validation/graph-index.js';
import {
  checkEdgePorts,
  checkHasTerminal,
  checkNodeConfigs,
  checkNodeIntegrity,
  checkReachability,
  checkSingleStart,
  checkSwitchWiring,
} from './validation/checks.js';

export function validateWorkflowGraph(graph: WorkflowGraph): WorkflowValidationResult {
  const index = buildGraphIndex(graph);

  const issues = [
    ...checkNodeIntegrity(graph, index),
    ...checkSingleStart(graph),
    ...checkHasTerminal(graph),
    ...checkEdgePorts(graph, index),
    ...checkReachability(graph, index),
    ...checkNodeConfigs(graph),
    ...checkSwitchWiring(graph, index),
  ];

  const valid = !issues.some((issue) => issue.severity === 'error');
  return { valid, issues };
}
