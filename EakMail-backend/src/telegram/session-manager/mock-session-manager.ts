/**
 * Deterministic in-memory Session Manager for build/CI and offline tests
 * (config.USE_MOCKS === true). ARCHITECTURE.md §4.2.
 *
 * It scripts a supplier bot so the workflow engine and its tests run end-to-end
 * without a live Telegram connection:
 *   - `/beli` -> a menu message carrying an inline button "Beli Sekarang".
 *   - clicking "Beli Sekarang" -> a message "Email: user{n}@mail.com Pass: pw{n}".
 *
 * Every value is derived from a per-peer counter (never Math.random / Date.now),
 * so the same script always produces the same output — tests can assert exactly.
 */
import type {
  ButtonSelector,
  IncomingButton,
  IncomingMessage,
  MessagePredicate,
  TelegramConversation,
  TelegramSessionManager,
} from './types.js';

/** Fixed epoch used for message timestamps so runs are reproducible. */
const DETERMINISTIC_EPOCH_MS = 1_700_000_000_000;

const BUY_COMMAND = '/beli';
const BUY_BUTTON_LABEL = 'Beli Sekarang';
const BUY_BUTTON_DATA = 'buy';

/** Stable per-peer counter so scripted values vary between suppliers, not randomly. */
function peerSeed(peer: string): number {
  let hash = 0;
  for (let i = 0; i < peer.length; i += 1) {
    hash = (hash * 31 + peer.charCodeAt(i)) % 100_000;
  }
  // Keep it a small positive integer; +1 so the first credential is user1, not user0.
  return (hash % 999) + 1;
}

class MockConversation implements TelegramConversation {
  private messageId = 0;
  private last: IncomingMessage | null = null;
  /** Queue of messages produced but not yet consumed by waitForMessage. */
  private readonly pending: IncomingMessage[] = [];

  constructor(
    private readonly peer: string,
    private readonly seed: number,
  ) {}

  private nextMessage(text: string, buttons: IncomingButton[]): IncomingMessage {
    this.messageId += 1;
    const msg: IncomingMessage = {
      id: this.messageId,
      peer: this.peer,
      text,
      buttons,
      // Advance deterministically per message instead of using the wall clock.
      date: DETERMINISTIC_EPOCH_MS + this.messageId * 1000,
    };
    this.last = msg;
    return msg;
  }

  private buyMenuMessage(): IncomingMessage {
    const button: IncomingButton = {
      text: BUY_BUTTON_LABEL,
      row: 0,
      col: 0,
      data: BUY_BUTTON_DATA,
    };
    return this.nextMessage(
      'Silakan pilih produk. Tekan tombol di bawah untuk membeli.',
      [button],
    );
  }

  private credentialMessage(): IncomingMessage {
    const n = this.seed;
    return this.nextMessage(`Email: user${n}@mail.com Pass: pw${n}`, []);
  }

  async sendMessage(text: string): Promise<IncomingMessage | null> {
    const trimmed = text.trim();
    if (trimmed === BUY_COMMAND || trimmed.startsWith(`${BUY_COMMAND} `)) {
      const reply = this.buyMenuMessage();
      this.pending.push(reply);
      return reply;
    }
    // Unknown commands get no scripted reply; the engine will time out waiting.
    return null;
  }

  async waitForMessage(
    predicate: MessagePredicate,
    _timeoutMs: number,
  ): Promise<IncomingMessage | null> {
    const index = this.pending.findIndex((m) => predicate(m));
    if (index === -1) return null;
    const [match] = this.pending.splice(index, 1);
    return match ?? null;
  }

  async clickButton(selector: ButtonSelector): Promise<IncomingMessage | null> {
    if (!this.matchesBuyButton(selector)) return null;
    const reply = this.credentialMessage();
    this.pending.push(reply);
    return reply;
  }

  private matchesBuyButton(selector: ButtonSelector): boolean {
    switch (selector.strategy) {
      case 'label':
        return selector.value === BUY_BUTTON_LABEL;
      case 'regex':
        return new RegExp(selector.value).test(BUY_BUTTON_LABEL);
      case 'index':
        return selector.value === '0';
      case 'position':
        return selector.value === '0,0';
      default:
        return false;
    }
  }

  lastMessage(): IncomingMessage | null {
    return this.last;
  }

  async close(): Promise<void> {
    this.pending.length = 0;
    this.last = null;
  }
}

/** Mock manager: hands out deterministic scripted conversations. */
export class MockSessionManager implements TelegramSessionManager {
  readonly isMock = true;

  async openConversation(accountId: string, peer: string): Promise<TelegramConversation> {
    // Derive the seed from both account and peer so different bindings vary.
    const seed = peerSeed(`${accountId}:${peer}`);
    return new MockConversation(peer, seed);
  }
}
