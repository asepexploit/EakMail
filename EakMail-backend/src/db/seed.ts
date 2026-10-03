/**
 * Development seed (TASKS.md Phase 1/2). Idempotent: safe to run repeatedly — it checks
 * for existing rows before creating, so `pnpm --filter @eakmail/backend seed` can be re-run.
 *
 * Seeds a coherent slice the whole stack can exercise end-to-end against the mock:
 *   - an admin user (admin@eakmail.local / admin12345)
 *   - a sample Telegram account (LOGGED_OUT — no live session)
 *   - a sample supplier bound to that account
 *   - the canonical workflow graph (validated before insert), owned by the supplier
 *   - a product mapped to the workflow
 *   - a default BotConfig singleton (Bahasa Indonesia storefront copy)
 */
import { prisma } from './client.js';
import { logger } from '../lib/logger.js';
import * as authService from '../modules/auth/auth.service.js';
import { validateWorkflowGraph } from '../modules/workflows/workflow-validator.js';
import { canonicalWorkflowGraph } from './canonical-workflow.js';
import type { Prisma } from '@prisma/client';
import type { WorkflowGraph } from '@eakmail/shared-types';

const log = logger.child({ module: 'seed' });

const ADMIN_EMAIL = 'admin@eakmail.local';
const ADMIN_PASSWORD = 'admin12345';
const ACCOUNT_LABEL = 'Demo Account';
const SUPPLIER_BOT_USERNAME = '@demo_supplier_bot';
const WORKFLOW_NAME = 'Canonical Demo Workflow';
const PRODUCT_NAME = 'Netflix Premium 1 Bulan';

function toJson(graph: WorkflowGraph): Prisma.InputJsonValue {
  return graph as unknown as Prisma.InputJsonValue;
}

async function seedAdmin(): Promise<void> {
  const existing = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    log.info({ email: ADMIN_EMAIL }, 'admin already exists — skipping');
    return;
  }
  await authService.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  log.info({ email: ADMIN_EMAIL }, 'admin created');
}

async function seedAccount(): Promise<string> {
  const existing = await prisma.telegramAccount.findFirst({ where: { label: ACCOUNT_LABEL } });
  if (existing) return existing.id;
  const account = await prisma.telegramAccount.create({
    data: {
      label: ACCOUNT_LABEL,
      phone: '+6281234567890',
      status: 'LOGGED_OUT',
    },
  });
  log.info({ id: account.id }, 'telegram account created');
  return account.id;
}

async function seedWorkflow(): Promise<string> {
  const existing = await prisma.workflow.findFirst({ where: { name: WORKFLOW_NAME } });
  if (existing) return existing.id;

  const graph = canonicalWorkflowGraph();
  const result = validateWorkflowGraph(graph);
  if (!result.valid) {
    const messages = result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message)
      .join('; ');
    throw new Error(`Canonical workflow graph is invalid: ${messages}`);
  }

  const workflow = await prisma.workflow.create({
    data: {
      name: WORKFLOW_NAME,
      graph: toJson(graph),
      version: 1,
      isActive: true,
      versionsHistory: { create: { graph: toJson(graph), version: 1 } },
    },
  });
  log.info({ id: workflow.id }, 'canonical workflow created');
  return workflow.id;
}

async function seedSupplier(accountId: string, workflowId: string): Promise<string> {
  const existing = await prisma.supplier.findFirst({
    where: { botUsername: SUPPLIER_BOT_USERNAME },
  });
  if (existing) {
    // Ensure it points at the canonical workflow even on a re-run.
    if (existing.defaultWorkflowId !== workflowId) {
      await prisma.supplier.update({
        where: { id: existing.id },
        data: { defaultWorkflowId: workflowId },
      });
    }
    return existing.id;
  }
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Demo Supplier',
      botUsername: SUPPLIER_BOT_USERNAME,
      defaultWorkflowId: workflowId,
      accounts: { create: [{ accountId }] },
    },
  });
  // Bind the workflow to the supplier so the graph shows an owner in the builder.
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { supplierId: supplier.id },
  });
  log.info({ id: supplier.id }, 'supplier created');
  return supplier.id;
}

async function seedProduct(supplierId: string, workflowId: string): Promise<void> {
  const existing = await prisma.product.findFirst({ where: { name: PRODUCT_NAME } });
  if (existing) {
    log.info({ id: existing.id }, 'product already exists — skipping');
    return;
  }
  const product = await prisma.product.create({
    data: {
      name: PRODUCT_NAME,
      price: 45000,
      sku: 'NFLX-1M',
      description: 'Akun Netflix Premium sharing, garansi 30 hari.',
      supplierId,
      workflowId,
      stockMode: 'manual',
      stock: 100,
      active: true,
      options: {
        create: [
          { key: 'durasi', value: '1 bulan', price: 50000 },
          { key: 'durasi', value: '3 bulan', price: 130000 },
        ],
      },
    },
  });
  log.info({ id: product.id }, 'product created');
}

async function seedBotConfig(): Promise<void> {
  const existing = await prisma.botConfig.findFirst();
  if (existing) {
    log.info('bot config already exists — skipping');
    return;
  }
  const menu: Prisma.InputJsonValue = [
    { label: 'Katalog', action: 'catalog' },
    { label: 'Status Pesanan', action: 'status' },
    { label: 'Bahasa', action: 'language' },
  ];
  const texts: Prisma.InputJsonValue = {
    id: {
      welcome: 'Selamat datang di EakMail! Pilih menu di bawah untuk mulai belanja.',
      menu: 'Silakan pilih:',
      catalog: 'Berikut produk yang tersedia:',
      pay: 'Silakan selesaikan pembayaran melalui tautan berikut.',
      success: 'Pembayaran berhasil! Pesanan kamu sedang diproses.',
      failed: 'Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi support.',
    },
    en: {
      welcome: 'Welcome to EakMail! Pick a menu option below to start shopping.',
      menu: 'Please choose:',
      catalog: 'Here are the available products:',
      pay: 'Please complete your payment via the link below.',
      success: 'Payment received! Your order is being processed.',
      failed: 'Sorry, something went wrong. Please try again or contact support.',
    },
  };
  await prisma.botConfig.create({
    data: {
      brandName: 'EakMail',
      menu,
      texts,
    },
  });
  log.info('bot config created');
}

async function main(): Promise<void> {
  log.info('seeding database…');
  await seedAdmin();
  const accountId = await seedAccount();
  const workflowId = await seedWorkflow();
  const supplierId = await seedSupplier(accountId, workflowId);
  await seedProduct(supplierId, workflowId);
  await seedBotConfig();
  log.info('seed complete');
}

main()
  .catch((err) => {
    log.error({ err }, 'seed failed');
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
