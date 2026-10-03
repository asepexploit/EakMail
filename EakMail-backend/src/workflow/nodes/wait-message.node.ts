/**
 * WAIT_MESSAGE: wait for the next message from the supplier (optionally from a given peer).
 * Follows `received` on a message, `timeout` if none arrives within timeoutMs.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import type { IncomingMessage } from '../../telegram/session-manager/types.js';
import { WorkflowError } from '../../lib/errors.js';

const DEFAULT_WAIT_MS = 30_000;

export class WaitMessageNode implements NodeExecutor<'WAIT_MESSAGE'> {
  readonly type = 'WAIT_MESSAGE' as const;

  async execute(node: WorkflowNode<'WAIT_MESSAGE'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for WAIT_MESSAGE', node.id);
    }
    const timeoutMs = node.config.timeoutMs ?? DEFAULT_WAIT_MS;
    const fromPeer = node.config.fromPeer ? ctx.render(node.config.fromPeer) : undefined;
    const predicate = (msg: IncomingMessage): boolean =>
      fromPeer ? msg.peer === fromPeer : true;

    const message = await ctx.conversation.waitForMessage(predicate, timeoutMs);
    if (message == null) {
      ctx.emitter.log('warn', 'WAIT_MESSAGE timed out');
      return { outPort: 'timeout', output: { timeoutMs } };
    }
    ctx.emitter.messageReceived(node.id, message.text);
    return { outPort: 'received', output: { text: message.text } };
  }
}
