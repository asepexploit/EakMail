/**
 * Shared query-key factory. Centralizing keys keeps cache invalidation consistent
 * across feature hooks (avoids stringly-typed drift). The QueryClient instance itself
 * is provided by the app shell's QueryProvider (app/providers/query-provider.tsx).
 */

/** Stable query-key builder per resource. */
export const queryKeys = {
  auth: { me: ['auth', 'me'] as const },
  accounts: {
    all: ['accounts'] as const,
    detail: (id: string) => ['accounts', id] as const,
  },
  suppliers: {
    all: ['suppliers'] as const,
    list: (params?: unknown) => ['suppliers', 'list', params] as const,
    detail: (id: string) => ['suppliers', id] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    list: (params?: unknown) => ['workflows', 'list', params] as const,
    detail: (id: string) => ['workflows', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: (params?: unknown) => ['products', 'list', params] as const,
    detail: (id: string) => ['products', id] as const,
  },
  botConfig: { current: ['bot-config'] as const },
  orders: {
    all: ['orders'] as const,
    list: (params?: unknown) => ['orders', 'list', params] as const,
    detail: (id: string) => ['orders', id] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (params?: unknown) => ['customers', 'list', params] as const,
    detail: (id: string) => ['customers', id] as const,
    stats: ['customers', 'stats'] as const,
  },
  payments: {
    all: ['payments'] as const,
    list: (params?: unknown) => ['payments', 'list', params] as const,
    byOrder: (orderId: string) => ['payments', 'order', orderId] as const,
  },
  executions: {
    all: ['executions'] as const,
    list: (params?: unknown) => ['executions', 'list', params] as const,
    detail: (id: string) => ['executions', id] as const,
  },
  broadcast: {
    all: ['broadcast'] as const,
    list: () => ['broadcast', 'list'] as const,
  },
  status: { system: ['status', 'system'] as const },
  logs: {
    deadLetter: ['logs', 'dead-letter'] as const,
    audit: (params?: unknown) => ['logs', 'audit', params] as const,
  },
  settings: { current: ['settings'] as const },
} as const;
