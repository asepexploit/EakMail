/** Get OTP dan Refresh OTP handler untuk bot EakTele. */
import type { Context } from 'telegraf';
import { S } from '../i18n/strings.js';
import { otpKeyboard } from '../keyboards.js';
import { readOtp } from '../../../modules/eaktele/otp.service.js';
import { stockService } from '../../../modules/eaktele/stock.service.js';

function formatRelativeTime(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} jam lalu`;
}

export async function handleGetOtp(ctx: Context, stockId: string): Promise<void> {
  await ctx.answerCbQuery('Mengambil kode OTP...');

  const result = await readOtp(stockId);

  if (!result.ok) {
    let text: string;
    switch (result.error.reason) {
      case 'no_session':
        text = S.OTP_NO_SESSION;
        break;
      case 'session_invalid':
        text = S.OTP_SESSION_INVALID;
        break;
      case 'no_otp':
      default:
        text = S.OTP_NOT_FOUND;
        break;
    }
    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...otpKeyboard(stockId),
    }).catch(() => ctx.reply(text, { parse_mode: 'Markdown', ...otpKeyboard(stockId) }));
    return;
  }

  // Fetch phone hanya saat OTP berhasil ditemukan
  const stock = await stockService.get(stockId);
  const sentAtStr = formatRelativeTime(result.data.sentAt);
  const text = S.OTP_RESULT(stock.phone, result.data.code, sentAtStr, result.data.messageText);
  await ctx.editMessageText(text, { parse_mode: 'Markdown', ...otpKeyboard(stockId) })
    .catch(() => ctx.reply(text, { parse_mode: 'Markdown', ...otpKeyboard(stockId) }));
}

export async function handleRefreshOtp(ctx: Context, stockId: string): Promise<void> {
  await handleGetOtp(ctx, stockId);
}
