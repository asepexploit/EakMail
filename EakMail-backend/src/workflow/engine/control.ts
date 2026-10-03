/**
 * Redis-backed ExecutionControl: subscribes to the per-execution command channel and
 * translates ExecutionCommand messages (PAUSE/RESUME/CANCEL/STEP) into interpreter
 * control decisions (BLUEPRINT.md §10.3). Also aborts the run's AbortController on CANCEL.
 *
 * A dedicated subscriber connection is required (ioredis cannot subscribe on a shared conn).
 */
import type { Redis } from 'ioredis';
import { ExecutionCommand } from '@eakmail/shared-types';
import { executionCommandChannel } from '../../lib/redis.js';
import type { ControlDecision, ExecutionControl } from './interpreter.js';

export class RedisExecutionControl implements ExecutionControl {
  private paused = false;
  private cancelled = false;
  private stepRequested = false;
  /** Resolver for a pending `awaitResume` promise. */
  private resumeResolver: ((d: ControlDecision) => void) | null = null;

  constructor(
    private readonly subscriber: Redis,
    private readonly executionId: string,
    private readonly abort: AbortController,
  ) {}

  /** Subscribe to the command channel and start reacting to messages. */
  async start(): Promise<void> {
    const channel = executionCommandChannel(this.executionId);
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, message) => {
      if (ch !== channel) return;
      this.handleCommand(message);
    });
  }

  /** Stop listening and release the subscription. */
  async stop(): Promise<void> {
    try {
      await this.subscriber.unsubscribe(executionCommandChannel(this.executionId));
    } catch {
      /* best-effort */
    }
  }

  async check(_nextNodeId: string): Promise<ControlDecision> {
    if (this.cancelled) return 'cancel';
    if (this.paused) return 'pause';
    if (this.stepRequested) {
      this.stepRequested = false;
      this.paused = true; // step once, then pause again
      return 'step';
    }
    return 'continue';
  }

  awaitResume(): Promise<ControlDecision> {
    if (this.cancelled) return Promise.resolve('cancel');
    if (!this.paused) return Promise.resolve('continue');
    return new Promise<ControlDecision>((resolve) => {
      this.resumeResolver = resolve;
    });
  }

  private handleCommand(raw: string): void {
    const command = this.parse(raw);
    switch (command) {
      case ExecutionCommand.PAUSE:
        this.paused = true;
        break;
      case ExecutionCommand.RESUME:
        this.paused = false;
        this.resolveResume('continue');
        break;
      case ExecutionCommand.STEP:
        this.stepRequested = true;
        this.paused = false;
        this.resolveResume('step');
        break;
      case ExecutionCommand.CANCEL:
        this.cancelled = true;
        this.paused = false;
        this.resolveResume('cancel');
        this.abort.abort();
        break;
      default:
        break;
    }
  }

  private resolveResume(decision: ControlDecision): void {
    if (this.resumeResolver) {
      const resolve = this.resumeResolver;
      this.resumeResolver = null;
      resolve(decision);
    }
  }

  /** Accept either a bare command string or a JSON `{ command }` envelope. */
  private parse(raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'command' in parsed) {
        return String((parsed as { command: unknown }).command);
      }
    } catch {
      /* not JSON — treat as bare */
    }
    return raw.trim();
  }
}
