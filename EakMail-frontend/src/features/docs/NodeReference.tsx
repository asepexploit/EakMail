/**
 * Node catalog reference: every node type grouped by category, with its color stripe, icon,
 * Indonesian title/description (reused from the builder), when to use it, config, and ports.
 * Facts come from docs-content.NODE_DOCS (mirrors the frozen contract).
 */
import type { NodeType } from '@eakmail/shared-types';
import { NODE_ICON, nodeColorVar } from '@/features/workflows/node-catalog';
import { featureStrings } from '@/features/shared/feature-strings';
import { NODE_DOCS, type NodeDoc } from './docs-content';

function NodeCard({ node }: { node: NodeDoc }) {
  const Icon = NODE_ICON[node.type];
  const display = featureStrings.workflows.nodeDisplay[node.type as NodeType];
  return (
    <div
      className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-3"
      style={{ borderLeft: `3px solid ${nodeColorVar(node.type)}` }}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" style={{ color: nodeColorVar(node.type) }} aria-hidden />}
        <span className="text-sm font-semibold text-text">{display?.title ?? node.type}</span>
        <code className="ml-auto font-mono text-[10px] text-text-muted">{node.type}</code>
      </div>
      <p className="text-xs leading-relaxed text-text-muted">{node.when}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-text-muted">Konfigurasi</dt>
        <dd className="font-mono text-text">{node.config}</dd>
        <dt className="text-text-muted">Port keluar</dt>
        <dd className="font-mono text-brand-accent">{node.ports}</dd>
      </dl>
    </div>
  );
}

export function NodeReference() {
  return (
    <div className="flex flex-col gap-6">
      {NODE_DOCS.map((group) => (
        <div key={group.category} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text">{group.category}</h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {group.nodes.map((node) => (
              <NodeCard key={node.type} node={node} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
