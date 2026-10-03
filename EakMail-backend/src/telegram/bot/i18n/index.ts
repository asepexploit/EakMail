/**
 * i18n resolver for the storefront bot (F16; PRD.md §5.9).
 *
 * Resolution order for a key, given a customer language:
 *   1. bot_config.texts[lang][key]   (admin override, highest priority)
 *   2. static catalog[lang][key]      (built-in translation)
 *   3. bot_config.texts['id'][key]    (default-locale override)
 *   4. static catalog['id'][key]      (default-locale built-in — guaranteed present)
 *
 * The catalog for the default locale ('id') is complete, so step 4 always resolves.
 * `{{name}}` placeholders are substituted from `vars`; unknown placeholders are left
 * intact so a templating mistake is visible rather than silently blanked.
 */
import { DEFAULT_LANGUAGE, type Language } from '@eakmail/shared-types';
import type { MessageKey } from './keys.js';
import type { Catalog, TemplateVars } from './types.js';
import id from './locales/id.js';
import en from './locales/en.js';

/** Partial per-locale overrides sourced from bot_config.texts. */
export type TextOverrides = Partial<Record<Language, Partial<Record<string, string>>>>;

const catalogs: Record<Language, Catalog> = { id, en };

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Substitute `{{name}}` placeholders; leave unknown names untouched. */
function interpolate(template: string, vars?: TemplateVars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/** Look up one key in the override map for a locale, if any. */
function fromOverrides(
  overrides: TextOverrides | undefined,
  lang: Language,
  key: MessageKey,
): string | undefined {
  return overrides?.[lang]?.[key];
}

/**
 * Resolve a message. `overrides` are the bot_config.texts merged on top of the
 * static catalog; pass them so admin-edited copy wins. Falls back to DEFAULT_LANGUAGE.
 */
export function t(
  key: MessageKey,
  lang: Language,
  vars?: TemplateVars,
  overrides?: TextOverrides,
): string {
  const template =
    fromOverrides(overrides, lang, key) ??
    catalogs[lang]?.[key] ??
    fromOverrides(overrides, DEFAULT_LANGUAGE, key) ??
    catalogs[DEFAULT_LANGUAGE][key];
  return interpolate(template, vars);
}

/**
 * Bind a translator to a fixed language + overrides — the shape handlers use so they
 * never repeat lang/overrides on every call: `const tr = translator(lang, overrides)`.
 */
export function translator(lang: Language, overrides?: TextOverrides) {
  return (key: MessageKey, vars?: TemplateVars): string => t(key, lang, vars, overrides);
}

export type Translator = ReturnType<typeof translator>;
