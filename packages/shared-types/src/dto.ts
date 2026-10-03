/**
 * API request/response DTOs — the FE/BE wire contract (REST).
 * Backend validates every inbound payload at runtime even though types are shared
 * (see .claude/rules/shared-types.md). Secret-bearing fields are write-only and never
 * returned (see ARCHITECTURE.md §10) — response DTOs omit them by design.
 */
import type {
  AccountStatus,
  BroadcastStatus,
  CampaignSendMode,
  CampaignStatus,
  ExecutionCommand,
  ExecutionMode,
  ExecutionState,
  Language,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PromotionAccountStatus,
  PromotionLogStatus,
  StepStatus,
  StockMode,
  SupplierType,
} from './enums.js';
import type { WorkflowGraph } from './workflow.js';

// ---- Common ------------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IdParam {
  id: string;
}

// ---- Auth (ARCHITECTURE.md §10) ---------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
  totp?: string;
}
export interface AdminUserDto {
  id: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}
export interface LoginResponse {
  user: AdminUserDto;
}

// ---- Telegram accounts (ARCHITECTURE.md §4.2) -------------------------------

export interface TelegramAccountDto {
  id: string;
  label: string;
  phoneMasked: string; // never the full phone
  status: AccountStatus;
  lastActivityAt: string | null;
}
export interface StartLoginRequest {
  label: string;
  phone: string;
}
export interface SubmitCodeRequest {
  loginId: string;
  code: string;
  password?: string; // 2FA
}
export interface LoginStepResponse {
  loginId: string;
  needsPassword: boolean;
  done: boolean;
  account?: TelegramAccountDto;
}

// ---- Suppliers ---------------------------------------------------------------

export interface SupplierDto {
  id: string;
  name: string;
  supplierType: SupplierType;
  // BOT type fields
  botUsername: string;
  accountIds: string[];
  defaultWorkflowId: string | null;
  // API type fields
  apiBaseUrl: string | null;
  apiKeySet: boolean;        // never returns the key itself
  apiAuthHeader: string | null;
  // Stats
  successRate: number | null;
  avgFulfillMs: number | null;
  lastError: string | null;
}
export interface UpsertSupplierRequest {
  name: string;
  supplierType?: SupplierType;
  // BOT
  botUsername?: string;
  accountIds?: string[];
  defaultWorkflowId?: string | null;
  // API
  apiBaseUrl?: string | null;
  /** Write-only: stored encrypted, never echoed. */
  apiKey?: string | null;
  apiAuthHeader?: string | null;
}

/** Response from syncing products from an API supplier. */
export interface ApiSupplierProduct {
  externalId: number | string;
  name: string;
  category: string;
  basePrice: number;
  /** ISO 4217 currency code, e.g. "IDR", "VND", "USD". Defaults to "IDR" if unknown. */
  currency?: string;
  stock: number;
  description: string;
}
export interface ApiSupplierSyncResponse {
  products: ApiSupplierProduct[];
  balance: number;
  total: number;
}

/** Import selected API supplier products as EakMail products. */
export interface ImportApiProductsRequest {
  products: Array<{
    externalId: number | string;
    name: string;
    price: number;
    description?: string | null;
  }>;
}

// ---- Products (F6; PRD.md §5.4) ---------------------------------------------

export interface ProductOptionDto {
  id: string;
  key: string;
  value: string;
  price: number;
}
export interface ProductDto {
  id: string;
  name: string;
  price: number; // Rupiah
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  supplierId: string | null;
  workflowId: string | null;
  stockMode: StockMode;
  stock: number;
  deliveryTemplate: string | null;
  externalProductId: string | null;
  active: boolean;
  options: ProductOptionDto[];
}
export interface UpsertProductRequest {
  name: string;
  price: number;
  sku?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  supplierId?: string | null;
  workflowId?: string | null;
  stockMode?: StockMode;
  stock?: number;
  deliveryTemplate?: string | null;
  externalProductId?: string | null;
  active?: boolean;
  options?: Array<{ key: string; value: string; price?: number }>;
}

// ---- Stock items (local inventory) -------------------------------------------
export interface StockItemDto {
  id: string;
  productId: string;
  payload: string;
  usedAt: string | null;
  orderId: string | null;
  /** Customer name who received this item (null if available). */
  customerName: string | null;
  createdAt: string;
}
export interface AddStockRequest {
  /** One item per line. Each line becomes one StockItem. */
  items: string[];
}

// ---- Balance transactions -------------------------------------------------------

export interface BalanceTransactionDto {
  id: string;
  customerId: string;
  amount: number;   // positive = credit, negative = debit
  type: string;     // 'topup_admin' | 'purchase' | 'refund_balance'
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface TopupBalanceRequest {
  amount: number;
  note?: string | null;
}

// ---- Bot config (F17; PRD.md §5.4a) -----------------------------------------

export type ButtonStyle = 'success' | 'primary' | 'danger';

export interface BotMenuButton {
  label: string; // per-locale label handled in `texts`; this is a key/id
  action: string; // e.g. "catalog" | "status" | "language" | custom
  /** Button style (Bot API 9.4+): success=green, primary=blue, danger=red */
  style?: ButtonStyle;
  /** Optional URL for url buttons (opens in browser, not a callback) */
  url?: string;
}
export interface BotConfigDto {
  id: string;
  brandName: string;
  logoUrl: string | null;
  /** Shown as photo above welcome message on /start */
  startPhotoUrl: string | null;
  /** URL for the "Hubungi CS" button in /help (e.g. https://t.me/yourcsbot). */
  csContactUrl: string | null;
  botTokenSet: boolean; // never returns the token itself (write-only)
  menu: BotMenuButton[];
  /** Per-locale editable copy: texts[locale][key] = string. */
  texts: Record<Language, Record<string, string>>;
  updatedAt: string;
}
export interface UpdateBotConfigRequest {
  brandName?: string;
  logoUrl?: string | null;
  /** Shown as photo above welcome message on /start */
  startPhotoUrl?: string | null;
  /** URL for the "Hubungi CS" button in /help (e.g. https://t.me/yourcsbot). */
  csContactUrl?: string | null;
  /** Write-only; when present, stored encrypted. Never echoed back. */
  botToken?: string;
  menu?: BotMenuButton[];
  texts?: Partial<Record<Language, Record<string, string>>>;
}

// ---- Workflows ---------------------------------------------------------------

export interface WorkflowDto {
  id: string;
  name: string;
  supplierId: string | null;
  graph: WorkflowGraph;
  version: number;
  isActive: boolean;
  updatedAt: string;
}
export interface UpsertWorkflowRequest {
  name: string;
  supplierId?: string | null;
  graph: WorkflowGraph;
  isActive?: boolean;
}
export interface WorkflowValidationIssue {
  nodeId?: string;
  severity: 'error' | 'warning';
  message: string;
}
export interface WorkflowValidationResult {
  valid: boolean;
  issues: WorkflowValidationIssue[];
}

// ---- Orders (BLUEPRINT.md §5) -----------------------------------------------

export interface OrderDto {
  id: string;
  customerId: string;
  productId: string;
  /** Display name of the product at time of list fetch. */
  productName: string;
  /** Customer's full name (firstName + lastName), @username, or null if unknown. */
  customerName: string | null;
  quantity: number;
  amount: number;
  status: OrderStatus;
  executionId: string | null;
  createdAt: string;
}
export interface OrderDetailDto extends OrderDto {
  payment: PaymentDto | null;
  deliveredAt: string | null;
  /** Decrypted content that was delivered to the customer (null if not yet delivered). */
  deliveryPayload: string | null;
}

// ---- Payments (Pakasir; ARCHITECTURE.md §8) ---------------------------------

export interface PaymentDto {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  fee: number | null;
  status: PaymentStatus;
  pakasirTxnId: string | null;
  qrString: string | null;
  vaNumber: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}
export interface CreateTransactionRequest {
  orderId: string;
  method: PaymentMethod;
}

// ---- Customers (storefront users) -------------------------------------------

export interface CustomerDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  language: Language;
  balance: number;
  isBlocked: boolean;
  /** Aggregated from DELIVERED orders. */
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface CustomerListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  language?: Language;
  blocked?: boolean;
}

export interface UpdateCustomerRequest {
  isBlocked?: boolean;
  balance?: number;
}

export interface CustomerStatsDto {
  totalCustomers: number;
  blockedCustomers: number;
  withOrders: number;
  byLanguage: Record<Language, number>;
}

// ---- Broadcast (customer messaging) -----------------------------------------

export interface BroadcastDto {
  id: string;
  message: string;
  imageUrl: string | null;
  status: BroadcastStatus;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface CreateBroadcastRequest {
  message: string;
  imageUrl?: string | null;
}

// ---- Executions (ARCHITECTURE.md §6) ----------------------------------------

export interface ExecutionStepDto {
  id: string;
  nodeId: string;
  nodeType: string;
  status: StepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  ts: string;
}
export interface ExecutionDto {
  id: string;
  workflowId: string;
  orderId: string | null;
  mode: ExecutionMode;
  state: ExecutionState;
  variables: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
}
export interface ExecutionDetailDto extends ExecutionDto {
  steps: ExecutionStepDto[];
}
export interface RunTestRequest {
  workflowId: string;
  accountId: string;
  /** Seed variables (simulated product options). */
  variables?: Record<string, string>;
}
export interface ExecutionCommandRequest {
  command: ExecutionCommand;
}

// ---- Promotion System --------------------------------------------------------

export interface PromotionAccountDto {
  id: string;
  label: string;
  phone: string;
  status: PromotionAccountStatus;
  floodUntil: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface PromotionCampaignDto {
  id: string;
  name: string;
  message: string;
  imageUrl: string | null;
  targetGroups: string[];
  intervalMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  delayBetweenGroupsSeconds: number;
  sendMode: CampaignSendMode;
  status: CampaignStatus;
  nextRunAt: string | null;
  accountIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromotionLogDto {
  id: string;
  campaignId: string;
  campaignName: string;
  accountId: string | null;
  accountLabel: string | null;
  targetGroup: string;
  status: PromotionLogStatus;
  errorMessage: string | null;
  sentAt: string;
}

export interface UpsertCampaignRequest {
  name: string;
  message: string;
  imageUrl?: string | null;
  targetGroups: string[];
  intervalMinutes: number;
  activeHoursStart: number;
  activeHoursEnd: number;
  activeDays: number[];
  delayBetweenGroupsSeconds: number;
  sendMode: CampaignSendMode;
  accountIds: string[];
}
