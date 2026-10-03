/**
 * Verifies the deterministic mock Session Manager drives the canonical supplier
 * script end-to-end offline: /beli -> menu with "Beli Sekarang" -> credentials.
 */
import { describe, expect, it } from 'vitest';
import { MockSessionManager } from '../../src/telegram/session-manager/mock-session-manager.js';

describe('MockSessionManager', () => {
  it('scripts /beli -> menu -> click -> credentials deterministically', async () => {
    const manager = new MockSessionManager();
    expect(manager.isMock).toBe(true);

    const convo = await manager.openConversation('acc-1', '@supplierbot');

    await convo.sendMessage('/beli');
    const menu = await convo.waitForMessage((m) => m.buttons.length > 0, 1000);
    expect(menu).not.toBeNull();
    expect(menu?.buttons[0]?.text).toBe('Beli Sekarang');

    const result = await convo.clickButton({ strategy: 'label', value: 'Beli Sekarang' });
    expect(result).not.toBeNull();
    expect(result?.text).toMatch(/^Email: user\d+@mail\.com Pass: pw\d+$/);

    // lastMessage reflects the credential message.
    expect(convo.lastMessage()?.text).toBe(result?.text);
    await convo.close();
  });

  it('is deterministic for the same account+peer', async () => {
    const manager = new MockSessionManager();
    const first = await run(manager);
    const second = await run(manager);
    expect(first).toBe(second);
  });

  it('varies credentials by peer', async () => {
    const manager = new MockSessionManager();
    const a = await run(manager, '@one');
    const b = await run(manager, '@two');
    expect(a).not.toBe(b);
  });
});

async function run(manager: MockSessionManager, peer = '@supplierbot'): Promise<string> {
  const convo = await manager.openConversation('acc-1', peer);
  await convo.sendMessage('/beli');
  await convo.waitForMessage((m) => m.buttons.length > 0, 1000);
  const res = await convo.clickButton({ strategy: 'label', value: 'Beli Sekarang' });
  await convo.close();
  return res?.text ?? '';
}
