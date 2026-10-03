/**
 * Node executor registry — maps each NodeType to its executor instance (NO switch).
 * `getExecutor(type)` is the single lookup the interpreter uses.
 * When a new node type is added, register it here (see .claude/instructions/adding-a-node.md).
 */
import type { NodeType } from '@eakmail/shared-types';
import { WorkflowError } from '../lib/errors.js';
import type { NodeExecutor } from './engine/node-executor.js';

import { StartNode } from './nodes/start.node.js';
import { SendMessageNode } from './nodes/send-message.node.js';
import { SendCommandNode } from './nodes/send-command.node.js';
import { ClickButtonNode } from './nodes/click-button.node.js';
import { WaitMessageNode } from './nodes/wait-message.node.js';
import { WaitResponseNode } from './nodes/wait-response.node.js';
import { WaitButtonNode } from './nodes/wait-button.node.js';
import { DelayNode } from './nodes/delay.node.js';
import { MatchTextNode } from './nodes/match-text.node.js';
import { ConditionNode } from './nodes/condition.node.js';
import { SwitchNode } from './nodes/switch.node.js';
import { ExtractDataNode } from './nodes/extract-data.node.js';
import { SetVariableNode } from './nodes/set-variable.node.js';
import { TransformNode } from './nodes/transform.node.js';
import { RetryNode } from './nodes/retry.node.js';
import { TimeoutNode } from './nodes/timeout.node.js';
import { LoopNode } from './nodes/loop.node.js';
import { SuccessNode } from './nodes/success.node.js';
import { FailNode } from './nodes/fail.node.js';
import { DeliverToCustomerNode } from './nodes/deliver-to-customer.node.js';
import { ApiOrderNode } from './nodes/api-order.node.js';

/** Immutable registry of one executor per node type. */
const REGISTRY: { [K in NodeType]: NodeExecutor<K> } = {
  API_ORDER: new ApiOrderNode(),
  START: new StartNode(),
  SEND_MESSAGE: new SendMessageNode(),
  SEND_COMMAND: new SendCommandNode(),
  CLICK_BUTTON: new ClickButtonNode(),
  WAIT_MESSAGE: new WaitMessageNode(),
  WAIT_RESPONSE: new WaitResponseNode(),
  WAIT_BUTTON: new WaitButtonNode(),
  DELAY: new DelayNode(),
  MATCH_TEXT: new MatchTextNode(),
  CONDITION: new ConditionNode(),
  SWITCH: new SwitchNode(),
  EXTRACT_DATA: new ExtractDataNode(),
  SET_VARIABLE: new SetVariableNode(),
  TRANSFORM: new TransformNode(),
  RETRY: new RetryNode(),
  TIMEOUT: new TimeoutNode(),
  LOOP: new LoopNode(),
  SUCCESS: new SuccessNode(),
  FAIL: new FailNode(),
  DELIVER_TO_CUSTOMER: new DeliverToCustomerNode(),
};

/** Look up the executor for a node type. Throws if the type is unknown. */
export function getExecutor<T extends NodeType>(type: T): NodeExecutor<T> {
  const executor = REGISTRY[type];
  if (!executor) {
    throw new WorkflowError(`No executor registered for node type: ${type}`);
  }
  return executor;
}
