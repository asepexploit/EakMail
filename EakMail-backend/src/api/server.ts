/**
 * Fastify app factory. Wires cookie signing, the WebSocket plugin, all feature routes,
 * the live execution stream, and the central error handler. Call `buildServer()` to get a
 * configured (not-yet-listening) instance; the composition root binds it to config.HOST/PORT.
 * (ARCHITECTURE.md §5, backend-guide.md §2)
 */
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { accountsRoutes } from './routes/accounts.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { botConfigRoutes } from './routes/bot-config.routes.js';
import { broadcastRoutes } from './routes/broadcast.routes.js';
import { customersRoutes } from './routes/customers.routes.js';
import { logsRoutes } from './routes/logs.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { executionsRoutes } from './routes/executions.routes.js';
import { ordersRoutes } from './routes/orders.routes.js';
import { paymentsRoutes } from './routes/payments.routes.js';
import { productsRoutes } from './routes/products.routes.js';
import { statusRoutes } from './routes/status.routes.js';
import { suppliersRoutes } from './routes/suppliers.routes.js';
import { workflowsRoutes } from './routes/workflows.routes.js';
import { promotionRoutes } from './routes/promotion.routes.js';
import { monitorRoutes } from './routes/monitor.routes.js';
import { eakTeleRoutes } from './routes/eaktele.routes.js';
import { executionStreamHandler } from './ws/execution-stream.js';

/**
 * Return type is inferred so the concrete Pino logger generic is preserved and
 * plugin/route registrations stay type-compatible with this instance.
 */
export async function buildServer() {
  const app = Fastify({ logger });

  // Signed cookies back the session (auth guard verifies the signature).
  await app.register(cookie, { secret: config.SESSION_SECRET });

  // WebSocket support for live execution streaming.
  await app.register(websocket);

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));

  // Live execution stream: clients subscribe to per-execution or global event channels.
  app.get('/ws', { websocket: true }, executionStreamHandler);

  // Feature routes are grouped under /api. Routes that carry their own full resource path
  // (workflows, suppliers, executions) mount at the /api root; the rest mount per resource.
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(accountsRoutes, { prefix: '/accounts' });
      await api.register(productsRoutes, { prefix: '/products' });
      await api.register(botConfigRoutes, { prefix: '/bot-config' });
      await api.register(customersRoutes, { prefix: '/customers' });
      await api.register(broadcastRoutes, { prefix: '/broadcast' });
      await api.register(logsRoutes, { prefix: '/logs' });
      await api.register(settingsRoutes, { prefix: '/settings' });
      await api.register(ordersRoutes, { prefix: '/orders' });
      await api.register(paymentsRoutes, { prefix: '/payments' });
      await api.register(statusRoutes, { prefix: '/status' });
      await api.register(suppliersRoutes);
      await api.register(workflowsRoutes);
      await api.register(executionsRoutes);
      await api.register(promotionRoutes, { prefix: '/promotion' });
      await api.register(monitorRoutes, { prefix: '/monitor' });
      await api.register(eakTeleRoutes, { prefix: '/eaktele' });
    },
    { prefix: '/api' },
  );

  return app;
}
