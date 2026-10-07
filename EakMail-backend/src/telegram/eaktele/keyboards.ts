/** Keyboard builders untuk bot EakTele. */
import { Markup } from 'telegraf';
import { S } from './i18n/strings.js';

// ReplyKeyboard — menu utama (tampilan tombol besar di bawah chat)
export function mainMenuKeyboard() {
  return Markup.keyboard([
    [S.MENU_BUY],
    [S.MENU_ORDERS, S.MENU_BALANCE],
    [S.MENU_HELP],
  ]).resize();
}

// Inline keyboards — sub-menu dan konfirmasi

export const ACTION = {
  CATALOG_PRODUCT: 'et:prod',           // et:prod:<productId>
  ORDER_START_BUY: 'et:buy:start',           // et:buy:start:<productId>
  ORDER_PAY_BALANCE: 'et:pay:balance',       // et:pay:balance:<productId>
  ORDER_PAY_BALANCE_CONFIRM: 'et:pay:bal',   // konfirmasi dari payment select screen
  ORDER_PAY_QRIS: 'et:pay:qris',             // et:pay:qris:<productId>
  ORDER_PAY_QRIS_CONFIRM: 'et:pay:qr',       // konfirmasi dari payment select screen
  ORDER_CANCEL: 'et:cancel',
  ORDER_DEPOSIT: 'et:deposit',
  GET_OTP: 'et:otp:get',                 // et:otp:get:<stockId>
  REFRESH_OTP: 'et:otp:refresh',        // et:otp:refresh:<stockId>
  INSTRUCTION: 'et:instruction',        // et:instruction:<stockId|catalog>
  LOGOUT_GUIDE: 'et:logout:guide',      // et:logout:guide:<stockId>
  CONFIRM_LOGOUT: 'et:logout:confirm',  // et:logout:confirm:<stockId>
  ORDER_DETAIL: 'et:order',             // et:order:<stockId>
  BACK_TO_CATALOG: 'et:back:catalog',
  BACK_MENU: 'et:back',
} as const;

export function deliveryKeyboard(stockId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(S.BTN_GET_OTP, `${ACTION.GET_OTP}:${stockId}`),
      Markup.button.callback(S.BTN_INSTRUCTION_SHORT, `${ACTION.INSTRUCTION}:${stockId}`),
    ],
    [Markup.button.callback(S.BTN_CONFIRM_LOGOUT, `${ACTION.CONFIRM_LOGOUT}:${stockId}`)],
  ]);
}

export function otpKeyboard(stockId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(S.BTN_REFRESH_OTP, `${ACTION.REFRESH_OTP}:${stockId}`)],
    [Markup.button.callback(S.BTN_BACK, `${ACTION.ORDER_DETAIL}:${stockId}`)],
  ]);
}

export function logoutGuideKeyboard(stockId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(S.BTN_CONFIRM_LOGOUT, `${ACTION.CONFIRM_LOGOUT}:${stockId}`)],
    [Markup.button.callback(S.BTN_BACK, ACTION.BACK_MENU)],
  ]);
}

export function insufficientBalanceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(S.BTN_DEPOSIT, ACTION.ORDER_DEPOSIT)],
    [Markup.button.callback(S.BTN_HOME, ACTION.BACK_MENU)],
  ]);
}

export function gateKeyboard(channels: string[]) {
  const joinButtons = channels.map((ch) => [
    Markup.button.url(S.BTN_JOIN(ch), `https://t.me/${ch.replace('@', '')}`),
  ]);
  return Markup.inlineKeyboard([
    ...joinButtons,
    [Markup.button.callback(S.BTN_JOINED, 'et:gate:check')],
  ]);
}
