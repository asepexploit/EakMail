import {
  Activity,
  Bot,
  CreditCard,
  History,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  PackageCheck,
  Radio,
  ScrollText,
  BookOpen,
  Settings,
  ShoppingCart,
  ScanEye,
  Smartphone,
  Truck,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { routes } from '@/app/routes';
import { strings } from '@/lib/strings';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact match required (used for the root/overview route). */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped sidebar navigation (DESIGN_SYSTEM.md §13.3). Group + item labels come
 * from the strings module (Bahasa Indonesia); icons are Lucide per §6.
 */
export const navGroups: NavGroup[] = [
  {
    label: strings.nav.groups.operasional,
    items: [
      { to: routes.overview, label: strings.nav.overview, icon: LayoutDashboard, end: true },
      { to: routes.orders, label: strings.nav.orders, icon: ShoppingCart },
      { to: routes.monitoring, label: strings.nav.monitoring, icon: LayoutDashboard },
      { to: routes.logs, label: strings.nav.logs, icon: ScrollText },
    ],
  },
  {
    label: strings.nav.groups.katalog,
    items: [
      { to: routes.customers, label: strings.nav.customers, icon: Users },
      { to: routes.products, label: strings.nav.products, icon: Package },
      { to: routes.stock, label: strings.nav.stock, icon: PackageCheck },
      { to: routes.suppliers, label: strings.nav.suppliers, icon: Truck },
      { to: routes.accounts, label: strings.nav.accounts, icon: Users },
    ],
  },
  {
    label: strings.nav.groups.bot,
    items: [
      { to: routes.botConfig, label: strings.nav.botConfig, icon: Bot },
      { to: routes.broadcast, label: strings.nav.broadcast, icon: Megaphone },
    ],
  },
  {
    label: strings.nav.groups.promosi,
    items: [
      { to: routes.promotionAccounts, label: strings.nav.promotionAccounts, icon: Users },
      { to: routes.promotionCampaigns, label: strings.nav.promotionCampaigns, icon: Radio },
      { to: routes.promotionLogs, label: strings.nav.promotionLogs, icon: History },
    ],
  },
  {
    label: strings.nav.groups.monitor,
    items: [
      { to: routes.monitorAccounts, label: strings.nav.monitorAccounts, icon: ScanEye },
      { to: routes.monitorGroups, label: strings.nav.monitorGroups, icon: Users },
      { to: routes.monitorMessages, label: strings.nav.monitorMessages, icon: MessageSquare },
      { to: routes.monitorActivity, label: strings.nav.monitorActivity, icon: Activity },
    ],
  },
  {
    label: strings.nav.groups.builder,
    items: [
      { to: routes.workflowBuilder, label: strings.nav.workflowBuilder, icon: Workflow },
      { to: routes.docs, label: strings.nav.docs, icon: BookOpen },
    ],
  },
  {
    label: strings.nav.groups.eaktele,
    items: [
      { to: routes.eakteleProducts, label: strings.nav.eakteleProducts, icon: Package },
      { to: routes.eakteleStock, label: strings.nav.eakteleStock, icon: Smartphone },
    ],
  },
  {
    label: strings.nav.groups.sistem,
    items: [
      { to: routes.payments, label: strings.nav.payments, icon: CreditCard },
      { to: routes.settings, label: strings.nav.settings, icon: Settings },
    ],
  },
];
