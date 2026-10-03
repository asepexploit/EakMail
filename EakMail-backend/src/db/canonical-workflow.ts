/**
 * The canonical demo workflow graph (TASKS.md Phase 4 DoD):
 *
 *   START → SEND_COMMAND '/beli' → WAIT_RESPONSE → MATCH_TEXT → CLICK_BUTTON
 *         → WAIT_RESPONSE → EXTRACT_DATA → DELIVER_TO_CUSTOMER
 *
 * It is valid against the workflow validator and runs end-to-end against the deterministic
 * MockSessionManager, which scripts:
 *   /beli                → "Silakan pilih produk. Tekan tombol di bawah untuk membeli."
 *                          with an inline button "Beli Sekarang"
 *   click "Beli Sekarang" → "Email: user<n>@mail.com Pass: pw<n>"
 *
 * Notes on shape:
 *  - DELIVER_TO_CUSTOMER is itself a success terminal, so it (not a separate SUCCESS node)
 *    ends the happy path — SUCCESS/DELIVER are both terminals with no output ports, so they
 *    cannot be chained. FAIL nodes catch the timeout/no-match ports (refund path).
 */
import { NodeType, type WorkflowGraph } from '@eakmail/shared-types';

/** Regex whose named groups (email/password) the mock's credential message satisfies. */
export const CREDENTIAL_REGEX = 'Email:\\s*(?<email>\\S+)\\s+Pass:\\s*(?<password>\\S+)';

export function canonicalWorkflowGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: 'start', type: NodeType.START, config: {}, position: { x: 0, y: 0 } },
      {
        id: 'send',
        type: NodeType.SEND_COMMAND,
        config: { command: '/beli' },
        position: { x: 220, y: 0 },
      },
      {
        id: 'wait_menu',
        type: NodeType.WAIT_RESPONSE,
        config: { mode: 'contains', pattern: 'pilih produk', timeoutMs: 15000 },
        position: { x: 440, y: 0 },
      },
      {
        id: 'match_menu',
        type: NodeType.MATCH_TEXT,
        config: { mode: 'contains', pattern: 'pilih produk', source: 'lastMessage' },
        position: { x: 660, y: 0 },
      },
      {
        id: 'click_buy',
        type: NodeType.CLICK_BUTTON,
        config: { strategy: 'label', value: 'Beli Sekarang', messageRef: 'latest' },
        position: { x: 880, y: 0 },
      },
      {
        id: 'wait_credentials',
        type: NodeType.WAIT_RESPONSE,
        config: { mode: 'contains', pattern: 'Email', timeoutMs: 15000 },
        position: { x: 1100, y: 0 },
      },
      {
        id: 'extract',
        type: NodeType.EXTRACT_DATA,
        config: { regex: CREDENTIAL_REGEX, source: 'lastMessage' },
        position: { x: 1320, y: 0 },
      },
      {
        id: 'deliver',
        type: NodeType.DELIVER_TO_CUSTOMER,
        config: { template: 'Akun kamu:\nEmail: {{email}}\nPassword: {{password}}' },
        position: { x: 1540, y: 0 },
      },
      // Failure sinks for the unhappy ports (kept reachable so validation passes).
      {
        id: 'fail_menu',
        type: NodeType.FAIL,
        config: { reason: 'Supplier did not present a product menu', refund: true },
        position: { x: 660, y: 200 },
      },
      {
        id: 'fail_click',
        type: NodeType.FAIL,
        config: { reason: 'Buy button not found', refund: true },
        position: { x: 880, y: 200 },
      },
      {
        id: 'fail_credentials',
        type: NodeType.FAIL,
        config: { reason: 'Supplier did not return account credentials', refund: true },
        position: { x: 1100, y: 200 },
      },
      {
        id: 'fail_extract',
        type: NodeType.FAIL,
        config: { reason: 'Could not extract account from supplier message', refund: true },
        position: { x: 1320, y: 200 },
      },
    ],
    edges: [
      { id: 'e_start_send', from: 'start', fromPort: 'next', to: 'send' },
      { id: 'e_send_wait', from: 'send', fromPort: 'next', to: 'wait_menu' },
      { id: 'e_wait_match', from: 'wait_menu', fromPort: 'received', to: 'match_menu' },
      { id: 'e_wait_failmenu', from: 'wait_menu', fromPort: 'timeout', to: 'fail_menu' },
      { id: 'e_match_click', from: 'match_menu', fromPort: 'matched', to: 'click_buy' },
      { id: 'e_match_failmenu', from: 'match_menu', fromPort: 'no-match', to: 'fail_menu' },
      { id: 'e_click_wait2', from: 'click_buy', fromPort: 'clicked', to: 'wait_credentials' },
      { id: 'e_click_fail', from: 'click_buy', fromPort: 'not-found', to: 'fail_click' },
      {
        id: 'e_wait2_extract',
        from: 'wait_credentials',
        fromPort: 'received',
        to: 'extract',
      },
      {
        id: 'e_wait2_fail',
        from: 'wait_credentials',
        fromPort: 'timeout',
        to: 'fail_credentials',
      },
      { id: 'e_extract_deliver', from: 'extract', fromPort: 'extracted', to: 'deliver' },
      { id: 'e_extract_fail', from: 'extract', fromPort: 'no-match', to: 'fail_extract' },
    ],
  };
}
