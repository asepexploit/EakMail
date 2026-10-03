import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { strings } from '@/lib/strings';

export interface InlinePriceEditProps {
  price: number;
  onSave: (price: number) => Promise<void> | void;
}

/**
 * Inline price editing (DESIGN_SYSTEM.md §7.4, F6 PRD §5.4). Price changes apply to
 * subsequent orders and are audit-logged by the backend; the UI only submits the value.
 */
export function InlinePriceEdit({ price, onSave }: InlinePriceEditProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(price);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <span className="tabular-nums text-text">{formatRupiah(price)}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setValue(price);
            setEditing(true);
          }}
          aria-label={strings.actions.edit}
          className="focus-ring rounded-sm p-1 text-text-muted hover:text-text"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        min={0}
        value={value}
        autoFocus
        disabled={saving}
        onChange={(e) => setValue(Number(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void save();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="focus-ring h-8 w-28 rounded-sm border border-border bg-surface px-2 text-right text-sm tabular-nums text-text"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        aria-label={strings.actions.save}
        className="focus-ring rounded-sm p-1 text-success transition hover:brightness-110 active:scale-95"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        aria-label={strings.actions.cancel}
        className="focus-ring rounded-sm p-1 text-text-muted transition hover:text-danger active:scale-95"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
