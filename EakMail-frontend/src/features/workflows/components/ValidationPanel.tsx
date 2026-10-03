import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { WorkflowValidationResult } from '@eakmail/shared-types';
import { featureStrings } from '@/features/shared/feature-strings';

export interface ValidationPanelProps {
  result: WorkflowValidationResult;
  onSelectNode?: (nodeId: string) => void;
}

/** Inline validation summary for the builder (DESIGN_SYSTEM.md §8.4). */
export function ValidationPanel({ result, onSelectNode }: ValidationPanelProps) {
  if (result.valid && result.issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-sm tone-success tone-bg tone-fg px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {featureStrings.workflows.builder.validationOk}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-text">
        {featureStrings.workflows.builder.validationErrors}
      </p>
      <ul className="space-y-1">
        {result.issues.map((issue, index) => (
          <li key={index}>
            <button
              type="button"
              onClick={() => issue.nodeId && onSelectNode?.(issue.nodeId)}
              className="focus-ring flex w-full items-start gap-2 rounded-sm px-2 py-1 text-left text-xs transition hover:bg-surface-2 active:scale-[0.98]"
            >
              {issue.severity === 'error' ? (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
              )}
              <span className="text-text">{issue.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
