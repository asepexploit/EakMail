/**
 * A live GramJS-backed conversation to one supplier bot via one user account.
 * ARCHITECTURE.md §4.2. Implements the frozen TelegramConversation seam.
 *
 * Message plumbing: GramJS pushes NewMessage updates; we buffer incoming
 * messages from `peer` and let waitForMessage() resolve against the buffer or a
 * future update. sendMessage / clickButton go out through the client with
 * per-account pacing and FLOOD_WAIT handling applied by the caller (manager).
 */
import type {
  ButtonSelector,
  IncomingButton,
  IncomingMessage,
  MessagePredicate,
  TelegramConversation,
} from './types.js';
import { AccountPacer, parseFloodWaitSeconds, sleep } from './pacing.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'telegram-conversation' });

/** Structural view of the GramJS client methods we depend on. */
export interface GramjsClientLike {
  sendMessage(peer: string, params: { message: string }): Promise<GramjsRawMessage>;
  invoke(request: unknown): Promise<unknown>;
  addEventHandler(handler: (event: unknown) => void, builder: unknown): void;
  removeEventHandler(handler: (event: unknown) => void, builder: unknown): void;
}

/** Just the fields we read off a GramJS message object. */
export interface GramjsRawMessage {
  id: number;
  message?: string;
  date?: number;
  replyMarkup?: {
    rows?: Array<{ buttons?: Array<{ text?: string; data?: Buffer }> }>;
  };
}

/** Callbacks the manager provides so the conversation can build API requests. */
export interface ConversationDeps {
  peer: string;
  client: GramjsClientLike;
  pacer: AccountPacer;
  /** Build a NewMessage event-handler builder scoped to this peer. */
  newMessageBuilder: unknown;
  /** Build a MessageEdited event-handler builder scoped to this peer (optional). */
  messageEditedBuilder?: unknown;
  /** Invoke GetBotCallbackAnswer for an inline button click. */
  clickInlineButton(messageId: number, data: Buffer): Promise<GramjsRawMessage | null>;
  /** Report a FLOOD_WAIT so the manager can update account health. */
  onFloodWait(seconds: number): void;
}

const DEFAULT_WAIT_POLL_MS = 100;
/** After clicking a button, how long to wait for the bot's resulting message. */
const POST_CLICK_WAIT_MS = 8000;

export class GramjsConversation implements TelegramConversation {
  private readonly buffer: IncomingMessage[] = [];
  /** Messages consumed by waitForMessage — kept so CLICK_BUTTON can still find their buttons. */
  private readonly consumed: IncomingMessage[] = [];
  private last: IncomingMessage | null = null;
  private readonly handler = (event: unknown): void => this.onNewMessage(event);
  private readonly editHandler = (event: unknown): void => this.onMessageEdited(event);
  private closed = false;

  constructor(private readonly deps: ConversationDeps) {
    this.deps.client.addEventHandler(this.handler, this.deps.newMessageBuilder);
    if (this.deps.messageEditedBuilder) {
      this.deps.client.addEventHandler(this.editHandler, this.deps.messageEditedBuilder);
    }
  }

  async sendMessage(text: string): Promise<IncomingMessage | null> {
    await this.deps.pacer.pace();
    try {
      const raw = await this.deps.client.sendMessage(this.deps.peer, { message: text });
      // Our own outgoing message; we do not surface it as an incoming reply.
      log.debug({ peer: this.deps.peer, id: raw.id }, 'message sent');
      return null;
    } catch (error) {
      this.handleFlood(error);
      throw error;
    }
  }

  async waitForMessage(
    predicate: MessagePredicate,
    timeoutMs: number,
  ): Promise<IncomingMessage | null> {
    const deadline = Date.now() + timeoutMs;
    // Drain anything already buffered first.
    const buffered = this.takeMatching(predicate);
    if (buffered) return buffered;

    while (Date.now() < deadline && !this.closed) {
      await sleep(DEFAULT_WAIT_POLL_MS);
      const match = this.takeMatching(predicate);
      if (match) return match;
    }
    return null;
  }

  async clickButton(selector: ButtonSelector): Promise<IncomingMessage | null> {
    log.debug(
      {
        strategy: selector.strategy,
        value: selector.value,
        bufferSize: this.buffer.length,
        lastId: this.last?.id,
        lastButtons: this.last?.buttons.length,
      },
      'clickButton called',
    );
    const target = this.resolveButtonTarget(selector);
    if (!target) {
      log.debug('resolveButtonTarget returned null — no matching button found');
      return null;
    }
    log.debug({ targetMsgId: target.messageId }, 'button target resolved');

    const snapshotText = this.last?.text;
    const snapshotId = this.last?.id;

    await this.deps.pacer.pace();
    try {
      const direct = await this.deps.clickInlineButton(target.messageId, target.data);
      if (direct) {
        const msg = toIncoming(direct, this.deps.peer);
        this.last = msg;
        return msg;
      }
      // Wait for any change: a new message (id > target) OR an edit on the clicked
      // message (same id, different text/buttons). Bots that use inline keyboards
      // typically edit the existing message rather than sending a new one.
      return await this.waitForChange(target.messageId, snapshotId, snapshotText);
    } catch (error) {
      this.handleFlood(error);
      throw error;
    }
  }

  /**
   * Wait for a response after a button click. Detects both:
   * - A new message (id > clickedMessageId) — standard bot reply.
   * - An edit on the clicked message (same id, different text) — inline menu navigation.
   */
  private async waitForChange(
    clickedMessageId: number,
    snapshotId: number | undefined,
    snapshotText: string | undefined,
  ): Promise<IncomingMessage | null> {
    const deadline = Date.now() + POST_CLICK_WAIT_MS;

    while (Date.now() < deadline && !this.closed) {
      // Check for a new message first (newest wins so we pick the latest bot reply).
      const newer = this.buffer
        .filter((m) => m.id > clickedMessageId)
        .sort((a, b) => b.id - a.id)[0];
      if (newer) {
        this.last = newer;
        return newer;
      }

      // Check if the clicked message was edited (text or buttons changed).
      if (snapshotId != null) {
        const edited =
          this.buffer.find((m) => m.id === snapshotId && m.text !== snapshotText) ??
          (this.last?.id === snapshotId && this.last.text !== snapshotText ? this.last : null);
        if (edited) return edited;
      }

      // Check if this.last changed at all (covers edge cases).
      if (this.last && (this.last.id !== snapshotId || this.last.text !== snapshotText)) {
        return this.last;
      }

      await sleep(DEFAULT_WAIT_POLL_MS);
    }

    // Final check after timeout.
    const finalNewer = this.buffer
      .filter((m) => m.id > clickedMessageId)
      .sort((a, b) => b.id - a.id)[0];
    if (finalNewer) { this.last = finalNewer; return finalNewer; }
    if (this.last && this.last.id !== snapshotId) return this.last;
    if (this.last && this.last.text !== snapshotText) return this.last;
    return null;
  }

  lastMessage(): IncomingMessage | null {
    return this.last;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.deps.client.removeEventHandler(this.handler, this.deps.newMessageBuilder);
    if (this.deps.messageEditedBuilder) {
      this.deps.client.removeEventHandler(this.editHandler, this.deps.messageEditedBuilder);
    }
    this.buffer.length = 0;
    this.consumed.length = 0;
  }

  // ---- internals -------------------------------------------------------------

  private onNewMessage(event: unknown): void {
    const raw = extractMessage(event);
    if (!raw) return;
    const msg = toIncoming(raw, this.deps.peer);
    log.debug(
      { peer: this.deps.peer, msgId: msg.id, buttons: msg.buttons.length, textSnippet: msg.text.slice(0, 80) },
      'new message received',
    );
    this.last = msg;
    this.buffer.push(msg);
  }

  private onMessageEdited(event: unknown): void {
    const raw = extractMessage(event);
    if (!raw) return;
    const updated = toIncoming(raw, this.deps.peer);
    log.debug(
      { peer: this.deps.peer, msgId: updated.id, buttons: updated.buttons.length, textSnippet: updated.text.slice(0, 80) },
      'message edited',
    );

    const replaceIn = (list: IncomingMessage[]): boolean => {
      const idx = list.findIndex((m) => m.id === updated.id);
      if (idx !== -1) { list[idx] = updated; return true; }
      return false;
    };

    const replaced = replaceIn(this.buffer) || replaceIn(this.consumed);
    if (!replaced) {
      this.buffer.push(updated);
    }
    this.last = updated;
  }

  private takeMatching(predicate: MessagePredicate): IncomingMessage | null {
    const index = this.buffer.findIndex((m) => predicate(m));
    if (index === -1) return null;
    const [match] = this.buffer.splice(index, 1);
    if (match) this.consumed.push(match);
    return match ?? null;
  }

  /**
   * Find the button + owning message that a selector points at.
   *
   * When a specific messageId is given, we try that message first. Otherwise we
   * scan all known messages (last + buffer, newest first) for a matching button.
   * This makes the node robust against timing issues where WAIT_RESPONSE consumed
   * the message from the buffer but `this.last` already moved forward.
   */
  private resolveButtonTarget(
    selector: ButtonSelector,
  ): { messageId: number; data: Buffer } | null {
    if (selector.messageId) {
      const source =
        (this.last?.id === selector.messageId ? this.last : null) ??
        this.buffer.find((m) => m.id === selector.messageId);
      if (source) {
        const button = pickButton(source.buttons, selector);
        if (button?.data) {
          return { messageId: source.id, data: Buffer.from(button.data, 'base64') };
        }
      }
    }

    // Fallback: scan all known messages (newest first) for any matching button.
    // Include consumed messages — WAIT_RESPONSE may have spliced the button-bearing
    // message before CLICK_BUTTON runs.
    // IMPORTANT: always prefer `this.last` over any stale copy in buffer/consumed with
    // the same id — edits update `this.last` in place but may leave an older copy in
    // consumed with a different button set.
    const candidates = [...this.buffer, ...this.consumed]
      .filter((m) => !this.last || m.id !== this.last.id)  // drop stale copies of last
      .sort((a, b) => b.id - a.id);
    if (this.last) candidates.unshift(this.last);

    for (const msg of candidates) {
      const button = pickButton(msg.buttons, selector);
      if (button?.data) {
        return { messageId: msg.id, data: Buffer.from(button.data, 'base64') };
      }
    }
    return null;
  }

  private handleFlood(error: unknown): void {
    const seconds = parseFloodWaitSeconds(error);
    if (seconds !== null) {
      log.warn({ peer: this.deps.peer, seconds }, 'FLOOD_WAIT received');
      this.deps.onFloodWait(seconds);
    }
  }
}

// ---- pure helpers ------------------------------------------------------------

function pickButton(buttons: IncomingButton[], selector: ButtonSelector): IncomingButton | null {
  switch (selector.strategy) {
    case 'label':
      return buttons.find((b) => b.text === selector.value) ?? null;
    case 'regex': {
      const re = new RegExp(selector.value);
      return buttons.find((b) => re.test(b.text)) ?? null;
    }
    case 'index': {
      const idx = Number(selector.value);
      return buttons[idx] ?? null;
    }
    case 'position': {
      const [row, col] = selector.value.split(',').map(Number);
      return buttons.find((b) => b.row === row && b.col === col) ?? null;
    }
    default:
      return null;
  }
}

function toIncoming(raw: GramjsRawMessage, peer: string): IncomingMessage {
  return {
    id: raw.id,
    peer,
    text: raw.message ?? '',
    buttons: extractButtons(raw),
    date: (raw.date ?? 0) * 1000,
  };
}

function extractButtons(raw: GramjsRawMessage): IncomingButton[] {
  const rows = raw.replyMarkup?.rows ?? [];
  const out: IncomingButton[] = [];
  rows.forEach((row, rowIndex) => {
    (row.buttons ?? []).forEach((btn, colIndex) => {
      out.push({
        text: btn.text ?? '',
        row: rowIndex,
        col: colIndex,
        // Callback data is bytes on the wire; carry it as base64 for the selector.
        data: btn.data ? Buffer.from(btn.data).toString('base64') : undefined,
      });
    });
  });
  return out;
}

/** Pull the raw message off a GramJS NewMessage event. */
function extractMessage(event: unknown): GramjsRawMessage | null {
  const message = (event as { message?: GramjsRawMessage })?.message;
  if (!message || typeof message.id !== 'number') return null;
  return message;
}
