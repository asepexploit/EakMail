/**
 * The typed API client for the dashboard. Every backend call lives here, grouped by
 * resource, and is typed end-to-end with the shared DTOs (@eakmail/shared-types).
 * Feature hooks (TanStack Query) call these functions; UI never touches HTTP directly.
 *
 * Paths mirror the REST surface described in DESIGN_SYSTEM.md §7–§9 and the backend
 * route modules, all mounted under /api (see lib/http.ts). Secret-bearing fields are
 * write-only per the DTO contract and are never returned by the server.
 */
import type {
  AdminUserDto,
  ApiSupplierSyncResponse,
  BalanceTransactionDto,
  BotConfigDto,
  BroadcastDto,
  CreateBroadcastRequest,
  CreateTransactionRequest,
  CustomerDto,
  CustomerStatsDto,
  Language,
  ExecutionCommandRequest,
  ExecutionDetailDto,
  ExecutionDto,
  ImportApiProductsRequest,
  LoginRequest,
  LoginResponse,
  LoginStepResponse,
  OrderDetailDto,
  OrderDto,
  Paginated,
  PaymentDto,
  ProductDto,
  RunTestRequest,
  StartLoginRequest,
  SubmitCodeRequest,
  SupplierDto,
  TelegramAccountDto,
  TopupBalanceRequest,
  UpdateBotConfigRequest,
  UpdateCustomerRequest,
  UpsertProductRequest,
  UpsertSupplierRequest,
  UpsertWorkflowRequest,
  WorkflowDto,
  WorkflowValidationResult,
} from '@eakmail/shared-types';
import { http, type QueryParams } from './http.js';

/** Common list query shape used by paginated + filterable collections. */
export interface ListQuery extends QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface OrderListQuery extends ListQuery {
  status?: string;
  supplierId?: string;
  productId?: string;
  from?: string;
  to?: string;
}

export interface ExecutionListQuery extends ListQuery {
  state?: string;
  workflowId?: string;
  mode?: string;
}

export interface CustomerListQuery extends ListQuery {
  language?: Language;
  blocked?: boolean;
}

export const api = {
  auth: {
    login: (body: LoginRequest) => http.post<LoginResponse>('/auth/login', body),
    logout: () => http.post<void>('/auth/logout'),
    me: (signal?: AbortSignal) => http.get<AdminUserDto>('/auth/me', { signal }),
  },

  accounts: {
    list: (signal?: AbortSignal) => http.get<TelegramAccountDto[]>('/accounts', { signal }),
    get: (id: string, signal?: AbortSignal) =>
      http.get<TelegramAccountDto>(`/accounts/${id}`, { signal }),
    startLogin: (body: StartLoginRequest) =>
      http.post<LoginStepResponse>('/accounts/login/start', body),
    submitCode: (body: SubmitCodeRequest) =>
      http.post<LoginStepResponse>('/accounts/login/code', body),
    remove: (id: string) => http.delete<void>(`/accounts/${id}`),
  },

  suppliers: {
    list: (query?: ListQuery, signal?: AbortSignal) =>
      http.get<Paginated<SupplierDto>>('/suppliers', { query, signal }),
    get: (id: string, signal?: AbortSignal) => http.get<SupplierDto>(`/suppliers/${id}`, { signal }),
    create: (body: UpsertSupplierRequest) => http.post<SupplierDto>('/suppliers', body),
    update: (id: string, body: UpsertSupplierRequest) =>
      http.put<SupplierDto>(`/suppliers/${id}`, body),
    remove: (id: string) => http.delete<void>(`/suppliers/${id}`),
    syncProducts: (id: string) =>
      http.post<ApiSupplierSyncResponse>(`/suppliers/${id}/sync-products`, {}),
    importProducts: (body: ImportApiProductsRequest & { supplierId: string }) =>
      http.post<{ imported: number }>('/products/import-api', body),
  },

  workflows: {
    list: (query?: ListQuery, signal?: AbortSignal) =>
      http.get<Paginated<WorkflowDto>>('/workflows', { query, signal }),
    get: (id: string, signal?: AbortSignal) => http.get<WorkflowDto>(`/workflows/${id}`, { signal }),
    create: (body: UpsertWorkflowRequest) => http.post<WorkflowDto>('/workflows', body),
    update: (id: string, body: UpsertWorkflowRequest) =>
      http.put<WorkflowDto>(`/workflows/${id}`, body),
    remove: (id: string) => http.delete<void>(`/workflows/${id}`),
    toggleActive: (id: string, isActive: boolean) =>
      http.patch<WorkflowDto>(`/workflows/${id}/active`, { isActive }),
    validate: (body: UpsertWorkflowRequest) =>
      http.post<WorkflowValidationResult>('/workflows/validate', body),
    /** Roll the workflow back to a prior stored version. */
    rollback: (id: string, version: number) =>
      http.post<WorkflowDto>(`/workflows/${id}/rollback`, { version }),
  },

  products: {
    list: (query?: ListQuery, signal?: AbortSignal) =>
      http.get<Paginated<ProductDto>>('/products', { query, signal }),
    get: (id: string, signal?: AbortSignal) => http.get<ProductDto>(`/products/${id}`, { signal }),
    create: (body: UpsertProductRequest) => http.post<ProductDto>('/products', body),
    update: (id: string, body: UpsertProductRequest) =>
      http.put<ProductDto>(`/products/${id}`, body),
    setActive: (id: string, active: boolean) =>
      http.patch<ProductDto>(`/products/${id}/active`, { active }),
    remove: (id: string) => http.delete<void>(`/products/${id}`),
    listStock: (id: string, signal?: AbortSignal) =>
      http.get<{ items: import('@eakmail/shared-types').StockItemDto[]; available: number; total: number }>(`/products/${id}/stock`, { signal }),
    addStock: (id: string, items: string[]) =>
      http.post<{ added: number }>(`/products/${id}/stock`, { items }),
    deleteStockItem: (id: string, itemId: string) =>
      http.delete<{ ok: boolean }>(`/products/${id}/stock/${itemId}`),
    clearStock: (id: string) =>
      http.delete<{ cleared: number }>(`/products/${id}/stock`),
    updateDeliveryTemplate: (id: string, deliveryTemplate: string | null) =>
      http.patch<ProductDto>(`/products/${id}/delivery-template`, { deliveryTemplate }),
  },

  botConfig: {
    get: (signal?: AbortSignal) => http.get<BotConfigDto>('/bot-config', { signal }),
    update: (body: UpdateBotConfigRequest) => http.put<BotConfigDto>('/bot-config', body),
  },

  orders: {
    list: (query?: OrderListQuery, signal?: AbortSignal) =>
      http.get<Paginated<OrderDto>>('/orders', { query, signal }),
    get: (id: string, signal?: AbortSignal) =>
      http.get<OrderDetailDto>(`/orders/${id}`, { signal }),
    /** Re-run fulfillment for a stuck/failed order. */
    retry: (id: string) => http.post<OrderDetailDto>(`/orders/${id}/retry`),
    /** Trigger a refund through the payment provider. */
    refund: (id: string) => http.post<OrderDetailDto>(`/orders/${id}/refund`),
    /** Forcibly expire a PENDING order (admin manual cancel). */
    cancel: (id: string) => http.post<OrderDetailDto>(`/orders/${id}/cancel`),
  },

  customers: {
    list: (query?: CustomerListQuery, signal?: AbortSignal) =>
      http.get<Paginated<CustomerDto>>('/customers', { query, signal }),
    /** Aggregate counts for the stats row (total / blocked / with-orders / by language). */
    stats: (signal?: AbortSignal) => http.get<CustomerStatsDto>('/customers/stats', { signal }),
    get: (id: string, signal?: AbortSignal) =>
      http.get<CustomerDto>(`/customers/${id}`, { signal }),
    /** Update mutable fields (block/unblock, balance adjustment). */
    update: (id: string, body: UpdateCustomerRequest) =>
      http.patch<CustomerDto>(`/customers/${id}`, body),
    /** Admin credit a customer's balance. */
    topupBalance: (id: string, body: TopupBalanceRequest) =>
      http.post<{ newBalance: number }>(`/customers/${id}/balance`, body),
    /** Balance transaction history for a customer. */
    balanceHistory: (id: string, signal?: AbortSignal) =>
      http.get<{ items: BalanceTransactionDto[] }>(`/customers/${id}/balance/history`, { signal }),
  },

  payments: {
    list: (query?: ListQuery, signal?: AbortSignal) =>
      http.get<Paginated<PaymentDto>>('/payments', { query, signal }),
    getByOrder: (orderId: string, signal?: AbortSignal) =>
      http.get<PaymentDto>(`/payments/${orderId}`, { signal }),
    createTransaction: (body: CreateTransactionRequest) =>
      http.post<PaymentDto>('/payments', body),
    stats: (signal?: AbortSignal) =>
      http.get<{ totalTopupPaid: number; totalTopupCount: number }>('/payments/stats', { signal }),
  },

  executions: {
    list: (query?: ExecutionListQuery, signal?: AbortSignal) =>
      http.get<Paginated<ExecutionDto>>('/executions', { query, signal }),
    get: (id: string, signal?: AbortSignal) =>
      http.get<ExecutionDetailDto>(`/executions/${id}`, { signal }),
    /**
     * Send a live control command (pause/resume/retry/cancel/step).
     * The backend acknowledges with the number of subscribers the command
     * reached; the resulting state change arrives over the WS stream, so
     * callers should refetch the execution rather than trust a returned entity.
     */
    command: (id: string, body: ExecutionCommandRequest) =>
      http.post<{ delivered: number }>(`/executions/${id}/command`, body),
    /** Start an admin test run of a draft workflow; streams over the WS channel. */
    test: (body: RunTestRequest) => http.post<ExecutionDto>('/executions/test', body),
  },

  broadcast: {
    /** Broadcast history, newest first. Poll for live SENDING → COMPLETED progress. */
    list: (signal?: AbortSignal) => http.get<BroadcastDto[]>('/broadcast', { signal }),
    /** Queue a broadcast to every customer; returns the created record (status SENDING). */
    create: (body: CreateBroadcastRequest) => http.post<BroadcastDto>('/broadcast', body),
  },

  status: {
    /** System vitals for the status bar (worker liveness, queue depth, active executions). */
    get: (signal?: AbortSignal) => http.get<SystemStatus>('/status', { signal }),
  },

  logs: {
    deadLetter: (signal?: AbortSignal) =>
      http.get<{ items: DeadLetterJobDto[]; total: number }>('/logs/dead-letter', { signal }),
    retryJob: (queue: string, jobId: string) =>
      http.post<{ jobId: string; queue: string; status: string }>(
        `/logs/dead-letter/${queue}/${jobId}/retry`,
      ),
    audit: (query?: { page?: number; pageSize?: number }, signal?: AbortSignal) =>
      http.get<AuditPage>('/logs/audit', { query, signal }),
  },

  settings: {
    get: (signal?: AbortSignal) => http.get<SettingsDto>('/settings', { signal }),
    setupTotp: () => http.post<{ otpauthUri: string; secret: string }>('/settings/totp/setup'),
    enableTotp: (code: string) => http.post<AdminUserDto>('/settings/totp/enable', { code }),
    disableTotp: (code: string) => http.delete<AdminUserDto>('/settings/totp', { body: { code } }),
    updatePakasir: (body: PakasirConfigUpdate) =>
      http.put<PakasirConfigStatus>('/settings/pakasir', body),
  },
} as const;

/** System status response (GET /api/status). Mirrors the backend status route. */
export interface SystemStatus {
  worker: boolean;
  queueDepth: number;
  activeExecutions: number;
}

/** Dead-letter job entry (GET /api/logs/dead-letter). */
export interface DeadLetterJobDto {
  id: string;
  queue: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

/** Audit log entry (GET /api/logs/audit). */
export interface AuditEntry {
  id: string;
  adminEmail: string | null;
  action: string;
  target: string | null;
  meta: unknown;
  ts: string;
}
export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Settings config status (GET /api/settings). */
export interface PakasirConfigStatus {
  mode: 'production' | 'testing';
  baseUrl: string;
  slug: string;
  apiKeySet: boolean;
  webhookSecretSet: boolean;
}
export interface PakasirConfigUpdate {
  mode: 'production' | 'testing';
  baseUrl?: string;
  slug?: string;
  apiKey?: string;
  webhookSecret?: string;
}
export interface SettingsDto {
  host: string;
  port: number;
  secrets: {
    sessionSecretSet: boolean;
    encryptionKeySet: boolean;
    pakasirApiKeySet: boolean;
    pakasirWebhookSecretSet: boolean;
    telegramConfigured: boolean;
  };
  pakasir: PakasirConfigStatus;
}

export type Api = typeof api;
