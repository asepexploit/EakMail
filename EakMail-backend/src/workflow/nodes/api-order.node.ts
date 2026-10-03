/**
 * API_ORDER: place an order via an external supplier REST API.
 * Does NOT need a Telegram conversation — purely HTTP. Routes to 'success' when
 * the order is placed and a payload is retrieved, or 'error' on failure.
 * The payload is stored in `resultVar` (default: apiPayload) for DELIVER_TO_CUSTOMER.
 */
import type { NodeExecutor, ExecutionContext, NodeResult } from '../engine/node-executor.js';
import type { WorkflowNode } from '@eakmail/shared-types';
import { WorkflowError } from '../../lib/errors.js';
import { placeApiOrder } from '../../modules/suppliers/api-supplier.service.js';
import { withRetry } from './helpers.js';

export class ApiOrderNode implements NodeExecutor<'API_ORDER'> {
  readonly type = 'API_ORDER' as const;

  async execute(
    node: WorkflowNode<'API_ORDER'>,
    ctx: ExecutionContext,
  ): Promise<NodeResult> {
    const cfg = node.config;

    // Resolve config — prefer node-level overrides, fall back to execution context supplier.
    const baseUrl = cfg.baseUrl?.trim() ? ctx.render(cfg.baseUrl) : ctx.apiSupplier?.baseUrl;
    const apiKeyEnc = ctx.apiSupplier?.apiKeyEnc;
    const authHeader = cfg.authHeader ?? ctx.apiSupplier?.authHeader ?? null;

    if (!baseUrl || !apiKeyEnc) {
      throw new WorkflowError(
        'API_ORDER node requires a supplier with API type configured (baseUrl + apiKey).',
        node.id,
      );
    }

    const productId = ctx.render(cfg.productId);
    const quantityRaw = cfg.quantity ? ctx.render(cfg.quantity) : String(ctx.variables['quantity'] ?? 1);
    const quantity = Math.max(1, parseInt(quantityRaw, 10) || 1);
    const resultVar = cfg.resultVar?.trim() || 'apiPayload';

    ctx.emitter.log('info', `API_ORDER: ordering product ${productId} × ${quantity}`);

    let result;
    try {
      result = await withRetry(cfg.retry, ctx.signal, () =>
        placeApiOrder({ baseUrl, apiKeyEnc, authHeader }, productId, quantity),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.emitter.log('error', `API_ORDER failed: ${msg}`);
      ctx.variables['apiError'] = msg;
      return { outPort: 'error', output: { error: msg } };
    }

    // Extract a sub-field when extractPath is configured (e.g. "voucher" or "data.code").
    let payload: string = result.payload;
    if (cfg.extractPath) {
      const parts = cfg.extractPath.split('.');
      let cursor: unknown = result.raw;
      for (const part of parts) {
        cursor = (cursor as Record<string, unknown>)?.[part];
      }
      if (cursor !== undefined && cursor !== null) {
        payload = String(cursor);
      }
    }

    ctx.variables[resultVar] = payload;
    ctx.variables['apiOrderId'] = String(result.orderId);
    ctx.emitter.variableSet(resultVar, payload);
    ctx.emitter.log('info', `API_ORDER: order ${result.orderId} placed, payload stored in {{${resultVar}}}`);

    return {
      outPort: 'success',
      output: { orderId: result.orderId, resultVar, payloadLength: payload.length },
    };
  }
}
