/**
 * Resolves everything an order needs to be fulfilled: the workflow graph, the Telegram
 * account to drive it, the supplier bot peer, and the initial variable bag. Kept out of the
 * worker so the worker stays a thin orchestrator (BLUEPRINT.md §5.1 step 6, §9 mapping).
 */
import type { WorkflowGraph } from '@eakmail/shared-types';
import { WorkflowError } from '../../lib/errors.js';
import type { OrderFulfillmentContext } from '../../modules/orders/order.repository.js';

/** The concrete, validated inputs the engine run needs. */
export interface ResolvedFulfillment {
  workflowId: string;
  graph: WorkflowGraph;
  /** Telegram user-account id used to open the conversation. */
  accountId: string;
  /** Supplier bot @username (the conversation peer). */
  peer: string;
  /** Customer chat id for the final delivery send. */
  customerTelegramId: string;
  /** Seed variables (order + product + customer context) merged with graph defaults. */
  variables: Record<string, unknown>;
}

/**
 * Map an order to its fulfillment inputs. The workflow is the product's explicit workflow,
 * else the supplier's default. The account is the first account bound to the supplier.
 * Throws WorkflowError with a clear reason when the mapping is incomplete so the worker can
 * fail the order (→ refund path) rather than crash opaquely.
 */
export function resolveFulfillment(order: OrderFulfillmentContext): ResolvedFulfillment {
  const product = order.product;
  const supplier = product.supplier;

  const workflow = product.workflow ?? supplier?.defaultWorkflow ?? null;
  if (!workflow) {
    throw new WorkflowError('No workflow configured for this product or its supplier');
  }
  if (!workflow.isActive) {
    throw new WorkflowError(`Workflow "${workflow.name}" is not active`);
  }

  if (!supplier) {
    throw new WorkflowError('Product has no supplier — cannot open a bot conversation');
  }
  const accountId = supplier.accounts[0]?.accountId;
  if (!accountId) {
    throw new WorkflowError(`Supplier "${supplier.name}" has no bound Telegram account`);
  }

  const graph = workflow.graph as unknown as WorkflowGraph;

  return {
    workflowId: workflow.id,
    graph,
    accountId,
    peer: supplier.botUsername,
    customerTelegramId: order.customer.telegramId,
    variables: buildVariables(order, graph),
  };
}

/** Merge graph-declared defaults with the runtime order/product/customer context. */
function buildVariables(
  order: OrderFulfillmentContext,
  graph: WorkflowGraph,
): Record<string, unknown> {
  return {
    ...(graph.variables ?? {}),
    orderId: order.id,
    quantity: order.quantity,
    amount: order.amount,
    productId: order.productId,
    productName: order.product.name,
    productSku: order.product.sku ?? '',
    customerTelegramId: order.customer.telegramId,
    language: order.customer.language,
    // Selected product option — available as {{optionKey}} and {{optionValue}} in templates.
    optionKey: order.optionKey ?? '',
    optionValue: order.optionValue ?? '',
  };
}
