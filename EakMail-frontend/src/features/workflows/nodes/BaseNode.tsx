import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { StepStatus, type NodeType as NodeTypeValue } from '@eakmail/shared-types';
import { cn } from '@/lib/cn';
import { featureStrings } from '@/features/shared/feature-strings';
import {
  DEFAULT_NODE_ICON,
  NODE_ICON,
  nodeColorVar,
  nodeSummary,
  nodeTitle,
} from '../node-catalog.js';
import type { FlowNodeData } from '../graph-adapter.js';
import { outputPortsFor } from '../workflow-ports.js';

/** Maps a live step status to a status-halo color (DESIGN_SYSTEM.md §8.2). */
function haloColor(status: StepStatus | undefined): string | undefined {
  switch (status) {
    case StepStatus.RUNNING:
      return 'var(--running)';
    case StepStatus.SUCCEEDED:
      return 'var(--success)';
    case StepStatus.FAILED:
    case StepStatus.TIMED_OUT:
      return 'var(--danger)';
    default:
      return undefined;
  }
}

/**
 * Shared node visual (DESIGN_SYSTEM.md §8.2): category color stripe, icon + title,
 * config summary, one input port and one output port per declared branch. Live status
 * lights up the border in monitoring / test mode. Per-node files wrap this with their type.
 */
export function BaseNode({ data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const domain = nodeData.node;
  const type = domain.type as NodeTypeValue;
  const Icon = NODE_ICON[type] ?? DEFAULT_NODE_ICON;
  const color = nodeColorVar(type);
  const ports = outputPortsFor(type, domain.config);
  const liveHalo = nodeData.isActive ? 'var(--running)' : haloColor(nodeData.liveStatus);
  // Validation ring only when there is no live-status halo competing for the border.
  const validationHalo =
    !liveHalo && nodeData.validation
      ? nodeData.validation === 'error'
        ? 'var(--danger)'
        : 'var(--warning)'
      : undefined;
  const halo = liveHalo ?? validationHalo;
  const summary = nodeSummary(type, domain.config);
  const hasInput = type !== 'START';

  return (
    <div
      className={cn(
        'relative min-w-[190px] rounded-md border bg-surface text-left transition-[box-shadow,border-color] duration-300',
        selected ? 'border-brand-accent' : 'border-border',
      )}
      style={{ boxShadow: halo ? `0 0 0 2px ${halo}` : 'var(--shadow-1)' }}
    >
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-md"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-border !bg-surface"
        />
      )}
      <div className="flex items-center gap-2 px-3 py-2 pl-4">
        <span style={{ color }}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-medium text-text">
          {domain.config.label || nodeTitle(type)}
        </span>
        {nodeData.validation === 'error' && (
          <XCircle
            className="ml-auto h-4 w-4 shrink-0 text-danger"
            role="img"
            aria-label={featureStrings.workflows.builder.nodeHasErrors}
          />
        )}
        {nodeData.validation === 'warning' && (
          <AlertTriangle
            className="ml-auto h-4 w-4 shrink-0 text-warning"
            role="img"
            aria-label={featureStrings.workflows.builder.nodeHasWarnings}
          />
        )}
        {nodeData.isActive && (
          <span
            className={cn('h-2 w-2 animate-pulse rounded-full bg-running', !nodeData.validation && 'ml-auto')}
            aria-hidden
          />
        )}
      </div>
      {summary && (
        <div className="border-t border-border px-3 py-1.5 pl-4 font-mono text-[11px] text-text-muted">
          {summary}
        </div>
      )}

      {ports.map((port, index) => {
        const tone = portTone(port);
        return (
          <Handle
            key={port}
            id={port}
            type="source"
            position={Position.Right}
            style={{ top: portOffset(ports.length, index), background: tone, borderColor: tone }}
            className="!h-3 !w-3 !border-2 transition-transform hover:!scale-125"
          >
            {ports.length > 1 && (
              <span
                className="pointer-events-none absolute -translate-y-1/2 whitespace-nowrap rounded-sm bg-surface/90 px-1 text-[10px] font-semibold"
                style={{ top: 0, left: 12, color: tone }}
              >
                {port}
              </span>
            )}
          </Handle>
        );
      })}
    </div>
  );
}

/** Maps a port label to a CSS color for its handle (true/false, match/no-match etc.). */
function portTone(port: string): string {
  const label = port.toLowerCase();
  if (label === 'true' || label === 'match' || label === 'yes') return 'var(--success)';
  if (label === 'false' || label === 'no-match' || label === 'no') return 'var(--danger)';
  return 'var(--primary)';
}

/** Distributes multiple output handles vertically along the node's right edge. */
function portOffset(count: number, index: number): string {
  if (count <= 1) return '50%';
  const step = 100 / (count + 1);
  return `${step * (index + 1)}%`;
}
