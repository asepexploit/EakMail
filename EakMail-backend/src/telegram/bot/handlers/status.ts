/**
 * /status handler — reports an order's current status to the customer who owns it
 * (Phase 3a). Copy from i18n; the status label is mapped from OrderStatus to a localized
 * key. Orders are scoped to the requesting customer so ids can't be probed across users.
 */
import type { Context } from 'telegraf';
import { OrderStatus } from '@eakmail/shared-types';
import { MessageKey } from '../i18n/keys.js';
import type { Translator } from '../i18n/index.js';
import { resolveBotContext } from '../context.js';
import * as orderRepository from '../order.repository.js';

/** Map each order status to its localized label key. */
const STATUS_LABEL_KEY: Record<OrderStatus, MessageKey> = {
  [OrderStatus.PENDING]: MessageKey.STATUS_PENDING,
  [OrderStatus.PAID]: MessageKey.STATUS_PAID,
  [OrderStatus.FULFILLING]: MessageKey.STATUS_FULFILLING,
  [OrderStatus.DELIVERED]: MessageKey.STATUS_DELIVERED,
  [OrderStatus.FAILED]: MessageKey.STATUS_FAILED,
  [OrderStatus.REFUND_PENDING]: MessageKey.STATUS_REFUND_PENDING,
  [OrderStatus.REFUNDED]: MessageKey.STATUS_REFUNDED,
  [OrderStatus.EXPIRED]: MessageKey.STATUS_EXPIRED,
};

function statusLabel(status: string, tr: Translator): string {
  const key = STATUS_LABEL_KEY[status as OrderStatus];
  return key ? tr(key) : status;
}

function parseOrderId(ctx: Context): string | null {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

export async function handleStatus(ctx: Context): Promise<void> {
  const bot = await resolveBotContext(ctx);
  if (!bot) return;

  const orderId = parseOrderId(ctx);
  if (!orderId) {
    await ctx.reply(bot.tr(MessageKey.STATUS_USAGE));
    return;
  }

  const order = await orderRepository.findCustomerOrder(orderId, bot.customer.id);
  if (!order) {
    await ctx.reply(bot.tr(MessageKey.STATUS_NOT_FOUND));
    return;
  }

  await ctx.reply(
    bot.tr(MessageKey.STATUS_LINE, {
      orderId: order.id,
      statusLabel: statusLabel(order.status, bot.tr),
    }),
  );
}
