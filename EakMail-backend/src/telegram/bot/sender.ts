/**
 * Outbound messaging to storefront customers (Phase 3a: delivery relay). Used by the
 * notifications worker and by the `DELIVER TO CUSTOMER` workflow node to push a message
 * to a customer's Telegram chat.
 *
 * Live sends go through the Telegraf client's Telegram API, registered by index.ts when
 * the bot is built. When config.USE_MOCKS is true (or no client is registered), the send
 * is logged instead of dispatched — never connects live (task rule).
 */
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'bot-sender' });

/** Minimal Telegram send surface (satisfied by Telegraf's `bot.telegram`). */
export interface TelegramSendApi {
  sendMessage(chatId: string | number, text: string): Promise<unknown>;
  sendPhoto(
    chatId: string | number,
    photo: string,
    extra?: { caption?: string },
  ): Promise<unknown>;
}

let sendApi: TelegramSendApi | null = null;

/** Register the live send API (called by buildBot when not mocking). */
export function registerSendApi(api: TelegramSendApi | null): void {
  sendApi = api;
}

/**
 * Send text to a customer by their Telegram id. Returns true when dispatched (or logged
 * in mock mode), false when a live send failed. Never throws to the caller so a delivery
 * failure is observable but does not crash the worker/engine.
 */
export async function sendToCustomer(telegramId: string, text: string): Promise<boolean> {
  if (config.USE_MOCKS || !sendApi) {
    log.info({ telegramId, mock: config.USE_MOCKS, text }, 'storefront send (not dispatched live)');
    return true;
  }
  try {
    await sendApi.sendMessage(telegramId, text);
    log.info({ telegramId }, 'storefront message sent');
    return true;
  } catch (err) {
    log.error({ err, telegramId }, 'failed to send storefront message');
    return false;
  }
}

/**
 * Send a photo (optionally captioned) to a customer by Telegram id. Same contract as
 * sendToCustomer: returns true when dispatched or logged in mock mode, false on a live
 * failure, and never throws. Used by broadcasts that attach an image.
 */
export async function sendPhotoToCustomer(
  telegramId: string,
  imageUrl: string,
  caption?: string,
): Promise<boolean> {
  if (config.USE_MOCKS || !sendApi) {
    log.info(
      { telegramId, mock: config.USE_MOCKS, imageUrl, caption },
      'storefront photo send (not dispatched live)',
    );
    return true;
  }
  try {
    await sendApi.sendPhoto(telegramId, imageUrl, caption ? { caption } : undefined);
    log.info({ telegramId }, 'storefront photo sent');
    return true;
  } catch (err) {
    log.error({ err, telegramId }, 'failed to send storefront photo');
    return false;
  }
}
