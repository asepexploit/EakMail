/**
 * Reduces a WorkflowValidationResult to a per-node worst-severity map so the canvas
 * can render inline error/warning badges on each affected node (DESIGN_SYSTEM.md §8.4).
 * Errors outrank warnings; issues without a nodeId are graph-level and skipped here.
 */
import type { WorkflowValidationResult } from '@eakmail/shared-types';

export type NodeSeverity = 'error' | 'warning';

export function nodeSeverityMap(
  result: WorkflowValidationResult | null,
): Record<string, NodeSeverity> {
  const map: Record<string, NodeSeverity> = {};
  if (!result) return map;
  for (const issue of result.issues) {
    if (!issue.nodeId) continue;
    if (issue.severity === 'error' || map[issue.nodeId] !== 'error') {
      map[issue.nodeId] = issue.severity;
    }
  }
  return map;
}
