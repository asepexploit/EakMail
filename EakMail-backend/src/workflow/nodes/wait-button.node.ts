/**
 * WAIT_BUTTON: wait for the next message that carries an inline keyboard.
 * Follows `received` when a message with buttons arrives, `timeout` otherwise.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import type { IncomingMessage } from '../../telegram/session-manager/types.js';
import { WorkflowError } from '../../lib/errors.js';

const DEFAULT_WAIT_MS = 30_000;

export class WaitButtonNode implements NodeExecutor<'WAIT_BUTTON'> {
  readonly type = 'WAIT_BUTTON' as const;

  async execute(node: WorkflowNode<'WAIT_BUTTON'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for WAIT_BUTTON', node.id);
    }
    const timeoutMs = node.config.timeoutMs ?? DEFAULT_WAIT_MS;
    const predicate = (msg: IncomingMessage): boolean => msg.buttons.length > 0;

    const message = await ctx.conversation.waitForMessage(predicate, timeoutMs);
    if (message == null) {
      ctx.emitter.log('warn', 'WAIT_BUTTON timed out');
      return { outPort: 'timeout', output: { timeoutMs } };
    }
    ctx.emitter.messageReceived(node.id, message.text);
    return {
      outPort: 'received',
      output: { text: message.text, buttonCount: message.buttons.length },
    };
  }
}
