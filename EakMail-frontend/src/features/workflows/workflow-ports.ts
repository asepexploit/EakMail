/**
 * Pure output-port resolution for workflow nodes. Extracted so it can be unit-tested
 * and reused without a React renderer. Most nodes use the static NODE_OUTPUT_PORTS
 * contract; SWITCH additionally exposes one dynamic `case:<value>` port per configured
 * case, before its static `default` port (see @eakmail/shared-types workflow.ts).
 */
import {
  NODE_OUTPUT_PORTS,
  NodeType,
  type NodeType as NodeTypeValue,
  type SwitchConfig,
} from '@eakmail/shared-types';

/**
 * Output port names to render/route for a node.
 * SWITCH → [`case:<value>`..., 'default']; everything else → its static ports.
 */
export function outputPortsFor(type: NodeTypeValue, config: unknown): string[] {
  const base = NODE_OUTPUT_PORTS[type] ?? [];
  if (type !== NodeType.SWITCH) return base;
  const cases = (config as SwitchConfig | undefined)?.cases ?? [];
  const casePorts = cases.map((c) => `case:${c.value}`);
  return [...casePorts, ...base];
}
