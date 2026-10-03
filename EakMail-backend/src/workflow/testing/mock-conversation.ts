/**
 * A scripted in-memory TelegramConversation for engine tests and local end-to-end runs.
 * It never connects to Telegram; it replays a queue of pre-programmed supplier replies in
 * response to sends/clicks. Implements the frozen TelegramConversation seam only.
 *
 * This lives under the workflow area (engine scope) purely for testing the interpreter
 * against the mock path; the production mock/session-manager belongs to the telegram module.
 */
import type {
  ButtonSelector,
  IncomingButton,
  IncomingMessage,
  MessagePredicate,
  TelegramConversation,
} from '../../telegram/session-manager/types.js';

export interface ScriptedReply {
  text: string;
  buttons?: IncomingButton[];
  /** Simulated delay before this reply becomes available (ms). */
  afterMs?: number;
}

/**
 * Each supplier "turn" is a list of replies queued when the corresponding trigger fires.
 * The mock pops the next batch of replies on each send/click; waitForMessage drains them.
 */
export class MockConversation implements TelegramConversation {
  private incoming: IncomingMessage[] = [];
  private last: IncomingMessage | null = null;
  private nextId = 1;
  private turn = 0;

  /** `script[i]` = replies produced by the i-th send/click. */
  constructor(
    private readonly script: ScriptedReply[][] = [],
    private readonly peer = '@supplier_bot',
  ) {}

  async sendMessage(_text: string): Promise<IncomingMessage | null> {
    this.enqueueTurn();
    return null;
  }

  async clickButton(_selector: ButtonSelector): Promise<IncomingMessage | null> {
    // A click must resolve against an existing keyboard: fail if there is nothing to act on.
    if (this.last == null && this.incoming.length === 0) return null;
    // Queue the supplier's response to the click; it stays available for a following wait node.
    this.enqueueTurn();
    // Return a synthetic ack so the node follows `clicked` without consuming the queued reply.
    return this.last ?? this.incoming[0] ?? null;
  }

  async waitForMessage(
    predicate: MessagePredicate,
    _timeoutMs: number,
  ): Promise<IncomingMessage | null> {
    const idx = this.incoming.findIndex((m) => predicate(m));
    if (idx === -1) return null;
    const [msg] = this.incoming.splice(idx, 1);
    this.last = msg ?? this.last;
    return msg ?? null;
  }

  lastMessage(): IncomingMessage | null {
    return this.last;
  }

  async close(): Promise<void> {
    this.incoming = [];
  }

  /** Queue the replies scripted for the current turn. */
  private enqueueTurn(): void {
    const replies = this.script[this.turn++] ?? [];
    for (const reply of replies) {
      const msg: IncomingMessage = {
        id: this.nextId++,
        peer: this.peer,
        text: reply.text,
        buttons: reply.buttons ?? [],
        date: Date.now(),
      };
      this.incoming.push(msg);
    }
  }
}
