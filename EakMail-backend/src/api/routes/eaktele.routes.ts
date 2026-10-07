/**
 * EakTele stock management API — dashboard CRUD stok akun Telegram.
 * Mounted under /api/eaktele.
 * Auth: semua endpoint butuh admin session (sama seperti route lain).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { stockService } from '../../modules/eaktele/stock.service.js';
import { stockLoginService } from '../../modules/eaktele/stock-login.service.js';
import { encrypt } from '../../lib/crypto.js';

const addStockSchema = z.object({
  productId: z.string().min(1),
  phone: z.string().min(7),
  password2fa: z.string().optional(),
  sessionString: z.string().optional(),   // paste session langsung
  apiId: z.number().int().optional(),
  apiHash: z.string().optional(),
  notes: z.string().optional(),
});

const loginStartSchema = z.object({
  productId: z.string().min(1),
  phone: z.string().min(7),
  password2fa: z.string().optional(),
  notes: z.string().optional(),
});

const loginSubmitSchema = z.object({
  stockId: z.string().min(1),
  loginId: z.string().min(1),
  code: z.string().optional().default(''),   // empty string allowed for 2FA-only step
  password: z.string().optional(),
});

const bulkImportSchema = z.object({
  productId: z.string().min(1),
  // lines: "phone|2fa|session_string" (2fa dan session opsional)
  lines: z.array(z.string()).min(1).max(200),
});

export async function eakTeleRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/eaktele/stock — list semua stok
  app.get('/stock', async (req: FastifyRequest) => {
    const query = req.query as { productId?: string; status?: string };
    return stockService.list({
      productId: query.productId,
      status: query.status as Parameters<typeof stockService.list>[0] extends { status?: infer S } ? S : never,
    });
  });

  // GET /api/eaktele/stock/:id
  app.get('/stock/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    return stockService.get(id);
  });

  // GET /api/eaktele/stock/:id/count — jumlah stok per status untuk satu produk
  app.get('/stock/:productId/count', async (req: FastifyRequest) => {
    const { productId } = req.params as { productId: string };
    return stockService.countByStatus(productId);
  });

  // POST /api/eaktele/stock — tambah stok (session paste / langsung)
  app.post('/stock', async (req: FastifyRequest) => {
    const body = addStockSchema.parse(req.body);
    const sessionEnc = body.sessionString ? encrypt(body.sessionString) : undefined;
    const apiHashEnc = body.apiHash ? encrypt(body.apiHash) : undefined;
    return stockService.addStock({
      productId: body.productId,
      phone: body.phone,
      password2fa: body.password2fa,
      sessionEnc,
      apiId: body.apiId,
      apiHashEnc,
      notes: body.notes,
    });
  });

  // POST /api/eaktele/stock/bulk — import massal CSV
  app.post('/stock/bulk', async (req: FastifyRequest) => {
    const body = bulkImportSchema.parse(req.body);
    const results: { phone: string; ok: boolean; error?: string }[] = [];

    for (const line of body.lines) {
      const parts = line.split('|');
      const phone = parts[0]?.trim();
      const password2fa = parts[1]?.trim() || undefined;
      const sessionString = parts[2]?.trim() || undefined;

      if (!phone) {
        results.push({ phone: line, ok: false, error: 'format tidak valid' });
        continue;
      }

      try {
        const sessionEnc = sessionString ? encrypt(sessionString) : undefined;
        await stockService.addStock({
          productId: body.productId,
          phone,
          password2fa,
          sessionEnc,
        });
        results.push({ phone, ok: true });
      } catch (err) {
        results.push({ phone, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { total: results.length, ok: results.filter((r) => r.ok).length, results };
  });

  // POST /api/eaktele/stock/login/start — kirim OTP untuk login akun baru
  app.post('/stock/login/start', async (req: FastifyRequest) => {
    const body = loginStartSchema.parse(req.body);
    return stockLoginService.startLogin(body);
  });

  // POST /api/eaktele/stock/login/submit — submit kode OTP
  app.post('/stock/login/submit', async (req: FastifyRequest) => {
    const body = loginSubmitSchema.parse(req.body);
    return stockLoginService.submitCode(body.stockId, body.loginId, body.code, body.password);
  });

  // POST /api/eaktele/stock/login/abort
  app.post('/stock/login/abort', async (req: FastifyRequest) => {
    const { loginId } = req.body as { loginId: string };
    await stockLoginService.abort(loginId);
    return { ok: true };
  });

  // PATCH /api/eaktele/stock/:id/notes — update catatan admin
  app.patch('/stock/:id/notes', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const { notes } = req.body as { notes: string };
    const { stockRepository } = await import('../../modules/eaktele/stock.repository.js');
    return stockRepository.update(id, { notes });
  });

  // DELETE /api/eaktele/stock/:id — hapus stok (soft: set INVALID)
  app.delete('/stock/:id', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    await stockService.remove(id);
    return { ok: true };
  });
}
