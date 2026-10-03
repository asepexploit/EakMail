/**
 * Per-account human-like pacing (ARCHITECTURE.md §4.2, TASKS Phase 3b).
 * Deterministic jitter derived from a monotonically increasing counter — never
 * Math.random — so behavior is reproducible and testable while still varying
 * between consecutive sends to avoid a robotic fixed cadence.
 */

const BASE_DELAY_MS = 800;
/** Jitter spread on top of the base delay. */
const JITTER_SPAN_MS = 1200;

/**
 * Tracks a send counter per account and yields a delay to wait before the next
 * action. The delay walks a small deterministic sequence within [base, base+span).
 */
export class AccountPacer {
  private counter = 0;

  /** Milliseconds to wait before the next action for this account. */
  nextDelayMs(): number {
    this.counter += 1;
    // A simple deterministic pseudo-jitter: LCG-style step, bounded to the span.
    const step = (this.counter * 2654435761) % JITTER_SPAN_MS;
    return BASE_DELAY_MS + step;
  }

  async pace(): Promise<void> {
    await sleep(this.nextDelayMs());
  }

  reset(): void {
    this.counter = 0;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the seconds Telegram asks us to wait from a FLOOD_WAIT_X error.
 * Returns null when the error is not a flood-wait.
 */
export function parseFloodWaitSeconds(error: unknown): number | null {
  const err = error as { errorMessage?: string; seconds?: number } | undefined;
  if (!err) return null;
  if (typeof err.seconds === 'number' && err.errorMessage?.includes('FLOOD_WAIT')) {
    return err.seconds;
  }
  const message = err.errorMessage ?? (error instanceof Error ? error.message : '');
  const match = /FLOOD_WAIT_(\d+)/.exec(message);
  return match?.[1] ? Number(match[1]) : null;
}
