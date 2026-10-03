/**
 * Telegram client contract used by the Workflow Engine to drive supplier bots.
 * FROZEN seam between the engine, the real GramJS Session Manager, and the mock.
 * The engine depends ONLY on this interface (never on GramJS directly).
 * ARCHITECTURE.md §4.2.
 */

export interface IncomingButton {
  text: string;
  row: number;
  col: number;
  data?: string;
}

export interface IncomingMessage {
  id: number;
  peer: string;
  text: string;
  buttons: IncomingButton[];
  /** Milliseconds since epoch. */
  date: number;
}

export type MessagePredicate = (msg: IncomingMessage) => boolean;

export interface ButtonSelector {
  strategy: 'label' | 'regex' | 'index' | 'position';
  value: string;
  messageId?: number;
}

/**
 * A per-execution handle bound to one supplier peer via one user account.
 * Obtained from TelegramSessionManager.openConversation().
 */
export interface TelegramConversation {
  /** Send text/command to the supplier bot. */
  sendMessage(text: string): Promise<IncomingMessage | null>;
  /** Wait for the next message matching the predicate, or timeout. */
  waitForMessage(predicate: MessagePredicate, timeoutMs: number): Promise<IncomingMessage | null>;
  /** Click an inline button on a received message; returns the resulting message if any. */
  clickButton(selector: ButtonSelector): Promise<IncomingMessage | null>;
  /** The most recently received message (for MATCH/EXTRACT source: lastMessage). */
  lastMessage(): IncomingMessage | null;
  /** Release resources. */
  close(): Promise<void>;
}

export interface TelegramSessionManager {
  /** Open a conversation to `peer` (supplier @username) using account `accountId`. */
  openConversation(accountId: string, peer: string): Promise<TelegramConversation>;
  /** True when running against the mock (build/CI, USE_MOCKS=true). */
  readonly isMock: boolean;
}
