/** SEND_MESSAGE: render the text template and send it to the supplier bot. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { WorkflowError } from '../../lib/errors.js';
import { withRetry } from './helpers.js';

export class SendMessageNode implements NodeExecutor<'SEND_MESSAGE'> {
  readonly type = 'SEND_MESSAGE' as const;

  async execute(node: WorkflowNode<'SEND_MESSAGE'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for SEND_MESSAGE', node.id);
    }
    const text = ctx.render(node.config.text);
    await withRetry(node.config.retry, ctx.signal, async () => {
      await ctx.conversation!.sendMessage(text);
    });
    ctx.emitter.messageSent(node.id, text);
    return { outPort: 'next', output: { text } };
  }
}
