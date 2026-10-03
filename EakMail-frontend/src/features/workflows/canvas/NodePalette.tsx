import type { DragEvent, KeyboardEvent } from 'react';
import type { NodeType as NodeTypeValue } from '@eakmail/shared-types';
import { featureStrings } from '@/features/shared/feature-strings';
import {
  DEFAULT_NODE_ICON,
  NODE_ICON,
  PALETTE_GROUPS,
  nodeColorVar,
  nodeDescription,
  nodeTitle,
} from '../node-catalog.js';

/** Data-transfer key for a palette drag. */
export const NODE_DRAG_TYPE = 'application/eakmail-node';

export interface NodePaletteProps {
  /** Keyboard/click alternative to drag-and-drop: append a node of this type. */
  onAddNode?: (type: NodeTypeValue) => void;
}

const categoryLabel: Record<string, string> = {
  trigger: featureStrings.workflows.categories.trigger,
  action: featureStrings.workflows.categories.action,
  wait: featureStrings.workflows.categories.wait,
  logic: featureStrings.workflows.categories.logic,
  data: featureStrings.workflows.categories.data,
  control: featureStrings.workflows.categories.control,
  terminal: featureStrings.workflows.categories.terminal,
};

/** Left palette: node types grouped by category, draggable onto the canvas (§8.1). */
export function NodePalette({ onAddNode }: NodePaletteProps) {
  function onDragStart(event: DragEvent<HTMLButtonElement>, type: NodeTypeValue) {
    event.dataTransfer.setData(NODE_DRAG_TYPE, type);
    event.dataTransfer.effectAllowed = 'move';
  }

  // Keyboard alternative to drag-and-drop for accessibility (Enter/Space adds the node).
  function onKeyAdd(event: KeyboardEvent<HTMLButtonElement>, type: NodeTypeValue) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAddNode?.(type);
    }
  }

  return (
    <aside className="scroll-thin h-full w-56 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {featureStrings.workflows.builder.palette}
      </p>
      <div className="space-y-4">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.category}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {categoryLabel[group.category]}
            </p>
            <div className="space-y-1">
              {group.types.map((type) => {
                const Icon = NODE_ICON[type] ?? DEFAULT_NODE_ICON;
                const title = nodeTitle(type);
                const description = nodeDescription(type);
                return (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={(event) => onDragStart(event, type)}
                    onClick={() => onAddNode?.(type)}
                    onKeyDown={(event) => onKeyAdd(event, type)}
                    title={description || title}
                    aria-label={description ? `${title} — ${description}` : title}
                    className="focus-ring flex w-full cursor-grab items-center gap-2 rounded-sm border border-border bg-surface-2 px-2 py-1.5 text-left text-xs text-text transition hover:border-brand-accent hover:bg-surface active:scale-[0.98] active:cursor-grabbing"
                  >
                    <span
                      className="h-4 w-1 rounded-full"
                      style={{ backgroundColor: nodeColorVar(type) }}
                      aria-hidden
                    />
                    <Icon className="h-3.5 w-3.5" style={{ color: nodeColorVar(type) }} aria-hidden />
                    {title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
