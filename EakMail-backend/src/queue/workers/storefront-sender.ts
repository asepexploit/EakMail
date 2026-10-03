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
  readonly isMock: boolean;
}

/** Deterministic mock: records nothing to the network, just logs. Used when USE_MOCKS. */
class MockStorefrontSender implements StorefrontSender {
  readonly isMock = true;
  async sendText(customerTelegramId: string, text: string): Promise<void> {
    log.info({ customerTelegramId, textLength: text.length }, 'mock storefront send');
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
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: customerTelegramId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Telegram sendMessage failed (${res.status}): ${detail}`);
    }
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
