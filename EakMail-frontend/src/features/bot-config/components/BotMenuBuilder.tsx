import { ArrowDown, ArrowUp, Link, Plus, X } from 'lucide-react';
import type { BotMenuButton, ButtonStyle } from '@eakmail/shared-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { featureStrings } from '@/features/shared/feature-strings';

export interface BotMenuBuilderProps {
  menu: BotMenuButton[];
  onChange: (menu: BotMenuButton[]) => void;
}

const STYLE_OPTIONS: { value: ButtonStyle | ''; label: string; preview: string }[] = [
  { value: '',        label: 'Default (abu-abu)',  preview: 'bg-[#374151]' },
  { value: 'success', label: 'Hijau (success)',    preview: 'bg-green-600' },
  { value: 'primary', label: 'Biru (primary)',     preview: 'bg-blue-600' },
  { value: 'danger',  label: 'Merah (danger)',     preview: 'bg-red-600' },
];

const STYLE_CLASS: Record<string, string> = {
  success: 'bg-green-600',
  primary: 'bg-blue-600',
  danger:  'bg-red-600',
  '':      'bg-[#374151]',
};

/** Reorderable menu/button builder with Bot API 9.4 style support (DESIGN_SYSTEM.md §7.4b, F17). */
export function BotMenuBuilder({ menu, onChange }: BotMenuBuilderProps) {
  function update(index: number, patch: Partial<BotMenuButton>) {
    onChange(menu.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= menu.length) return;
    const next = [...menu];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">{featureStrings.botConfig.menuBuilder}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...menu, { label: '', action: '' }])}
        >
          <Plus className="h-3.5 w-3.5" />
          {featureStrings.botConfig.addButton}
        </Button>
      </div>

      {menu.length === 0 && (
        <p className="rounded-sm border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
          {featureStrings.botConfig.addButton}
        </p>
      )}

      {menu.map((item, index) => (
        <div key={index} className="rounded-sm border border-border p-3 space-y-2">
          {/* Row 1: label + action + reorder/delete controls */}
          <div className="flex items-end gap-2">
            <Input
              label={index === 0 ? featureStrings.botConfig.menuLabel : undefined}
              value={item.label}
              onChange={(e) => update(index, { label: e.target.value })}
            />
            <Input
              label={index === 0 ? featureStrings.botConfig.menuAction : undefined}
              value={item.action}
              mono
              onChange={(e) => update(index, { action: e.target.value })}
            />
            <div className="mb-0.5 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={featureStrings.botConfig.moveUp}
                className="focus-ring rounded-sm p-1.5 text-text-muted hover:text-text disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === menu.length - 1}
                aria-label={featureStrings.botConfig.moveDown}
                className="focus-ring rounded-sm p-1.5 text-text-muted hover:text-text disabled:opacity-40"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(menu.filter((_, i) => i !== index))}
                aria-label={featureStrings.botConfig.remove}
                className="focus-ring rounded-sm p-1.5 text-text-muted hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Row 2: style selector + optional URL */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Style pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-text-muted">Warna:</span>
              {STYLE_OPTIONS.map((opt) => {
                const active = (item.style ?? '') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => update(index, { style: opt.value as ButtonStyle | undefined || undefined })}
                    className={`
                      flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white
                      transition-all border-2
                      ${STYLE_CLASS[opt.value]}
                      ${active ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-90'}
                    `}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Optional URL */}
            <div className="flex flex-1 items-center gap-1 min-w-[180px]">
              <Link className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <input
                type="url"
                placeholder="URL (opsional — buka di browser)"
                value={item.url ?? ''}
                onChange={(e) => update(index, { url: e.target.value || undefined })}
                className="flex-1 bg-transparent text-xs text-text placeholder:text-text-muted outline-none border-b border-border focus:border-brand"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
