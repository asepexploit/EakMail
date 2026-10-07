/**
 * Route path constants — the single source of truth shared by the router and
 * the sidebar navigation. Concepts (English) map to Bahasa Indonesia labels in
 * lib/strings.ts (DESIGN_SYSTEM.md §14). Pages themselves are built elsewhere.
 */
export const routes = {
  login: '/login',
  overview: '/',
  orders: '/orders',
  customers: '/customers',
  monitoring: '/monitoring',
  logs: '/logs',
  products: '/products',
  suppliers: '/suppliers',
  accounts: '/accounts',
  botConfig: '/bot-config',
  broadcast: '/broadcast',
  workflowBuilder: '/workflows',
  docs: '/docs',
  stock: '/stock',
  payments: '/payments',
  settings: '/settings',
  promotionAccounts: '/promotion/accounts',
  promotionCampaigns: '/promotion/campaigns',
  promotionLogs: '/promotion/logs',
  monitorAccounts: '/monitor/accounts',
  monitorGroups: '/monitor/groups',
  monitorActivity: '/monitor/activity',
  monitorMessages: '/monitor/messages',
  eakteleStock: '/eaktele/stock',
} as const;

export type RouteKey = keyof typeof routes;
