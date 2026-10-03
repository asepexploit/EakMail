/** Renders one documentation block (paragraph, code, note, steps, table). */
import { Info } from 'lucide-react';
import type { DocBlock } from './docs-content';

export function DocBlockView({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case 'p':
      return <p className="text-sm leading-relaxed text-text-muted">{block.text}</p>;

    case 'code':
      return (
        <div className="overflow-hidden rounded-sm border border-border bg-surface-2">
          {block.caption && (
            <div className="border-b border-border px-3 py-1.5 text-xs text-text-muted">
              {block.caption}
            </div>
          )}
          <pre className="scroll-thin overflow-x-auto p-3 font-mono text-xs text-text">
            {block.text}
          </pre>
        </div>
      );

    case 'note':
      return (
        <div className="tone-info flex gap-2 rounded-sm border tone-border tone-bg px-3 py-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 tone-fg" aria-hidden />
          <p className="text-sm leading-relaxed text-text">{block.text}</p>
        </div>
      );

    case 'steps':
      return (
        <ol className="flex flex-col gap-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-text-muted">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] text-brand-accent">
                {i + 1}
              </span>
              <span className="pt-0.5 font-mono text-xs leading-relaxed text-text">{item}</span>
            </li>
          ))}
        </ol>
      );

    case 'table':
      return (
        <div className="overflow-x-auto rounded-sm border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-text-muted">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top text-text-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
}
