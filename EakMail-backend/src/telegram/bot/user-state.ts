/**
 * Lightweight per-user bot state stored in Redis with short TTL.
 * Used to track conversational state like "awaiting topup amount".
 */
import { redis } from '../../lib/redis.js';

const TTL_SECONDS = 300; // 5 minutes

function key(telegramId: string | number, state: string): string {
  return `bot:state:${telegramId}:${state}`;
}

export async function setAwaitingTopup(telegramId: string | number): Promise<void> {
  await redis.set(key(telegramId, 'topup'), '1', 'EX', TTL_SECONDS);
}

export async function clearAwaitingTopup(telegramId: string | number): Promise<void> {
  await redis.del(key(telegramId, 'topup'));
}

export async function isAwaitingTopup(telegramId: string | number): Promise<boolean> {
  const val = await redis.get(key(telegramId, 'topup'));
  return val === '1';
}

// ---- Topup QR message location (for post-payment keyboard removal) -----------

/** Store {chatId}:{messageId} so the settle flow can edit the QR message later. */
export async function setTopupMsg(topupId: string, chatId: string | number, messageId: number): Promise<void> {
  await redis.set(`bot:topup:msg:${topupId}`, `${chatId}:${messageId}`, 'EX', 7200); // 2 h
}

export async function getTopupMsg(topupId: string): Promise<{ chatId: string; messageId: number } | null> {
  const val = await redis.get(`bot:topup:msg:${topupId}`);
  if (!val) return null;
  const idx = val.lastIndexOf(':');
  if (idx === -1) return null;
  return { chatId: val.slice(0, idx), messageId: parseInt(val.slice(idx + 1), 10) };
}

export async function clearTopupMsg(topupId: string): Promise<void> {
  await redis.del(`bot:topup:msg:${topupId}`);
}

// ---- Order QR message location (for post-payment deletion) ------------------

/** Store {chatId}:{messageId} so the webhook flow can delete the QR photo later. */
export async function setOrderQrMsg(orderId: string, chatId: string | number, messageId: number): Promise<void> {
  await redis.set(`bot:order:qr:${orderId}`, `${chatId}:${messageId}`, 'EX', 7200); // 2 h
}

export async function getOrderQrMsg(orderId: string): Promise<{ chatId: string; messageId: number } | null> {
  const val = await redis.get(`bot:order:qr:${orderId}`);
  if (!val) return null;
  const idx = val.lastIndexOf(':');
  if (idx === -1) return null;
  return { chatId: val.slice(0, idx), messageId: parseInt(val.slice(idx + 1), 10) };
}

export async function clearOrderQrMsg(orderId: string): Promise<void> {
  await redis.del(`bot:order:qr:${orderId}`);
}

// ---- Qty manual input state --------------------------------------------------

export async function setAwaitingQty(
  telegramId: string | number,
  productId: string,
  optionId?: string,
): Promise<void> {
  const value = optionId ? `${productId}:${optionId}` : productId;
  await redis.set(key(telegramId, 'qty'), value, 'EX', TTL_SECONDS);
}

export async function clearAwaitingQty(telegramId: string | number): Promise<void> {
  await redis.del(key(telegramId, 'qty'));
}

export async function getAwaitingQty(
  telegramId: string | number,
): Promise<{ productId: string; optionId?: string } | null> {
  const val = await redis.get(key(telegramId, 'qty'));
  if (!val) return null;
  const idx = val.indexOf(':');
  if (idx === -1) return { productId: val };
  return { productId: val.slice(0, idx), optionId: val.slice(idx + 1) };
}
