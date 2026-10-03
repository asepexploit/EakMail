/**
 * i18n internal types. A locale catalog is a full map from every MessageKey to a
 * template string. Templates use `{{name}}` placeholders substituted by the resolver.
 */
import type { MessageKey } from './keys.js';

/** A complete catalog: every message key maps to a template string for one locale. */
export type Catalog = Record<MessageKey, string>;

/** Variables substituted into a template's `{{name}}` placeholders. */
export type TemplateVars = Record<string, string | number>;
