/**
 * The low-level HTTP transport for the dashboard. One place that knows how to talk
 * to the backend REST API: base URL, credentials, JSON encoding, and error mapping.
 * Feature code never calls fetch directly — it goes through `api` in ./api.ts.
 */
import { ApiError, type ApiErrorCode } from './api-error.js';

/** All backend routes are mounted under /api and proxied by Vite in dev (vite.config.ts). */
const BASE_URL = '/api';

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions {
  /** Query string parameters; arrays repeat the key. */
  query?: QueryParams;
  /** JSON request body; serialized automatically. */
  body?: unknown;
  /** Abort signal for cancellation (wired by TanStack Query). */
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) search.append(key, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL' : 'VALIDATION';
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = statusToCode(response.status);
  let message = response.statusText || 'Request failed';
  let details: unknown;
  try {
    const data = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      message?: string;
    };
    if (data.error) {
      if (data.error.code) code = data.error.code;
      if (data.error.message) message = data.error.message;
      details = data.error.details;
    } else if (data.message) {
      message = data.message;
    }
  } catch {
    // Non-JSON error body; keep the status-derived defaults.
  }
  return new ApiError({ code, message, status: response.status, details });
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: 'include',
      signal: options.signal,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    // fetch only rejects on network failure / abort.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({
      code: 'NETWORK',
      message: 'Tidak dapat terhubung ke server.',
      status: 0,
      details: cause,
    });
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
