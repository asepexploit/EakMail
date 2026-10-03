/**
 * Unit tests for the two node executors that drive the Telegram conversation seam:
 * CLICK_BUTTON (label / regex / index selectors) and WAIT_RESPONSE (received vs timeout).
 * They run against the production MockSessionManager (USE_MOCKS path), so no live network.
 */
import '../_env.js';
import { describe, it, expect } from 'vitest';
import type { WorkflowNode } from '@eakmail/shared-types';
import type { TelegramConversation } from '../../../src/telegram/session-manager/types.js';
import { makeContext } from '../../support/node-context.js';
import { MockSessionManager } from '../../../src/telegram/session-manager/mock-session-manager.js';
import { MockConversation } from '../../../src/workflow/testing/mock-conversation.js';
import { ClickButtonNode } from '../../../src/workflow/nodes/click-button.node.js';
import { WaitResponseNode } from '../../../src/workflow/nodes/wait-response.node.js';
import { WorkflowError } from '../../../src/lib/errors.js';

/** Open a mock conversation that has already surfaced the "Beli Sekarang" menu. */
async function menuConversation(): Promise<TelegramConversation> {
  const convo = await new MockSessionManager().openConversation('acc-1', '@supplierbot');
  await convo.sendMessage('/beli');
  // Drain the menu into lastMessage so CLICK_BUTTON has a keyboard to act on.
  await convo.waitForMessage((m) => m.buttons.length > 0, 1000);
  return convo;
}

describe('CLICK_BUTTON node', () => {
  const executor = new ClickButtonNode();

  it('clicks by label and follows clicked, emitting the reply', async () => {
    const conversation = await menuConversation();
    const { ctx, emitter } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'c', type: 'CLICK_BUTTON', config: { strategy: 'label', value: 'Beli Sekarang' }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('clicked');
    expect(emitter.received.at(-1)?.text).toMatch(/^Email: user\d+@mail\.com Pass: pw\d+$/);
    await conversation.close();
  });

  it('clicks by regex', async () => {
    const conversation = await menuConversation();
    const { ctx } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'c', type: 'CLICK_BUTTON', config: { strategy: 'regex', value: 'Beli.*' }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('clicked');
    await conversation.close();
  });

  it('clicks by index', async () => {
    const conversation = await menuConversation();
    const { ctx } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'c', type: 'CLICK_BUTTON', config: { strategy: 'index', value: '0' }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('clicked');
    await conversation.close();
  });

  it('follows not-found and warns when no button matches', async () => {
    const conversation = await menuConversation();
    const { ctx, emitter } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'c', type: 'CLICK_BUTTON', config: { strategy: 'label', value: 'Tidak Ada' }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('not-found');
    expect(emitter.logs.some((l) => l.level === 'warn')).toBe(true);
    await conversation.close();
  });

  it('throws when there is no conversation', async () => {
    const { ctx } = makeContext({ conversation: null });
    await expect(
      executor.execute(
        { id: 'c', type: 'CLICK_BUTTON', config: { strategy: 'label', value: 'x' }, position: { x: 0, y: 0 } },
        ctx,
      ),
    ).rejects.toBeInstanceOf(WorkflowError);
  });
});

describe('WAIT_RESPONSE node', () => {
  const executor = new WaitResponseNode();

  it('follows received when a matching message arrives', async () => {
    // Scripted conversation: a send yields a reply containing "akun".
    const conversation = new MockConversation([[{ text: 'Ini akun kamu' }]]);
    await conversation.sendMessage('/beli');
    const { ctx, emitter } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'w', type: 'WAIT_RESPONSE', config: { mode: 'contains', pattern: 'akun', timeoutMs: 1000 }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('received');
    expect((result.output as { text: string }).text).toBe('Ini akun kamu');
    expect(emitter.received.at(-1)?.text).toBe('Ini akun kamu');
    await conversation.close();
  });

  it('follows timeout and warns when nothing matches', async () => {
    const conversation = new MockConversation([[{ text: 'Maaf, tidak ada' }]]);
    await conversation.sendMessage('/beli');
    const { ctx, emitter } = makeContext({ conversation });
    const result = await executor.execute(
      { id: 'w', type: 'WAIT_RESPONSE', config: { mode: 'contains', pattern: 'akun', timeoutMs: 10 }, position: { x: 0, y: 0 } },
      ctx,
    );
    expect(result.outPort).toBe('timeout');
    expect(emitter.logs.some((l) => l.level === 'warn')).toBe(true);
    await conversation.close();
  });

  it('throws when there is no conversation', async () => {
    const { ctx } = makeContext({ conversation: null });
    await expect(
      executor.execute(
        { id: 'w', type: 'WAIT_RESPONSE', config: { mode: 'contains', pattern: 'x' }, position: { x: 0, y: 0 } },
        ctx,
      ),
    ).rejects.toBeInstanceOf(WorkflowError);
  });
});
