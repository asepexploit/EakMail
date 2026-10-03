/**
 * React Flow `nodeTypes` registry — maps each domain node type to its visual component.
 * Keyed by the frozen NodeType strings so the canvas renders the correct custom node.
 */
import type { NodeTypes } from '@xyflow/react';
import { NodeType } from '@eakmail/shared-types';
import { StartNode } from './StartNode.js';
import { SendMessageNode } from './SendMessageNode.js';
import { SendCommandNode } from './SendCommandNode.js';
import { ClickButtonNode } from './ClickButtonNode.js';
import { WaitMessageNode } from './WaitMessageNode.js';
import { WaitResponseNode } from './WaitResponseNode.js';
import { WaitButtonNode } from './WaitButtonNode.js';
import { DelayNode } from './DelayNode.js';
import { MatchTextNode } from './MatchTextNode.js';
import { ConditionNode } from './ConditionNode.js';
import { SwitchNode } from './SwitchNode.js';
import { ExtractDataNode } from './ExtractDataNode.js';
import { SetVariableNode } from './SetVariableNode.js';
import { TransformNode } from './TransformNode.js';
import { RetryNode } from './RetryNode.js';
import { TimeoutNode } from './TimeoutNode.js';
import { LoopNode } from './LoopNode.js';
import { SuccessNode } from './SuccessNode.js';
import { FailNode } from './FailNode.js';
import { DeliverToCustomerNode } from './DeliverToCustomerNode.js';

export const nodeTypes: NodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.SEND_MESSAGE]: SendMessageNode,
  [NodeType.SEND_COMMAND]: SendCommandNode,
  [NodeType.CLICK_BUTTON]: ClickButtonNode,
  [NodeType.WAIT_MESSAGE]: WaitMessageNode,
  [NodeType.WAIT_RESPONSE]: WaitResponseNode,
  [NodeType.WAIT_BUTTON]: WaitButtonNode,
  [NodeType.DELAY]: DelayNode,
  [NodeType.MATCH_TEXT]: MatchTextNode,
  [NodeType.CONDITION]: ConditionNode,
  [NodeType.SWITCH]: SwitchNode,
  [NodeType.EXTRACT_DATA]: ExtractDataNode,
  [NodeType.SET_VARIABLE]: SetVariableNode,
  [NodeType.TRANSFORM]: TransformNode,
  [NodeType.RETRY]: RetryNode,
  [NodeType.TIMEOUT]: TimeoutNode,
  [NodeType.LOOP]: LoopNode,
  [NodeType.SUCCESS]: SuccessNode,
  [NodeType.FAIL]: FailNode,
  [NodeType.DELIVER_TO_CUSTOMER]: DeliverToCustomerNode,
};
