/**
 * Real MTProto Session Manager (GramJS). ARCHITECTURE.md §4.2, TASKS Phase 3b.
 *
 * Responsibilities:
 *   - Maintain a pool of connected user-account clients (load + decrypt sessions).
 *   - Open per-supplier conversations bound to an account.
 *   - Per-account pacing + FLOOD_WAIT handling, persisting account health to DB.
 *   - Expose the login lifecycle (delegated to LoginFlow) for the account service.
 *
 * GramJS is imported dynamically so the whole module graph still compiles and
 * boots when config.USE_MOCKS is true (the factory then returns the mock and
 * never instantiates this class live).
 */
import { AccountStatus } from '@eakmail/shared-types';
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import type { TelegramConversation, TelegramSessionManager } from './types.js';
import { AccountPacer, parseFloodWaitSeconds, sleep } from './pacing.js';
import {
  GramjsConversation,
  type ConversationDeps,
  type GramjsClientLike,
  type GramjsRawMessage,
} from './gramjs-conversation.js';
import { LoginFlow } from './login-flow.js';

const log = logger.child({ module: 'telegram-session-manager' });

interface PooledClient {
  client: GramjsClientLike;
  pacer: AccountPacer;
}

export class GramjsSessionManager implements TelegramSessionManager {
  readonly isMock = false;
  readonly login = new LoginFlow();

  private readonly pool = new Map<string, PooledClient>();

  async openConversation(accountId: string, peer: string): Promise<TelegramConversation> {
    const pooled = await this.ensureClient(accountId);
    const { NewMessage, EditedMessage } = await loadGramjs();

    const deps: ConversationDeps = {
      peer,
      client: pooled.client,
      pacer: pooled.pacer,
      newMessageBuilder: new NewMessage({ chats: [peer], incoming: true }),
      messageEditedBuilder: EditedMessage
        ? new EditedMessage({ chats: [peer] })
        : undefined,
      clickInlineButton: (messageId, data) =>
        this.invokeCallback(pooled.client, peer, messageId, data),
      onFloodWait: (seconds) => {
        void this.markFloodWait(accountId, seconds);
      },
    };
    return new GramjsConversation(deps);
  }

  /** Connect (or reuse) a client for an account, decrypting its stored session. */
  private async ensureClient(accountId: string): Promise<PooledClient> {
    const existing = this.pool.get(accountId);
    if (existing) return existing;

    const account = await prisma.telegramAccount.findUnique({ where: { id: accountId } });
    if (!account?.sessionEnc) {
      throw new Error(`Account ${accountId} has no session; log in first`);
    }

    const { TelegramClient, StringSession } = await loadGramjs();
    const sessionString = decrypt(account.sessionEnc);
    const client = new TelegramClient(
      new StringSession(sessionString),
      config.TELEGRAM_API_ID,
      config.TELEGRAM_API_HASH,
      { connectionRetries: 5, autoReconnect: true },
    ) as unknown as GramjsClientLike & { connect(): Promise<boolean> };

    await client.connect();
    const pooled: PooledClient = { client, pacer: new AccountPacer() };
    this.pool.set(accountId, pooled);
    await this.setStatus(accountId, AccountStatus.CONNECTED);
    log.info({ accountId }, 'account client connected');
    return pooled;
  }

  /** Perform a bot inline-button click and return the resulting/edited message. */
  private async invokeCallback(
    client: GramjsClientLike,
    peer: string,
    messageId: number,
    data: Buffer,
  ): Promise<GramjsRawMessage | null> {
    const { Api } = await loadGramjs();
    try {
      await client.invoke(
        new Api.messages.GetBotCallbackAnswer({
          peer,
          msgId: messageId,
          data,
        }),
      );
    } catch (error) {
      const seconds = parseFloodWaitSeconds(error);
      if (seconds !== null) await sleep(seconds * 1000);
      else throw error;
    }
    // The bot's answer arrives as a new/edited message picked up by the event
    // handler; the conversation resolves it via waitForMessage, so return null.
    return null;
  }

  private async markFloodWait(accountId: string, seconds: number): Promise<void> {
    await this.setStatus(accountId, AccountStatus.FLOOD_WAIT);
    log.warn({ accountId, seconds }, 'account in FLOOD_WAIT');
    await sleep(seconds * 1000);
    await this.setStatus(accountId, AccountStatus.CONNECTED);
  }

  private async setStatus(accountId: string, status: AccountStatus): Promise<void> {
    await prisma.telegramAccount
      .update({
        where: { id: accountId },
        data: { status, lastActivityAt: new Date() },
      })
      .catch((error) => log.error({ accountId, error }, 'failed to persist account status'));
  }

  /** Disconnect all pooled clients (graceful shutdown). */
  async shutdown(): Promise<void> {
    for (const [accountId, pooled] of this.pool) {
      await (pooled.client as unknown as { disconnect(): Promise<void> })
        .disconnect()
        .catch(() => undefined);
      this.pool.delete(accountId);
    }
  }
}

// ---- Lazy GramJS loader ------------------------------------------------------

interface GramjsBundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GramJS Api namespace is dynamic
  Api: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- constructor from GramJS
  TelegramClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- constructor from GramJS
  StringSession: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- events namespace from GramJS
  NewMessage: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- events namespace from GramJS (separate file)
  EditedMessage: any;
}

let bundle: GramjsBundle | null = null;

async function loadGramjs(): Promise<GramjsBundle> {
  if (bundle) return bundle;
  const tg = await import('telegram');
  const sessions = await import('telegram/sessions');
  const events = await import('telegram/events');
  const editedEvents = await import('telegram/events/EditedMessage.js');
  bundle = {
    Api: (tg as { Api: unknown }).Api,
    TelegramClient: (tg as { TelegramClient: unknown }).TelegramClient,
    StringSession: (sessions as { StringSession: unknown }).StringSession,
    NewMessage: (events as { NewMessage: unknown }).NewMessage,
    EditedMessage: (editedEvents as { EditedMessage: unknown }).EditedMessage,
  } as GramjsBundle;
  return bundle;
}
