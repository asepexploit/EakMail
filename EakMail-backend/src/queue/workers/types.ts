/**
 * Shared worker construction types. Each worker exposes a `build*Worker(deps)` factory so
 * startup can inject per-account concurrency and a rate limiter without the worker files
 * importing config directly (keeps them unit-testable). ARCHITECTURE.md §7.
 */

/** BullMQ limiter: at most `max` jobs per `duration` ms across the worker. */
export interface WorkerLimiter {
  max: number;
  duration: number;
}

export interface WorkerBuildDeps {
  /** Parallel jobs this worker processes at once. */
  concurrency?: number;
  /** Optional throughput cap (e.g. to respect provider or Telegram pacing). */
  limiter?: WorkerLimiter;
}
