import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionCommand, PaymentMethod } from '@eakmail/shared-types';
import { api } from './api.js';
import { ApiError } from './api-error.js';

/**
 * Request-shaping tests: we mock global fetch and assert the method, URL (with the
 * /api base and query encoding) and JSON body the client produces match the DTO
 * contract, and that non-2xx / network failures surface as a typed ApiError.
 */

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string> | undefined;
  body: unknown;
  credentials: string | undefined;
}

let calls: CapturedRequest[] = [];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetchOnce(response: Response | (() => Promise<Response>)): void {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: init?.headers as Record<string, string> | undefined,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      credentials: init?.credentials,
    });
    return typeof response === 'function' ? response() : response;
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET requests', () => {
  it('auth.me issues a credentialed GET to /api/auth/me with no body', async () => {
    mockFetchOnce(jsonResponse({ id: 'u1', email: 'a@b.c', role: 'admin', totpEnabled: false }));
    const me = await api.auth.me();
    expect(me).toMatchObject({ id: 'u1' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe('/api/auth/me');
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].credentials).toBe('include');
  });

  it('encodes list query params onto the URL', async () => {
    mockFetchOnce(jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 }));
    await api.orders.list({ page: 2, pageSize: 50, status: 'PAID', search: 'abc' });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/orders');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('50');
    expect(url.searchParams.get('status')).toBe('PAID');
    expect(url.searchParams.get('search')).toBe('abc');
  });

  it('omits undefined/null query params', async () => {
    mockFetchOnce(jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 }));
    await api.suppliers.list({ page: 1, search: undefined });
    const url = new URL(calls[0].url, 'http://x');
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.get('page')).toBe('1');
  });

  it('interpolates path params for a single-resource GET', async () => {
    mockFetchOnce(jsonResponse({ id: 'wf-9' }));
    await api.workflows.get('wf-9');
    expect(calls[0].url).toBe('/api/workflows/wf-9');
    expect(calls[0].method).toBe('GET');
  });
});

describe('mutating requests', () => {
  it('auth.login POSTs the LoginRequest body as JSON with the content-type header', async () => {
    mockFetchOnce(jsonResponse({ user: { id: 'u1' } }));
    await api.auth.login({ email: 'admin@eakmail.dev', password: 'secret', totp: '123456' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/api/auth/login');
    expect(calls[0].body).toEqual({
      email: 'admin@eakmail.dev',
      password: 'secret',
      totp: '123456',
    });
    expect(calls[0].headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('payments.createTransaction POSTs the CreateTransactionRequest contract', async () => {
    mockFetchOnce(jsonResponse({ id: 'pay-1' }));
    await api.payments.createTransaction({ orderId: 'ord-1', method: PaymentMethod.QRIS });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/api/payments');
    expect(calls[0].body).toEqual({ orderId: 'ord-1', method: 'qris' });
  });

  it('executions.command POSTs to the nested command path with the command body', async () => {
    mockFetchOnce(jsonResponse({ delivered: 3 }));
    const res = await api.executions.command('exec-1', { command: ExecutionCommand.PAUSE });
    expect(res).toEqual({ delivered: 3 });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/api/executions/exec-1/command');
    expect(calls[0].body).toEqual({ command: 'PAUSE' });
  });

  it('products.setActive PATCHes the active flag', async () => {
    mockFetchOnce(jsonResponse({ id: 'p1', active: false }));
    await api.products.setActive('p1', false);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe('/api/products/p1/active');
    expect(calls[0].body).toEqual({ active: false });
  });

  it('suppliers.remove issues a DELETE with no body', async () => {
    mockFetchOnce(new Response(null, { status: 204 }));
    await api.suppliers.remove('sup-7');
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe('/api/suppliers/sup-7');
    expect(calls[0].body).toBeUndefined();
  });

  it('workflows.rollback POSTs the target version', async () => {
    mockFetchOnce(jsonResponse({ id: 'wf-1', version: 4 }));
    await api.workflows.rollback('wf-1', 4);
    expect(calls[0].url).toBe('/api/workflows/wf-1/rollback');
    expect(calls[0].body).toEqual({ version: 4 });
  });
});

describe('response handling', () => {
  it('returns undefined for a 204 No Content response', async () => {
    mockFetchOnce(new Response(null, { status: 204 }));
    const out = await api.auth.logout();
    expect(out).toBeUndefined();
  });
});

describe('error mapping', () => {
  it('throws a typed ApiError carrying the backend error code + message', async () => {
    mockFetchOnce(
      jsonResponse({ error: { code: 'VALIDATION', message: 'Email tidak valid' } }, 422),
    );
    await expect(api.auth.login({ email: 'x', password: 'y' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'VALIDATION',
      status: 422,
      message: 'Email tidak valid',
    });
  });

  it('maps a bare 401 to an unauthorized ApiError', async () => {
    mockFetchOnce(new Response('nope', { status: 401 }));
    let caught: unknown;
    try {
      await api.auth.me();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).isUnauthorized).toBe(true);
    expect((caught as ApiError).status).toBe(401);
  });

  it('wraps a fetch network rejection as a NETWORK ApiError', async () => {
    mockFetchOnce(() => Promise.reject(new TypeError('failed to fetch')));
    let caught: unknown;
    try {
      await api.accounts.list();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).isNetwork).toBe(true);
    expect((caught as ApiError).status).toBe(0);
  });
});
