import { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  NodeType,
  type NodeConfigMap,
  type NodeType as NodeTypeValue,
  type WorkflowNode,
} from '@eakmail/shared-types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { nodeTitle } from '../node-catalog.js';
import { featureStrings } from '@/features/shared/feature-strings';

const fields = featureStrings.workflows.fields;

export interface NodeConfigPanelProps {
  node: WorkflowNode | null;
  onChange: (node: WorkflowNode) => void;
  onDelete: (nodeId: string) => void;
}

/** Right config panel: local draft state, applied to the node on "Simpan". */
export function NodeConfigPanel({ node, onChange, onDelete }: NodeConfigPanelProps) {
  const [draft, setDraft] = useState<WorkflowNode | null>(node);

  // Reset draft when selected node changes.
  useEffect(() => {
    setDraft(node);
  }, [node?.id]);

  if (!node || !draft) {
    return (
      <aside className="w-72 shrink-0 border-l border-border bg-surface p-4">
        <p className="text-sm text-text-muted">{featureStrings.workflows.builder.noSelection}</p>
      </aside>
    );
  }

  function patchConfig<T extends NodeTypeValue>(patch: Partial<NodeConfigMap[T]>) {
    if (!draft) return;
    setDraft({ ...draft, config: { ...draft.config, ...patch } } as WorkflowNode);
  }

  function handleSave() {
    if (draft) onChange(draft);
  }

  const type = node.type as NodeTypeValue;

  return (
    <aside className="scroll-thin flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text">{nodeTitle(type)}</h3>
        {type !== NodeType.START && (
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            aria-label={featureStrings.workflows.builder.deleteNode}
            className="focus-ring rounded-sm p-1 text-text-muted hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 p-4">
        <Input
          label={fields.label}
          value={draft.config.label ?? ''}
          onChange={(e) => patchConfig({ label: e.target.value })}
        />
        <NodeFields type={type} config={draft.config} patch={patchConfig} />
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full" onClick={handleSave}>
          Simpan Node
        </Button>
      </div>
    </aside>
  );
}

interface FieldsProps {
  type: NodeTypeValue;
  config: WorkflowNode['config'];
  patch: (patch: Record<string, unknown>) => void;
}

/** Renders the type-specific fields. Uses the frozen config shapes from shared-types. */
function NodeFields({ type, config, patch }: FieldsProps) {
  const c = config as Record<string, unknown>;
  const str = (key: string) => (c[key] as string | undefined) ?? '';
  const num = (key: string) => (c[key] as number | undefined) ?? 0;

  switch (type) {
    case NodeType.SEND_MESSAGE:
      return (
        <>
          <Textarea label={fields.text} mono value={str('text')} onChange={(e) => patch({ text: e.target.value })} />
          <Select
            label={fields.parseMode}
            options={[
              { value: 'none', label: 'none' },
              { value: 'markdown', label: 'markdown' },
              { value: 'html', label: 'html' },
            ]}
            value={str('parseMode') || 'none'}
            onChange={(e) => patch({ parseMode: e.target.value })}
          />
        </>
      );
    case NodeType.SEND_COMMAND:
      return (
        <>
          <Input label={fields.command} mono value={str('command')} onChange={(e) => patch({ command: e.target.value })} />
          <Input label={fields.args} mono value={str('args')} onChange={(e) => patch({ args: e.target.value })} />
        </>
      );
    case NodeType.CLICK_BUTTON:
      return (
        <>
          <Select
            label={fields.strategy}
            options={['label', 'regex', 'index', 'position'].map((v) => ({ value: v, label: v }))}
            value={str('strategy') || 'label'}
            onChange={(e) => patch({ strategy: e.target.value })}
          />
          <Input label={fields.value} mono value={str('value')} onChange={(e) => patch({ value: e.target.value })} />
        </>
      );
    case NodeType.WAIT_MESSAGE:
      return (
        <Input label={fields.fromPeer} value={str('fromPeer')} onChange={(e) => patch({ fromPeer: e.target.value })} />
      );
    case NodeType.WAIT_RESPONSE:
    case NodeType.MATCH_TEXT:
      return (
        <>
          <Select
            label={fields.mode}
            options={['contains', 'regex', 'equals'].map((v) => ({ value: v, label: v }))}
            value={str('mode') || 'contains'}
            onChange={(e) => patch({ mode: e.target.value })}
          />
          <Input label={fields.pattern} mono value={str('pattern')} onChange={(e) => patch({ pattern: e.target.value })} />
          <Checkbox
            label={fields.caseSensitive}
            checked={Boolean(c.caseSensitive)}
            onChange={(v) => patch({ caseSensitive: v })}
          />
        </>
      );
    case NodeType.DELAY:
      return (
        <>
          <Input label={fields.delayMs} type="number" value={num('ms')} onChange={(e) => patch({ ms: Number(e.target.value) })} />
          <Input label={fields.jitterMs} type="number" value={num('jitterMs')} onChange={(e) => patch({ jitterMs: Number(e.target.value) })} />
        </>
      );
    case NodeType.CONDITION:
      return (
        <Textarea label={fields.expression} mono value={str('expression')} onChange={(e) => patch({ expression: e.target.value })} />
      );
    case NodeType.SWITCH:
      return (
        <>
          <Input label={fields.on} mono value={str('on')} onChange={(e) => patch({ on: e.target.value })} />
          <SwitchCasesEditor
            cases={(c.cases as Array<{ value: string }> | undefined) ?? []}
            onChange={(cases) => patch({ cases })}
          />
        </>
      );
    case NodeType.EXTRACT_DATA:
      return (
        <>
          <Input label={fields.regex} mono value={str('regex')} onChange={(e) => patch({ regex: e.target.value })} />
          <Input label={fields.assignTo} mono value={str('assignTo')} onChange={(e) => patch({ assignTo: e.target.value })} />
          <Select
            label={fields.extractMode}
            value={str('mode') || 'first'}
            onChange={(e) => patch({ mode: e.target.value as 'first' | 'all' })}
            options={[
              { value: 'first', label: fields.extractModeFirst },
              { value: 'all', label: fields.extractModeAll },
            ]}
          />
          {str('mode') === 'all' && (
            <Input
              label={fields.joinWith}
              mono
              value={str('joinWith')}
              placeholder="\n"
              onChange={(e) => patch({ joinWith: e.target.value })}
            />
          )}
        </>
      );
    case NodeType.SET_VARIABLE:
      return (
        <>
          <Input label={fields.name} mono value={str('name')} onChange={(e) => patch({ name: e.target.value })} />
          <Input label={fields.value} mono value={str('value')} onChange={(e) => patch({ value: e.target.value })} />
        </>
      );
    case NodeType.TRANSFORM:
      return (
        <>
          <Input label={fields.input} mono value={str('input')} onChange={(e) => patch({ input: e.target.value })} />
          <Input label={fields.output} mono value={str('output')} onChange={(e) => patch({ output: e.target.value })} />
        </>
      );
    case NodeType.RETRY:
      return (
        <>
          <Input label={fields.maxAttempts} type="number" value={num('maxAttempts')} onChange={(e) => patch({ maxAttempts: Number(e.target.value) })} />
          <Select
            label={fields.backoff}
            options={['fixed', 'exponential'].map((v) => ({ value: v, label: v }))}
            value={str('backoff') || 'exponential'}
            onChange={(e) => patch({ backoff: e.target.value })}
          />
          <Input label={fields.delayMs} type="number" value={num('delayMs')} onChange={(e) => patch({ delayMs: Number(e.target.value) })} />
        </>
      );
    case NodeType.TIMEOUT:
      return (
        <Input label={fields.timeoutMs} type="number" value={num('ms')} onChange={(e) => patch({ ms: Number(e.target.value) })} />
      );
    case NodeType.LOOP:
      return (
        <>
          <Select
            label={fields.mode}
            options={['while', 'count'].map((v) => ({ value: v, label: v }))}
            value={str('mode') || 'count'}
            onChange={(e) => patch({ mode: e.target.value })}
          />
          <Input label={fields.count} type="number" value={num('count')} onChange={(e) => patch({ count: Number(e.target.value) })} />
          <Input label={fields.whileExpression} mono value={str('whileExpression')} onChange={(e) => patch({ whileExpression: e.target.value })} />
          <Input label={fields.maxIterations} type="number" value={num('maxIterations')} onChange={(e) => patch({ maxIterations: Number(e.target.value) })} />
        </>
      );
    case NodeType.SUCCESS:
      return (
        <Textarea label={fields.payload} mono value={str('payload')} onChange={(e) => patch({ payload: e.target.value })} />
      );
    case NodeType.FAIL:
      return (
        <>
          <Input label={fields.reason} value={str('reason')} onChange={(e) => patch({ reason: e.target.value })} />
          <Checkbox label={fields.refund} checked={c.refund !== false} onChange={(v) => patch({ refund: v })} />
        </>
      );
    case NodeType.DELIVER_TO_CUSTOMER:
      return (
        <Textarea label={fields.template} mono value={str('template')} onChange={(e) => patch({ template: e.target.value })} />
      );
    default:
      return null;
  }
}

/**
 * Editor for a SWITCH node's `cases`. Each case adds a `case:<value>` output port
 * on the canvas (see workflow.ts SwitchConfig / NODE_OUTPUT_PORTS), so the admin
 * must be able to declare them here for the branch handles to appear.
 */
function SwitchCasesEditor({
  cases,
  onChange,
}: {
  cases: Array<{ value: string }>;
  onChange: (cases: Array<{ value: string }>) => void;
}) {
  const setValue = (index: number, value: string) => {
    onChange(cases.map((c, i) => (i === index ? { ...c, value } : c)));
  };
  const remove = (index: number) => onChange(cases.filter((_, i) => i !== index));
  const add = () => onChange([...cases, { value: '' }]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-muted">
        {featureStrings.workflows.builder.switchCases}
      </p>
      {cases.map((c, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            mono
            aria-label={featureStrings.workflows.builder.caseValue}
            placeholder={featureStrings.workflows.builder.caseValue}
            value={c.value}
            onChange={(e) => setValue(index, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={featureStrings.workflows.builder.removeCase}
            className="focus-ring rounded-sm p-1 text-text-muted hover:text-danger"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="focus-ring flex items-center gap-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-xs text-text hover:border-brand-accent"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {featureStrings.workflows.builder.addCase}
      </button>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brand" />
      {label}
    </label>
  );
}
