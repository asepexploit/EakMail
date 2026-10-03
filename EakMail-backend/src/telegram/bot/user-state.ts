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
