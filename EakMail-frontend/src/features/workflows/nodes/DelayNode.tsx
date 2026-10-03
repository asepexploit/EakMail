import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.js';

/** DELAY node visual (DESIGN_SYSTEM.md §8.2). Rendering is shared via BaseNode,
 *  which derives the category color, icon, and config summary from the node type. */
export function DelayNode(props: NodeProps) {
  return <BaseNode {...props} />;
}
