/**
 * Minimal async rate limiter: caps calls to `maxPerSecond` (Pakasir allows 2 req/s).
 * Serializes acquisitions so bursts are spaced by a fixed minimum interval.
 * ARCHITECTURE.md §8 (rate limit: 2 req/s).
 */
export class RateLimiter {
  private readonly minIntervalMs: number;
  private queue: Promise<void> = Promise.resolve();
  private lastRunAt = 0;

  constructor(maxPerSecond: number) {
    if (maxPerSecond <= 0) throw new Error('maxPerSecond must be > 0');
    this.minIntervalMs = 1000 / maxPerSecond;
  }

  /** Resolves when the caller is cleared to proceed under the rate cap. */
  async acquire(): Promise<void> {
    const wait = this.queue.then(() => this.throttle());
    // Swallow rejection on the chain so one failed waiter cannot poison the queue.
    this.queue = wait.catch(() => undefined);
    return wait;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const earliest = this.lastRunAt + this.minIntervalMs;
    if (now < earliest) {
      await delay(earliest - now);
    }
    this.lastRunAt = Date.now();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
