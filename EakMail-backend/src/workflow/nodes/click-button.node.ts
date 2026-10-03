/**
 * CLICK_BUTTON: click an inline keyboard button on a received message.
 * Follows `clicked` when the button exists and is pressed, `not-found` otherwise.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import type { ButtonSelector, IncomingMessage } from '../../telegram/session-manager/types.js';
import { WorkflowError } from '../../lib/errors.js';
import { withRetry } from './helpers.js';

export class ClickButtonNode implements NodeExecutor<'CLICK_BUTTON'> {
  readonly type = 'CLICK_BUTTON' as const;

  async execute(node: WorkflowNode<'CLICK_BUTTON'>, ctx: ExecutionContext): Promise<NodeResult> {
    if (!ctx.conversation) {
      throw new WorkflowError('No Telegram conversation available for CLICK_BUTTON', node.id);
    }
    const value = ctx.render(node.config.value);
    const messageId = this.resolveMessageId(node.config.messageRef, ctx.conversation.lastMessage());
    const selector: ButtonSelector = {
      strategy: node.config.strategy,
      value,
      ...(messageId != null ? { messageId } : {}),
    };

    let result: IncomingMessage | null;
    try {
      result = await withRetry(node.config.retry, ctx.signal, async () =>
        ctx.conversation!.clickButton(selector),
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('DATA_INVALID') || msg.includes('BOT_RESPONSE_TIMEOUT')) {
        ctx.emitter.log('warn', `Button click rejected by Telegram: ${msg}`);
        return { outPort: 'not-found', output: { selector, error: msg } };
      }
      throw error;
    }

    if (result == null) {
      ctx.emitter.log('warn', `Button not found: ${node.config.strategy}=${value}`);
      return { outPort: 'not-found', output: { selector } };
    }
    ctx.emitter.messageReceived(node.id, result.text);
    return { outPort: 'clicked', output: { selector, resultText: result.text } };
  }

  private resolveMessageId(
    ref: WorkflowNode<'CLICK_BUTTON'>['config']['messageRef'],
    last: IncomingMessage | null,
  ): number | undefined {
    if (ref === 'matched' || ref === 'latest') return last?.id;
    return undefined;
  }
}
