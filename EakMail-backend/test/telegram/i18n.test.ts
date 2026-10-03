/**
 * Tests for the storefront bot i18n resolver (t / translator):
 *  - returns the requested locale's catalog string
 *  - bot_config.texts override wins over the static catalog
 *  - falls back to the default locale ('id') when a key is missing in the requested locale
 *  - {{name}} placeholders are interpolated; unknown placeholders are left intact
 */
import '../workflow/_env.js';
import { describe, it, expect } from 'vitest';
import { Language, DEFAULT_LANGUAGE } from '@eakmail/shared-types';
import { t, translator, type TextOverrides } from '../../src/telegram/bot/i18n/index.js';
import { MessageKey } from '../../src/telegram/bot/i18n/keys.js';
import en from '../../src/telegram/bot/i18n/locales/en.js';
import id from '../../src/telegram/bot/i18n/locales/id.js';

describe('i18n resolver', () => {
  it('resolves a key from the requested locale catalog', () => {
    expect(t(MessageKey.MENU_TITLE, Language.EN)).toBe(en[MessageKey.MENU_TITLE]);
    expect(t(MessageKey.MENU_TITLE, Language.ID)).toBe(id[MessageKey.MENU_TITLE]);
  });

  it('lets a bot_config override win over the static catalog', () => {
    const overrides: TextOverrides = { en: { [MessageKey.MENU_TITLE]: 'Custom menu' } };
    expect(t(MessageKey.MENU_TITLE, Language.EN, undefined, overrides)).toBe('Custom menu');
  });

  it('falls back to the default locale when the requested locale lacks the key', () => {
    // Simulate a partial locale by requesting an unknown language code; the resolver
    // then falls through to the default-locale ('id') catalog.
    const fakeLang = 'zz' as unknown as Language;
    expect(t(MessageKey.MENU_TITLE, fakeLang)).toBe(id[MessageKey.MENU_TITLE]);
    expect(DEFAULT_LANGUAGE).toBe(Language.ID);
  });

  it('uses a default-locale override before the default-locale catalog on fallback', () => {
    const overrides: TextOverrides = { id: { [MessageKey.MENU_TITLE]: 'Menu ditimpa' } };
    const fakeLang = 'zz' as unknown as Language;
    expect(t(MessageKey.MENU_TITLE, fakeLang, undefined, overrides)).toBe('Menu ditimpa');
  });

  it('interpolates {{name}} placeholders and leaves unknown ones intact', () => {
    const rendered = t(MessageKey.WELCOME, Language.EN, { brandName: 'EakMail' });
    expect(rendered).toContain('EakMail');
    expect(rendered).not.toContain('{{brandName}}');
    // No vars supplied → placeholder is left visible rather than blanked.
    expect(t(MessageKey.WELCOME, Language.EN)).toContain('{{brandName}}');
  });

  it('translator binds a fixed language + overrides', () => {
    const tr = translator(Language.ID, { id: { [MessageKey.MENU_TITLE]: 'Terikat' } });
    expect(tr(MessageKey.MENU_TITLE)).toBe('Terikat');
  });
});
