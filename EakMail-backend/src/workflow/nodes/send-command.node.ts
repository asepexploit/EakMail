/** SEND_COMMAND: send a bot command (e.g. `/beli`) with optional rendered args. */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { WorkflowError } from '../../lib/errors.js';
import { withRetry } from './helpers.js';

export class SendCommandNode implements NodeExecutor<'SEND_COMMAND'> {
  readonly type = 'SEND_COMMAND' as const;

  async execute(node: WorkflowNode<'SEND_COMMAND'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for SEND_COMMAND', node.id);
    }
    const command = ctx.render(node.config.command);
    const args = node.config.args ? ctx.render(node.config.args) : '';
    const text = args ? `${command} ${args}` : command;
    await withRetry(node.config.retry, ctx.signal, async () => {
      await ctx.conversation!.sendMessage(text);
    });
    ctx.emitter.messageSent(node.id, text);
    return { outPort: 'next', output: { command: text } };
  }
}
