/**
 * WAIT_RESPONSE: wait for the next message whose text matches a pattern.
 * Follows `received` on a match, `timeout` otherwise.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import type { IncomingMessage } from '../../telegram/session-manager/types.js';
import { WorkflowError } from '../../lib/errors.js';
import { matchText } from './helpers.js';

const DEFAULT_WAIT_MS = 30_000;

export class WaitResponseNode implements NodeExecutor<'WAIT_RESPONSE'> {
  readonly type = 'WAIT_RESPONSE' as const;

  async execute(node: WorkflowNode<'WAIT_RESPONSE'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for WAIT_RESPONSE', node.id);
    }
    const timeoutMs = node.config.timeoutMs ?? DEFAULT_WAIT_MS;
    const pattern = ctx.render(node.config.pattern);
    const predicate = (msg: IncomingMessage): boolean =>
      matchText(msg.text, node.config.mode, pattern, node.config.caseSensitive);

    const message = await ctx.conversation.waitForMessage(predicate, timeoutMs);
    if (message == null) {
      ctx.emitter.log('warn', 'WAIT_RESPONSE timed out');
      return { outPort: 'timeout', output: { timeoutMs, pattern } };
    }
    ctx.emitter.messageReceived(node.id, message.text);
    return { outPort: 'received', output: { text: message.text } };
  }
}
