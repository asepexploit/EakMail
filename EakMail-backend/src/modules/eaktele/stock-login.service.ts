/**
 * Login flow untuk tambah stok EakTele — reuse LoginFlow dari session-manager.
 * Admin input nomor HP → sistem kirim OTP → admin submit kode → session disimpan.
 * Identik dengan promotion-account.service.ts tapi target-nya TelegramAccountStock.
 */
import { LoginFlow } from '../../telegram/session-manager/login-flow.js';
import { logger } from '../../lib/logger.js';
import { stockRepository } from './stock.repository.js';
import { stockService } from './stock.service.js';

const log = logger.child({ module: 'eaktele-stock-login' });
const loginFlow = new LoginFlow();

export const stockLoginService = {
  /**
   * Step 1: kirim OTP ke nomor HP.
   * Buat row stok dahulu (status NO_SESSION), lalu mulai login.
   */
  async startLogin(input: {
    productId: string;
    phone: string;
    password2fa?: string;
    notes?: string;
  }): Promise<{ loginId: string; stockId: string }> {
    // Cek apakah nomor sudah ada di stok (jangan duplikasi)
    const existing = await stockRepository.findAll({ productId: input.productId });
    const dup = existing.find((s) => s.phone === input.phone);
    let stockId: string;

    if (dup) {
      stockId = dup.id;
      log.info({ stockId, phone: input.phone }, 'reusing existing stock row for re-login');
    } else {
      const row = await stockService.addStock({
        productId: input.productId,
        phone: input.phone,
        password2fa: input.password2fa,
        notes: input.notes,
      });
      stockId = row.id;
    }

    const loginId = `eaktele-${stockId}-${Date.now()}`;
    await loginFlow.start(loginId, input.phone);
    log.info({ loginId, stockId }, 'OTP sent for stock login');
    return { loginId, stockId };
  },

  /**
   * Step 2: submit kode OTP (dan 2FA password bila diperlukan).
   * Jika selesai, simpan session ke row stok.
   */
  async submitCode(
    stockId: string,
    loginId: string,
    code: string,
    password?: string,
  ): Promise<{ done: boolean; needsPassword: boolean }> {
    const result = await loginFlow.submitCode(loginId, code, password);

    if (result.done && result.sessionEnc) {
      await stockService.applySession(stockId, result.sessionEnc);
      log.info({ stockId, loginId }, 'stock login completed, session saved');
    }

    return { done: result.done, needsPassword: result.needsPassword };
  },

  /** Abort login flow bila admin batal / timeout. */
  async abort(loginId: string): Promise<void> {
    await loginFlow.abort(loginId);
  },
};
