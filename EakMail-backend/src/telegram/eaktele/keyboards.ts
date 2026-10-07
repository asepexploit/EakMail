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
  CATALOG_PRODUCT: 'et:prod',   // et:prod:<productId>
  ORDER_PAY_BALANCE: 'et:pay:balance', // et:pay:balance:<orderId>
  ORDER_PAY_QRIS: 'et:pay:qris',      // et:pay:qris:<orderId>
  ORDER_CANCEL: 'et:cancel',
  GET_OTP: 'et:otp',            // et:otp:<stockId>
  REFRESH_OTP: 'et:otp:refresh', // et:otp:refresh:<stockId>
  LOGOUT_GUIDE: 'et:logout:guide', // et:logout:guide:<stockId>
  CONFIRM_LOGOUT: 'et:logout:confirm', // et:logout:confirm:<stockId>
  ORDER_DETAIL: 'et:order',     // et:order:<orderId>
  BACK_MENU: 'et:back',
} as const;

export function catalogProductKeyboard(productId: string, name: string, price: number, inStock: boolean) {
  if (!inStock) {
    return Markup.inlineKeyboard([
      [Markup.button.callback(S.BTN_BACK, ACTION.BACK_MENU)],
    ]);
  }
  return Markup.inlineKeyboard([
    [Markup.button.callback(S.BTN_BUY_ACCOUNT(name, price), `${ACTION.CATALOG_PRODUCT}:${productId}`)],
    [Markup.button.callback(S.BTN_BACK, ACTION.BACK_MENU)],
  ]);
}

export function orderConfirmKeyboard(orderId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(S.BTN_PAY_BALANCE, `${ACTION.ORDER_PAY_BALANCE}:${orderId}`)],
    [Markup.button.callback(S.BTN_PAY_QRIS, `${ACTION.ORDER_PAY_QRIS}:${orderId}`)],
    [Markup.button.callback(S.BTN_CANCEL, ACTION.ORDER_CANCEL)],
  ]);
}

export function deliveryKeyboard(stockId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(S.BTN_GET_OTP, `${ACTION.GET_OTP}:${stockId}`),
      Markup.button.callback(S.BTN_LOGOUT_GUIDE, `${ACTION.LOGOUT_GUIDE}:${stockId}`),
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

export function gateKeyboard(channels: string[]) {
  const joinButtons = channels.map((ch) => [
    Markup.button.url(S.BTN_JOIN(ch), `https://t.me/${ch.replace('@', '')}`),
  ]);
  return Markup.inlineKeyboard([
    ...joinButtons,
    [Markup.button.callback(S.BTN_JOINED, 'et:gate:check')],
  ]);
}
