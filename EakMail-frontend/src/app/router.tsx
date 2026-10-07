import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGuard } from '@/features/auth/AuthGuard';
import { LoginPage } from '@/pages/login/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { CustomersPage } from '@/pages/customers/CustomersPage';
import { MonitoringPage } from '@/pages/monitoring/MonitoringPage';
import { LogsPage } from '@/pages/logs/LogsPage';
import { ProductsPage } from '@/pages/products/ProductsPage';
import { SuppliersPage } from '@/pages/suppliers/SuppliersPage';
import { AccountsPage } from '@/pages/accounts/AccountsPage';
import { BotConfigPage } from '@/pages/bot-config/BotConfigPage';
import { BroadcastPage } from '@/pages/broadcast/BroadcastPage';
import { WorkflowsListPage } from '@/pages/workflows/WorkflowsListPage';
import { WorkflowBuilderPage } from '@/pages/workflows/WorkflowBuilderPage';
import { DocsPage } from '@/pages/docs/DocsPage';
import { PaymentsPage } from '@/pages/payments/PaymentsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { StockPage } from '@/pages/stock/StockPage';
import PromotionAccountsPage from '@/pages/promotion/PromotionAccountsPage';
import PromotionCampaignsPage from '@/pages/promotion/PromotionCampaignsPage';
import PromotionLogsPage from '@/pages/promotion/PromotionLogsPage';
import MonitorAccountsPage from '@/pages/monitor/MonitorAccountsPage';
import MonitorGroupsPage from '@/pages/monitor/MonitorGroupsPage';
import MonitorActivityPage from '@/pages/monitor/MonitorActivityPage';
import MonitorMessagesPage from '@/pages/monitor/MonitorMessagesPage';
import { EakTeleStockPage } from '@/pages/eaktele/EakTeleStockPage';
import { EakTeleProductsPage } from '@/pages/eaktele/EakTeleProductsPage';
import { routes } from './routes';

/**
 * Application routes (frontend-guide.md §3).
 *
 * `/login` is public. Everything else is gated by <AuthGuard>, which checks the admin
 * session and redirects unauthenticated visitors to /login. Authenticated pages mount
 * through the AppShell; feature pages fetch their own data.
 */
export const router = createBrowserRouter([
  {
    path: routes.login,
    element: <LoginPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: routes.orders, element: <OrdersPage /> },
          { path: routes.customers, element: <CustomersPage /> },
          { path: routes.monitoring, element: <MonitoringPage /> },
          { path: routes.logs, element: <LogsPage /> },
          { path: routes.products, element: <ProductsPage /> },
          { path: routes.stock, element: <StockPage /> },
          { path: routes.suppliers, element: <SuppliersPage /> },
          { path: routes.accounts, element: <AccountsPage /> },
          { path: routes.botConfig, element: <BotConfigPage /> },
          { path: routes.broadcast, element: <BroadcastPage /> },
          { path: routes.workflowBuilder, element: <WorkflowsListPage /> },
          { path: `${routes.workflowBuilder}/new`, element: <WorkflowBuilderPage /> },
          { path: `${routes.workflowBuilder}/:id`, element: <WorkflowBuilderPage /> },
          { path: routes.docs, element: <DocsPage /> },
          { path: routes.payments, element: <PaymentsPage /> },
          { path: routes.settings, element: <SettingsPage /> },
          { path: routes.promotionAccounts, element: <PromotionAccountsPage /> },
          { path: routes.promotionCampaigns, element: <PromotionCampaignsPage /> },
          { path: routes.promotionLogs, element: <PromotionLogsPage /> },
          { path: routes.monitorAccounts, element: <MonitorAccountsPage /> },
          { path: routes.monitorGroups, element: <MonitorGroupsPage /> },
          { path: routes.monitorMessages, element: <MonitorMessagesPage /> },
          { path: routes.monitorActivity, element: <MonitorActivityPage /> },
          { path: routes.eakteleProducts, element: <EakTeleProductsPage /> },
          { path: routes.eakteleStock, element: <EakTeleStockPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
