/**
 * API Supplier service — HTTP client wrapper for external REST API suppliers.
 * Handles authentication, product sync, and order placement.
 * Secrets (apiKey) are decrypted on the fly; never logged or returned.
 *
 * Supported supplier API formats (auto-detected from response shape):
 *   - Abel Store: X-API-Key header, /products → {products:[{id,stock}]}, /order → {delivered_items:[]}
 *   - Canboso:    x-buyer-key header, /api/v2/telegram-buyer/products → {products:[{productId,availability}]},
 *                 /api/v2/telegram-buyer/purchase → {delivery:{accounts:[{user,password}]}}
 */
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { randomUUID } from 'crypto';
import type { ApiSupplierProduct } from '@eakmail/shared-types';

const log = logger.child({ module: 'api-supplier' });

export interface ApiSupplierConfig {
  baseUrl: string;
  apiKeyEnc: string;
  authHeader?: string | null;
}

export interface ApiOrderResult {
  orderId: string | number;
  payload: string;
  raw: unknown;
}

export interface ApiProfileResult {
  name: string;
  balance: number;
  accountType: string;
}

// ---- Internal format detection ------------------------------------------------

type SupplierFormat = 'abel' | 'canboso' | 'generic';

/**
 * Detect which known supplier API format the base URL points to.
 * Canboso uses a fixed path prefix that is absent from other APIs.
 */
function detectFormat(baseUrl: string): SupplierFormat {
  if (baseUrl.includes('canboso.com')) return 'canboso';
  return 'generic'; // default — Abel Store-compatible
}

// ---- Helpers ------------------------------------------------------------------

/** Decrypt the stored key and return the plain-text value. */
function resolveKey(config: ApiSupplierConfig): string {
  try {
    return decrypt(config.apiKeyEnc);
  } catch {
    throw new Error('Failed to decrypt API key — re-save the supplier to fix this.');
  }
}

function authHeaders(config: ApiSupplierConfig, extra?: Record<string, string>): Record<string, string> {
  const format = detectFormat(config.baseUrl);
  // Canboso uses x-buyer-key; others default to X-API-Key unless overridden.
  const defaultHeader = format === 'canboso' ? 'x-buyer-key' : 'X-API-Key';
  const headerName = config.authHeader?.trim() || defaultHeader;
  return {
    [headerName]: resolveKey(config),
    'Content-Type': 'application/json',
    ...extra,
  };
}

function base(config: ApiSupplierConfig): string {
  return config.baseUrl.replace(/\/$/, '');
}

/** Resolve the correct products listing URL for the supplier format. */
function productsUrl(config: ApiSupplierConfig): string {
  const format = detectFormat(config.baseUrl);
  if (format === 'canboso') return `${base(config)}/api/v2/telegram-buyer/products`;
  return `${base(config)}/products`;
}

// ---- Canboso response types ---------------------------------------------------

interface CanbosoPurchaseResponse {
  success: boolean;
  lang?: string;
  order?: {
    orderCode: string;
    status: string;
    productId: string;
    productName: string;
    productType: string;
    quantity: number;
    finalQuantity: number;
    fulfillmentStatus?: string;
  };
  payment?: {
    amount: number;
    currency: string;
    balance: number;
  };
  delivery?: {
    accounts?: Array<{
      user: string;
      password: string;
      verifyEmail?: string | null;
      expiryText?: string | null;
      otherInfo?: string | null;
    }>;
  };
  message?: string;
}

// ---- Public API ---------------------------------------------------------------

/** Fetch products from the external supplier API. */
export async function fetchApiProducts(
  config: ApiSupplierConfig,
): Promise<{ products: ApiSupplierProduct[]; balance: number }> {
  const url = productsUrl(config);
  const format = detectFormat(config.baseUrl);
  const res = await fetch(url, { headers: authHeaders(config) });
  if (!res.ok) throw new Error(`API supplier /products returned ${res.status}`);

  const data = await res.json() as Record<string, unknown>;

  if (format === 'canboso') {
    // Canboso: { products: [{ productId, name, description, availability: { available, sold }, price: { amount, currency } }] }
    type CanbosoProd = {
      productId: string;
      name: string;
      description?: string;
      emoji?: string;
      productType?: string;
      price?: { amount?: number; currency?: string };
      availability?: { available?: number | null; sold?: number };
      promotions?: unknown[];
    };
    const raw = (data['products'] ?? []) as CanbosoProd[];
    const products: ApiSupplierProduct[] = raw.map((p) => ({
      externalId: p.productId,
      name: p.name,
      category: p.productType ?? 'account',
      basePrice: p.price?.amount ?? 0,
      currency: p.price?.currency ?? 'USD',
      stock: p.availability?.available ?? -1,
      description: p.description ?? '',
    }));
    return { products, balance: 0 };
  }

  // Abel Store / generic: { products: [{ id, name, category, base_price, stock }] }
  type AbelProd = { id: number; name: string; category: string; base_price: number; stock: number; description?: string };
  const raw = (data['products'] ?? []) as AbelProd[];
  const products: ApiSupplierProduct[] = raw.map((p) => ({
    externalId: p.id,
    name: p.name,
    category: p.category,
    basePrice: p.base_price,
    stock: p.stock,
    description: p.description ?? '',
  }));
  return { products, balance: 0 };
}

/** Get reseller profile (name + token balance). */
export async function fetchApiProfile(
  config: ApiSupplierConfig,
): Promise<ApiProfileResult> {
  const format = detectFormat(config.baseUrl);

  if (format === 'canboso') {
    const url = `${base(config)}/api/v2/telegram-buyer/balance`;
    const res = await fetch(url, { headers: authHeaders(config) });
    if (!res.ok) throw new Error(`Canboso /balance returned ${res.status}`);
    const data = await res.json() as { wallet?: { spendable?: number; name?: string } };
    return {
      name: data.wallet?.name ?? 'Canboso Buyer',
      balance: data.wallet?.spendable ?? 0,
      accountType: 'buyer',
    };
  }

  // Abel Store / generic
  const url = `${base(config)}/profile`;
  const res = await fetch(url, { headers: authHeaders(config) });
  if (!res.ok) throw new Error(`API supplier /profile returned ${res.status}`);
  const data = await res.json() as {
    ok: boolean;
    profile: { name: string; balance: number; account_type: string };
  };
  return {
    name: data.profile.name,
    balance: data.profile.balance,
    accountType: data.profile.account_type,
  };
}

/**
 * Check the available stock for a single product from the API.
 * Returns the stock count, or -1 if the product is not found / stock unknown.
 * Used before placing an order so we can fail fast instead of wasting the supplier's balance.
 */
export async function checkApiStock(
  config: ApiSupplierConfig,
  productId: string | number,
): Promise<number> {
  const url = productsUrl(config);
  const format = detectFormat(config.baseUrl);
  const res = await fetch(url, { headers: authHeaders(config) });
  if (!res.ok) throw new Error(`API supplier /products returned ${res.status}`);
  const data = await res.json() as Record<string, unknown>;

  if (format === 'canboso') {
    type CanbosoProd = { productId: string; availability?: { available?: number | null } };
    const products = (data['products'] ?? []) as CanbosoProd[];
    const product = products.find((p) => p.productId === String(productId));
    if (!product) return -1;
    const available = product.availability?.available;
    return available === null || available === undefined ? -1 : available;
  }

  // Abel Store / generic
  type AbelProd = { id: number; stock: number };
  const products = (data['products'] ?? []) as AbelProd[];
  const product = products.find((p) => p.id === Number(productId));
  return product ? product.stock : -1;
}

/**
 * Place an order via the external API. Returns the payload (voucher/account)
 * that should be delivered to the customer.
 */
export async function placeApiOrder(
  config: ApiSupplierConfig,
  productId: string | number,
  quantity: number,
): Promise<ApiOrderResult> {
  const format = detectFormat(config.baseUrl);

  if (format === 'canboso') {
    return placeCanbosoPurchase(config, String(productId), quantity);
  }

  return placeAbelOrder(config, productId, quantity);
}

// ---- Format-specific order placement -----------------------------------------

async function placeCanbosoPurchase(
  config: ApiSupplierConfig,
  productId: string,
  quantity: number,
): Promise<ApiOrderResult> {
  const url = `${base(config)}/api/v2/telegram-buyer/purchase`;
  const idempotencyKey = randomUUID();
  const body = JSON.stringify({ key: resolveKey(config), product_id: productId, quantity });
  log.info({ url, productId, quantity }, 'placing Canboso purchase');

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config, { 'Idempotency-Key': idempotencyKey }),
    body,
  });

  const raw = await res.json() as CanbosoPurchaseResponse;
  if (!res.ok || raw.success === false) {
    const msg = raw.message ?? `HTTP ${res.status}`;
    throw new Error(`Canboso purchase failed: ${msg}`);
  }

  const orderId = raw.order?.orderCode ?? 'unknown';

  // Slot/upgrade orders may not have immediate delivery — fulfillmentStatus is 'invited' etc.
  if (raw.order?.fulfillmentStatus && !raw.delivery?.accounts?.length) {
    return {
      orderId,
      payload: `Pesanan ${raw.order.productName} sedang diproses (${raw.order.fulfillmentStatus}). Order code: ${orderId}`,
      raw,
    };
  }

  const accounts = raw.delivery?.accounts ?? [];
  if (accounts.length === 0) {
    throw new Error('Canboso purchase succeeded but delivery contains no accounts');
  }

  // Render each account as "user|password[ |verifyEmail][ |otherInfo]"
  const lines = accounts.map((a) => {
    const parts = [a.user, a.password];
    if (a.verifyEmail) parts.push(a.verifyEmail);
    if (a.otherInfo) parts.push(a.otherInfo);
    return parts.join('|');
  });

  return { orderId, payload: lines.join('\n'), raw };
}

async function placeAbelOrder(
  config: ApiSupplierConfig,
  productId: string | number,
  quantity: number,
): Promise<ApiOrderResult> {
  const url = `${base(config)}/order`;
  const body = JSON.stringify({ product_id: Number(productId), quantity });
  log.info({ url, productId, quantity }, 'placing API supplier order');

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body,
  });

  const raw = await res.json() as Record<string, unknown>;
  if (!res.ok || raw['ok'] === false) {
    const msg = (raw['message'] as string) ?? `HTTP ${res.status}`;
    throw new Error(`API supplier order failed: ${msg}`);
  }

  // Abel Store format: { delivered_items: ['email|pass', ...] }
  const deliveredItems = raw['delivered_items'] as string[] | undefined;
  if (deliveredItems && deliveredItems.length > 0) {
    const orderId = (raw['order_id'] ?? 'unknown') as string | number;
    return { orderId, payload: deliveredItems.join('\n'), raw };
  }

  // Generic fallback
  const order = (raw['order'] ?? raw['data'] ?? raw) as Record<string, unknown>;
  const voucher =
    (order['voucher'] as string) ??
    (order['payload'] as string) ??
    (order['account'] as string) ??
    (order['content'] as string) ??
    JSON.stringify(order);

  const orderId = (order['id'] ?? raw['order_id'] ?? 'unknown') as string | number;
  return { orderId, payload: voucher, raw };
}
