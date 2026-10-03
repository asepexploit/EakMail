import type { BotMenuButton, Language as LanguageType } from '@eakmail/shared-types';
import { featureStrings } from '@/features/shared/feature-strings';

export interface BotPreviewProps {
  brandName: string;
  welcome: string;
  startPhotoUrl?: string;
  menu: BotMenuButton[];
  locale: LanguageType;
}

const STYLE_BG: Record<string, string> = {
  success: '#16a34a',
  primary: '#2563eb',
  danger:  '#dc2626',
};

/** Mirror the backend pairing logic: half buttons share a row, full buttons get their own. */
function buildPreviewRows(menu: BotMenuButton[]): BotMenuButton[][] {
  const rows: BotMenuButton[][] = [];
  let halfBuffer: BotMenuButton | null = null;
  for (const btn of menu) {
    if (btn.width === 'half') {
      if (halfBuffer) { rows.push([halfBuffer, btn]); halfBuffer = null; }
      else halfBuffer = btn;
    } else {
      if (halfBuffer) { rows.push([halfBuffer]); halfBuffer = null; }
      rows.push([btn]);
    }
  }
  if (halfBuffer) rows.push([halfBuffer]);
  return rows;
}

/** Live preview of a sample bot message (DESIGN_SYSTEM.md §7.4b). Display-only. */
export function BotPreview({ brandName, welcome, startPhotoUrl, menu, locale }: BotPreviewProps) {
  return (
    <div>
      <p className="mb-2 text-xs text-text-muted">{featureStrings.botConfig.previewHint}</p>
      <div className="rounded-md border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {(brandName || 'B').slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-text">{brandName || 'Bot'}</span>
          <span className="ml-auto rounded-sm bg-surface px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
            {locale}
          </span>
        </div>

        {startPhotoUrl && (
          <div className="mb-2 overflow-hidden rounded-md">
            <img
              src={startPhotoUrl}
              alt="Start photo"
              className="w-full max-h-36 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className="whitespace-pre-wrap rounded-md rounded-tl-none bg-surface px-3 py-2 text-sm text-text">
          {welcome || '—'}
        </div>

        {menu.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {buildPreviewRows(menu).map((row, ri) => (
              <div key={ri} className={row.length === 2 ? 'grid grid-cols-2 gap-1.5' : 'flex'}>
                {row.map((button, bi) => {
                  const bg = button.style ? STYLE_BG[button.style] : '#374151';
                  return (
                    <span
                      key={bi}
                      className="flex-1 rounded-sm px-2 py-1.5 text-center text-xs font-medium text-white"
                      style={{ backgroundColor: bg }}
                    >
                      {button.label || button.action || '—'}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
