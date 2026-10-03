/**
 * Typed API error thrown by the fetch client. The backend's central error handler
 * (ARCHITECTURE.md §5) returns a JSON body { error: { code, message } } on failure;
 * this class surfaces that shape to callers so features can branch on `code`.
 */

/** Machine-readable error codes the backend may return. Kept as a loose union so a
 *  new backend code never breaks the client at runtime. */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'NETWORK'
  | (string & {});

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(params: { code: ApiErrorCode; message: string; status: number; details?: unknown }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  get isNetwork(): boolean {
    return this.code === 'NETWORK';
  }
}
