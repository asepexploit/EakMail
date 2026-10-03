import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { strings } from '@/lib/strings';

export interface JsonViewerProps {
  /** Any serializable value; strings are shown as-is if not valid JSON. */
  value: unknown;
  className?: string;
  /** Max height before the block scrolls. */
  maxHeight?: number;
}

function serialize(value: unknown): string {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Monospace JSON/payload viewer with a copy button (DESIGN_SYSTEM.md §5).
 * Presentational only — no fetching, no formatting business logic.
 */
export function JsonViewer({ value, className, maxHeight = 360 }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const text = serialize(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context) — fail quietly.
    }
  }

  return (
    <div className={cn('relative rounded-sm border border-border bg-surface-2', className)}>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? strings.actions.copied : strings.actions.copy}
        className="focus-ring absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-sm bg-surface text-text-muted hover:text-text"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre
        className="scroll-thin overflow-auto p-3 font-mono text-[13px] leading-relaxed text-text"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}
