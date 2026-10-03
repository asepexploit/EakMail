/**
 * Composition root / process entrypoint (ARCHITECTURE.md §5, TASKS.md Phase 1/2).
 *
 * Wires the whole backend together and starts it:
 *   1. load + validate config (fail fast on bad env)
 *   2. connect Prisma
 *   3. build the Fastify server (routes + WebSocket stream)
 *   4. start the BullMQ workers (order-fulfillment / workflow-run / payment-poll / notifications)
 *   5. build + launch the storefront bot — start() is a no-op under USE_MOCKS (no live Telegram)
 *   6. listen on config.HOST/PORT
 *   7. graceful shutdown on SIGINT/SIGTERM
 */
import { loadConfig } from './config/index.js';
import { prisma, disconnectPrisma } from './db/client.js';
import { logger } from './lib/logger.js';
import { buildServer } from './api/server.js';
import { buildBot, type StorefrontBot } from './telegram/bot/index.js';
// Single source of truth for the worker set (includes broadcast). Do not re-list workers here.
import { startWorkers } from './queue/workers/index.js';
import { startPaymentSweep } from './modules/payments/payment-sweep.js';
import { startAllMonitors } from './modules/promotion/auto-join-monitor.js';

const log = logger.child({ module: 'main' });

async function main(): Promise<void> {
  const config = loadConfig();

  // Fail fast if the database is unreachable.
  await prisma.$connect();
  log.info('database connected');

  const app = await buildServer();

  const workers = startWorkers();
  log.info({ count: workers.workers.length }, 'workers started');

  const stopSweep = startPaymentSweep();
  log.info('payment expiry sweep started');

  // The bot is always built (so its send API is wired); start() is a no-op when mocking.
  const bot: StorefrontBot = await buildBot();
  await bot.start();

  await app.listen({ host: config.HOST, port: config.PORT });
  log.info({ host: config.HOST, port: config.PORT, mockBot: bot.isMock }, 'server listening');

  // Start auto-join monitors for accounts with autoJoinEnabled=true
  await startAllMonitors().catch((err) => log.warn({ err }, 'startAllMonitors failed (non-fatal)'));

  // ---- graceful shutdown ----------------------------------------------------
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'shutting down');
    try {
      await app.close();
      await bot.stop(signal);
      stopSweep();
      await workers.stop();
      await disconnectPrisma();
      log.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'fatal: failed to start');
  process.exit(1);
});
