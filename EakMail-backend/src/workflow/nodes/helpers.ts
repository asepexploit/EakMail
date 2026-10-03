/**
 * Shared helpers for node executors: abort-aware delays, per-node retry wrapping,
 * and text-match evaluation. Keeps each node file focused on its own behavior.
 */
import type { RetryPolicy, TextMatchMode } from '@eakmail/shared-types';

/** Thrown when the execution AbortSignal fires mid-node. */
export class AbortedError extends Error {
  constructor() {
    super('Execution aborted');
    this.name = 'AbortedError';
  }
}

/** Reject immediately if the signal is already aborted. */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AbortedError();
}

/** Sleep for `ms`, resolving early (rejecting) if the signal aborts. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Compute the delay before attempt N (1-based) given a retry policy. */
export function backoffDelay(policy: RetryPolicy, attempt: number): number {
  if (policy.backoff === 'exponential') {
    return policy.delayMs * Math.pow(2, Math.max(0, attempt - 1));
  }
  return policy.delayMs;
}

/**
 * Run `fn`, retrying up to `policy.maxAttempts` times when it throws (never retrying an
 * AbortedError). Returns the last successful value, or rethrows the final error.
 */
export async function withRetry<T>(
  policy: RetryPolicy | undefined,
  signal: AbortSignal,
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  const maxAttempts = policy?.maxAttempts ?? 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(signal);
    try {
      return await fn(attempt);
    } catch (err) {
      if (err instanceof AbortedError) throw err;
      lastError = err;
      if (attempt < maxAttempts && policy) {
        await delay(backoffDelay(policy, attempt), signal);
      }
    }
  }
  throw lastError;
}

/** Evaluate whether `text` satisfies a text match. */
export function matchText(
  text: string,
  mode: TextMatchMode,
  pattern: string,
  caseSensitive = false,
): boolean {
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? pattern : pattern.toLowerCase();
  switch (mode) {
    case 'equals':
      return haystack === needle;
    case 'contains':
      return haystack.includes(needle);
    case 'regex':
      try {
        return new RegExp(pattern, caseSensitive ? '' : 'i').test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}
