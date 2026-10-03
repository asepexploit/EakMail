import { Language, type Language as LanguageType } from '@eakmail/shared-types';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs } from '@/components/ui';
import { featureStrings } from '@/features/shared/feature-strings';
import { languageLabel } from '@/features/shared/enum-labels';

/** Editable bot copy keys, in a stable order (per-locale, DESIGN_SYSTEM.md §7.4b). */
export const BOT_TEXT_KEYS = [
  'welcome',
  'menu',
  'buttons',
  'payInstructions',
  'success',
  'fail',
  'help',
] as const;
export type BotTextKey = (typeof BOT_TEXT_KEYS)[number];

const keyLabels: Record<BotTextKey, string> = {
  welcome: featureStrings.botConfig.textKeys.welcome,
  menu: featureStrings.botConfig.textKeys.menu,
  buttons: featureStrings.botConfig.textKeys.buttons,
  payInstructions: featureStrings.botConfig.textKeys.payInstructions,
  success: featureStrings.botConfig.textKeys.success,
  fail: featureStrings.botConfig.textKeys.fail,
  help: featureStrings.botConfig.textKeys.help,
};

export interface BotTextEditorProps {
  texts: Record<LanguageType, Record<string, string>>;
  activeLocale: LanguageType;
  onLocaleChange: (locale: LanguageType) => void;
  onTextChange: (locale: LanguageType, key: string, value: string) => void;
}

/** Per-locale bot text editor with ID/EN tabs (storefront stays bilingual). */
export function BotTextEditor({
  texts,
  activeLocale,
  onLocaleChange,
  onTextChange,
}: BotTextEditorProps) {
  const localeTexts = texts[activeLocale] ?? {};

  return (
    <div className="space-y-4">
      <Tabs
        value={activeLocale}
        onChange={(value) => onLocaleChange(value as LanguageType)}
        tabs={[
          { value: Language.ID, label: languageLabel[Language.ID] },
          { value: Language.EN, label: languageLabel[Language.EN] },
        ]}
      />
      <div className="space-y-3">
        {BOT_TEXT_KEYS.map((key) => (
          <Textarea
            key={key}
            label={keyLabels[key]}
            rows={2}
            value={localeTexts[key] ?? ''}
            onChange={(e) => onTextChange(activeLocale, key, e.target.value)}
          />
        ))}
      </div>
    </div>
  );
}
