/**
 * Storefront bot sender seam used by the notifications worker + fulfillment delivery.
 *
 * NOTE: at authoring time the storefront bot module (src/telegram/bot/) does not yet export
 * a `sender.ts`. This file defines the thin `StorefrontSender` interface the workers depend
 * on and provides both a real Telegram sendMessage implementation (Bot API, token read from
 * bot_config or config) and a mock. When the bot module later ships its own sender, swap
 * `getStorefrontSender()` to import it — the interface is the stable contract.
 *
 * Honors config.USE_MOCKS: with mocks on we never call the live Bot API.
 */
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { decrypt } from '../../lib/crypto.js';
import { prisma } from '../../db/client.js';

const log = logger.child({ module: 'storefront-sender' });

/** The one operation workers need: deliver a text message to a customer chat. */
export interface StorefrontSender {
  sendText(customerTelegramId: string, text: string): Promise<void>;
  /** Remove inline keyboard from an existing message (best-effort; swallows errors). */
  removeKeyboard(chatId: string, messageId: number): Promise<void>;
  /** Replace a photo message's image (best-effort; swallows errors). */
  replacePhoto(chatId: string, messageId: number, photoUrl: string): Promise<void>;
  /** Delete a message entirely (best-effort; swallows errors). */
  deleteMessage(chatId: string, messageId: number): Promise<void>;
  readonly isMock: boolean;
}

/** Deterministic mock: records nothing to the network, just logs. Used when USE_MOCKS. */
class MockStorefrontSender implements StorefrontSender {
  readonly isMock = true;
  async sendText(customerTelegramId: string, text: string): Promise<void> {
    log.info({ customerTelegramId, textLength: text.length }, 'mock storefront send');
  }
  async removeKeyboard(chatId: string, messageId: number): Promise<void> {
    log.info({ chatId, messageId }, 'mock remove keyboard');
  }
  async replacePhoto(chatId: string, messageId: number, photoUrl: string): Promise<void> {
    log.info({ chatId, messageId, photoUrl }, 'mock replace photo');
  }
  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    log.info({ chatId, messageId }, 'mock delete message');
  }
}

/**
 * Real sender over the Telegram Bot HTTP API. Resolves the bot token from the encrypted
 * bot_config row (preferred) and falls back to config.STOREFRONT_BOT_TOKEN. Uses global
 * fetch (Node 20+) so no extra client dependency is pulled in here.
 */
class TelegramBotSender implements StorefrontSender {
  readonly isMock = false;
  private tokenCache: string | null = null;

  private async resolveToken(): Promise<string> {
    if (this.tokenCache) return this.tokenCache;
    const row = await prisma.botConfig.findFirst({ select: { botTokenEnc: true } });
    const token = row?.botTokenEnc ? decrypt(row.botTokenEnc) : config.STOREFRONT_BOT_TOKEN;
    if (!token) throw new Error('Storefront bot token is not configured');
    this.tokenCache = token;
    return token;
  }

  async sendText(customerTelegramId: string, text: string): Promise<void> {
    const token = await this.resolveToken();
    const base = `https://api.telegram.org/bot${token}`;

    // Show typing indicator — fire-and-forget; a failure here must not block the send.
    await fetch(`${base}/sendChatAction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: customerTelegramId, action: 'typing' }),
    }).catch(() => {});

    // Simulate realistic typing time: ~20ms per char, capped between 1–3 s.
    const typingMs = Math.min(3000, Math.max(1000, text.length * 20));
    await new Promise((r) => setTimeout(r, typingMs));

    const res = await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: customerTelegramId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Telegram sendMessage failed (${res.status}): ${detail}`);
    }
  }

  async removeKeyboard(chatId: string, messageId: number): Promise<void> {
    const token = await this.resolveToken();
    await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    }).catch((err) => log.warn({ chatId, messageId, err }, 'removeKeyboard failed — non-fatal'));
  }

  async replacePhoto(chatId: string, messageId: number, photoUrl: string): Promise<void> {
    const token = await this.resolveToken();
    await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        media: { type: 'photo', media: photoUrl },
      }),
    }).catch((err) => log.warn({ chatId, messageId, photoUrl, err }, 'replacePhoto failed — non-fatal'));
  }

  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    const token = await this.resolveToken();
    await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    }).catch((err) => log.warn({ chatId, messageId, err }, 'deleteMessage failed — non-fatal'));
  }
}

let instance: StorefrontSender | null = null;

/** Singleton storefront sender — mock when USE_MOCKS, real Bot API otherwise. */
export function getStorefrontSender(): StorefrontSender {
  if (instance) return instance;
  instance = config.USE_MOCKS ? new MockStorefrontSender() : new TelegramBotSender();
  return instance;
}

/** Test/shutdown helper: drop the cached instance. */
export function resetStorefrontSender(): void {
  instance = null;
}
