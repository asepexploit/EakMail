/**
 * Inline keyboard builders driven by bot_config (F17).
 * Uses Bot API 9.4 `style` field for colored buttons (success=green, primary=blue, danger=red).
 */
import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup, InlineKeyboardButton } from 'telegraf/types';
import type { BotMenuButton, ButtonStyle } from '@eakmail/shared-types';
import { MessageKey } from './i18n/keys.js';
import type { Translator } from './i18n/index.js';
import type { BotRuntimeConfig } from './runtime-config.js';

/** callback_data prefix for menu actions, e.g. "menu:catalog". */
export const MENU_ACTION_PREFIX = 'menu';
/** callback_data prefix for language selection, e.g. "lang:en". */
export const LANG_ACTION_PREFIX = 'lang';
/** callback_data prefix for catalog category drill-down, e.g. "cat:supplierId". */
export const CAT_ACTION_PREFIX = 'cat';
/** callback_data prefix for product purchase from catalog, e.g. "prod:productId". */
export const PROD_ACTION_PREFIX = 'prod';
/** callback_data prefix for quantity selection, e.g. "qty:productId:3" or "qty:productId:3:optionId". */
export const QTY_ACTION_PREFIX = 'qty';
/** callback_data prefix for product option selection, e.g. "opt:productId:optionId". */
export const OPT_ACTION_PREFIX = 'opt';
/** callback_data prefix for payment method selection, e.g. "pay:balance:orderId". */
export const PAY_ACTION_PREFIX = 'pay';

/** Default menu when bot_config.menu is empty. `label` is a MessageKey. */
const DEFAULT_MENU: BotMenuButton[] = [
  { label: MessageKey.MENU_BTN_CATALOG, action: 'catalog' },
  { label: MessageKey.MENU_BTN_STATUS, action: 'status' },
  { label: MessageKey.MENU_BTN_LANGUAGE, action: 'language' },
];

/**
 * A configured menu button's `label` is treated as an i18n key when it matches a known
 * MessageKey, otherwise as literal text (admin typed a custom label).
 */
function resolveLabel(label: string, tr: Translator): string {
  const known = Object.values(MessageKey).includes(label as MessageKey);
  return known ? tr(label as MessageKey) : label;
}

/** Build a styled callback button object (Bot API 9.4). */
function styledCallback(text: string, callbackData: string, style?: ButtonStyle): InlineKeyboardButton {
  const btn = { text, callback_data: callbackData } as unknown as Record<string, unknown>;
  if (style) btn['style'] = style;
  return btn as unknown as InlineKeyboardButton;
}

/** Build a styled url button object (Bot API 9.4). */
function styledUrl(text: string, url: string, style?: ButtonStyle): InlineKeyboardButton {
  const btn = { text, url } as unknown as Record<string, unknown>;
  if (style) btn['style'] = style;
  return btn as unknown as InlineKeyboardButton;
}

/**
 * Build the main menu inline keyboard from bot_config (or defaults).
 * Supports url buttons (btn.url) and Bot API 9.4 style (btn.style).
 */
export function mainMenuKeyboard(
  runtime: BotRuntimeConfig,
  tr: Translator,
): Markup.Markup<InlineKeyboardMarkup> {
  const source = runtime.menu.length > 0 ? runtime.menu : DEFAULT_MENU;
  const rows = source.map((btn) => {
    const label = resolveLabel(btn.label, tr);
    if (btn.url) {
      return [styledUrl(label, btn.url, btn.style)];
    }
    return [styledCallback(label, `${MENU_ACTION_PREFIX}:${btn.action}`, btn.style)];
  });
  return Markup.inlineKeyboard(rows);
}

/** Build the language-choice inline keyboard. */
export function languageKeyboard(tr: Translator): Markup.Markup<InlineKeyboardMarkup> {
  return Markup.inlineKeyboard([
    [Markup.button.callback(tr(MessageKey.LANGUAGE_BTN_ID), `${LANG_ACTION_PREFIX}:id`)],
    [Markup.button.callback(tr(MessageKey.LANGUAGE_BTN_EN), `${LANG_ACTION_PREFIX}:en`)],
  ]);
}

/**
 * Payment method keyboard — uses success style for QRIS (Bot API 9.4).
 */
export function paymentMethodKeyboard(
  orderId: string,
  balance: number,
  isPaymentConfigured: boolean,
  tr: Translator,
): Markup.Markup<InlineKeyboardMarkup> {
  const rows: InlineKeyboardButton[][] = [
    [
      styledCallback(
        tr(MessageKey.ORDER_PAY_BALANCE_BTN, { balance: balance.toLocaleString('id-ID') }),
        `${PAY_ACTION_PREFIX}:balance:${orderId}`,
        'primary',
      ),
    ],
  ];
  if (isPaymentConfigured) {
    rows.push([
      styledCallback(
        tr(MessageKey.ORDER_PAY_QRIS_BTN),
        `${PAY_ACTION_PREFIX}:qris:${orderId}`,
        'success',
      ),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}
