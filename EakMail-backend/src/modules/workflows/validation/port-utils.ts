/**
 * Helpers for reasoning about a node's valid output ports.
 * SWITCH is special: beyond its static ports it exposes one `case:<value>`
 * port per configured case (workflow.ts §SwitchConfig / NODE_OUTPUT_PORTS note).
 */
import {
  NODE_OUTPUT_PORTS,
  NodeType,
  type SwitchConfig,
  type WorkflowNode,
} from '@eakmail/shared-types';

/** Output port name for a SWITCH case value. */
export function switchCasePort(caseValue: string): string {
  return `case:${caseValue}`;
}

/**
 * All output ports a given node legitimately exposes, including the dynamic
 * `case:<value>` ports contributed by a SWITCH node's configured cases.
 */
export function validPortsFor(node: WorkflowNode): Set<string> {
  const ports = new Set<string>(NODE_OUTPUT_PORTS[node.type]);
  if (node.type === NodeType.SWITCH) {
    const config = node.config as SwitchConfig;
    for (const branch of config.cases ?? []) {
      ports.add(switchCasePort(branch.value));
    }
  }
  return ports;
}
