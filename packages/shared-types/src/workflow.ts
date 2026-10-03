/**
 * The Workflow Graph Contract — FROZEN.
 * Consumed by the backend engine (executes it) and the frontend builder (edits it).
 * This is the "execution contract" TASKS.md Phase 4 requires frozen before parallel work.
 * Node catalog source of truth: BLUEPRINT.md §8.
 *
 * Do not change a node's `type` string or config shape without updating BLUEPRINT.md §8,
 * both the engine executor and the builder visual, and a migration for stored graphs
 * (see .claude/rules/shared-types.md and .claude/instructions/adding-a-node.md).
 */

/** Node type identifiers. Value strings are stable and stored in the DB graph. */
export const NodeType = {
  // Trigger
  START: 'START',
  // Action
  SEND_MESSAGE: 'SEND_MESSAGE',
  SEND_COMMAND: 'SEND_COMMAND',
  CLICK_BUTTON: 'CLICK_BUTTON',
  // Wait
  WAIT_MESSAGE: 'WAIT_MESSAGE',
  WAIT_RESPONSE: 'WAIT_RESPONSE',
  WAIT_BUTTON: 'WAIT_BUTTON',
  DELAY: 'DELAY',
  // Logic
  MATCH_TEXT: 'MATCH_TEXT',
  CONDITION: 'CONDITION',
  SWITCH: 'SWITCH',
  // Data
  EXTRACT_DATA: 'EXTRACT_DATA',
  SET_VARIABLE: 'SET_VARIABLE',
  TRANSFORM: 'TRANSFORM',
  // Control
  RETRY: 'RETRY',
  TIMEOUT: 'TIMEOUT',
  LOOP: 'LOOP',
  // External
  API_ORDER: 'API_ORDER',
  // Terminal
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  DELIVER_TO_CUSTOMER: 'DELIVER_TO_CUSTOMER',
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export const NodeCategory = {
  TRIGGER: 'trigger',
  ACTION: 'action',
  WAIT: 'wait',
  LOGIC: 'logic',
  DATA: 'data',
  CONTROL: 'control',
  TERMINAL: 'terminal',
} as const;
export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

/** Maps each node type to its category (drives palette grouping + canvas color). */
export const NODE_CATEGORY: Record<NodeType, NodeCategory> = {
  START: 'trigger',
  SEND_MESSAGE: 'action',
  SEND_COMMAND: 'action',
  CLICK_BUTTON: 'action',
  WAIT_MESSAGE: 'wait',
  WAIT_RESPONSE: 'wait',
  WAIT_BUTTON: 'wait',
  DELAY: 'wait',
  MATCH_TEXT: 'logic',
  CONDITION: 'logic',
  SWITCH: 'logic',
  EXTRACT_DATA: 'data',
  SET_VARIABLE: 'data',
  TRANSFORM: 'data',
  RETRY: 'control',
  TIMEOUT: 'control',
  LOOP: 'control',
  API_ORDER: 'action',
  SUCCESS: 'terminal',
  FAIL: 'terminal',
  DELIVER_TO_CUSTOMER: 'terminal',
};

/** Output port names each node type exposes (edges connect from these). BLUEPRINT.md §8. */
export const NODE_OUTPUT_PORTS: Record<NodeType, string[]> = {
  START: ['next'],
  SEND_MESSAGE: ['next'],
  SEND_COMMAND: ['next'],
  CLICK_BUTTON: ['clicked', 'not-found'],
  WAIT_MESSAGE: ['received', 'timeout'],
  WAIT_RESPONSE: ['received', 'timeout'],
  WAIT_BUTTON: ['received', 'timeout'],
  DELAY: ['next'],
  MATCH_TEXT: ['matched', 'no-match'],
  CONDITION: ['true', 'false'],
  SWITCH: ['default'], // plus one port per configured case (case:<value>)
  EXTRACT_DATA: ['extracted', 'no-match'],
  SET_VARIABLE: ['next'],
  TRANSFORM: ['next'],
  RETRY: ['next', 'exhausted'],
  TIMEOUT: ['next', 'timeout'],
  LOOP: ['body', 'done'],
  API_ORDER: ['success', 'error'],
  SUCCESS: [],
  FAIL: [],
  DELIVER_TO_CUSTOMER: [],
};

/** Retry policy usable inline on action/wait nodes and by the RETRY control node. */
export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  delayMs: number;
}

/** Common optional fields any node may carry. */
export interface NodeCommonConfig {
  /** Per-node timeout in ms (where applicable). */
  timeoutMs?: number;
  /** Per-node retry policy (where applicable). */
  retry?: RetryPolicy;
  /** Free-form label shown on the canvas. */
  label?: string;
}

// ---- Per-node config shapes (BLUEPRINT.md §8) --------------------------------

export interface StartConfig extends NodeCommonConfig {}

export interface SendMessageConfig extends NodeCommonConfig {
  /** Text to send; supports {{variable}} templating. */
  text: string;
  parseMode?: 'none' | 'markdown' | 'html';
}

export interface SendCommandConfig extends NodeCommonConfig {
  command: string; // e.g. "/beli"
  args?: string;
}

export type ButtonMatchStrategy = 'label' | 'regex' | 'index' | 'position';
export interface ClickButtonConfig extends NodeCommonConfig {
  strategy: ButtonMatchStrategy;
  /** label/regex value, or numeric index, or "row,col" for position. */
  value: string;
  /** Which received message's keyboard to act on. Default: latest. */
  messageRef?: 'latest' | 'matched';
}

export interface WaitMessageConfig extends NodeCommonConfig {
  fromPeer?: string;
}

export type TextMatchMode = 'contains' | 'regex' | 'equals';
export interface WaitResponseConfig extends NodeCommonConfig {
  mode: TextMatchMode;
  pattern: string;
  caseSensitive?: boolean;
}

export interface WaitButtonConfig extends NodeCommonConfig {}

export interface DelayConfig extends NodeCommonConfig {
  ms: number;
  jitterMs?: number;
}

export interface MatchTextConfig extends NodeCommonConfig {
  mode: TextMatchMode;
  pattern: string;
  caseSensitive?: boolean;
  /** Source text: last received message, or a variable reference. Default: last message. */
  source?: 'lastMessage' | string;
}

export interface ConditionConfig extends NodeCommonConfig {
  /** Boolean expression over variables, e.g. "{{stock}} > 0". */
  expression: string;
}

export interface SwitchCase {
  value: string;
  /** Output port name = `case:<value>`. */
}
export interface SwitchConfig extends NodeCommonConfig {
  /** Value/expression to switch on, e.g. "{{status}}". */
  on: string;
  cases: SwitchCase[];
}

export interface ExtractDataConfig extends NodeCommonConfig {
  /** Regex with named capture groups → variables. */
  regex: string;
  /** Source text: last received message, or a variable reference. */
  source?: 'lastMessage' | string;
  /** Optional explicit variable name when the regex has a single group. */
  assignTo?: string;
  /**
   * How many matches to capture. Default `'first'` (back-compat): only the first match's
   * groups become variables. `'all'` captures EVERY match — useful when a supplier sends many
   * lines at once (e.g. 10 `email|password` accounts). In `'all'` mode each named group is
   * collected across matches and joined with `joinWith`, so `variables[key]` holds all lines.
   */
  mode?: 'first' | 'all';
  /** Separator used to join multiple matches in `'all'` mode. Default `'\n'` (newline). */
  joinWith?: string;
}

export interface SetVariableConfig extends NodeCommonConfig {
  name: string;
  /** Literal or {{expression}}. */
  value: string;
}

export type TransformOp =
  | { op: 'trim' }
  | { op: 'lowercase' }
  | { op: 'uppercase' }
  | { op: 'split'; separator: string; index?: number }
  | { op: 'replace'; find: string; replaceWith: string }
  | { op: 'template'; template: string };
export interface TransformConfig extends NodeCommonConfig {
  /** Source variable name. */
  input: string;
  /** Destination variable name. */
  output: string;
  operations: TransformOp[];
}

export interface RetryConfig extends NodeCommonConfig {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  delayMs: number;
}

export interface TimeoutConfig extends NodeCommonConfig {
  ms: number;
}

export interface LoopConfig extends NodeCommonConfig {
  /** Loop while this expression is true, or a fixed count. */
  mode: 'while' | 'count';
  whileExpression?: string;
  count?: number;
  maxIterations: number;
}

export interface SuccessConfig extends NodeCommonConfig {
  /** Result payload template, usually referencing extracted vars. */
  payload?: string;
}

export interface FailConfig extends NodeCommonConfig {
  reason: string;
  /** Whether to trigger the refund path (default true). */
  refund?: boolean;
}

export interface DeliverToCustomerConfig extends NodeCommonConfig {
  /** Message template sent to the customer, supports {{variable}}. */
  template: string;
}

/**
 * API_ORDER: call an external supplier REST API to purchase a product.
 * The node POSTs to `baseUrl/order` with product_id + quantity, stores the
 * response payload in `resultVar`, and routes to `success` or `error`.
 */
export interface ApiOrderConfig extends NodeCommonConfig {
  /** Supplier API base URL, e.g. https://store.abellab.biz.id/api/v1. Supports {{variable}}. */
  baseUrl: string;
  /** API key sent as X-API-Key header. Supports {{variable}} (use a secret var). */
  apiKey: string;
  /** Header name for auth. Default: X-API-Key. */
  authHeader?: string;
  /** Product id to order. Supports {{variable}} (e.g. {{externalProductId}}). */
  productId: string;
  /** Quantity. Supports {{variable}}. Default: {{quantity}}. */
  quantity?: string;
  /** Variable name to store the response payload / voucher. Default: apiPayload. */
  resultVar?: string;
  /** JSON path to extract from response (e.g. "voucher" or "data.code"). If empty, stores full response. */
  extractPath?: string;
}

/** Discriminated map from node type → its config shape. */
export interface NodeConfigMap {
  START: StartConfig;
  SEND_MESSAGE: SendMessageConfig;
  SEND_COMMAND: SendCommandConfig;
  CLICK_BUTTON: ClickButtonConfig;
  WAIT_MESSAGE: WaitMessageConfig;
  WAIT_RESPONSE: WaitResponseConfig;
  WAIT_BUTTON: WaitButtonConfig;
  DELAY: DelayConfig;
  MATCH_TEXT: MatchTextConfig;
  CONDITION: ConditionConfig;
  SWITCH: SwitchConfig;
  EXTRACT_DATA: ExtractDataConfig;
  SET_VARIABLE: SetVariableConfig;
  TRANSFORM: TransformConfig;
  RETRY: RetryConfig;
  TIMEOUT: TimeoutConfig;
  LOOP: LoopConfig;
  API_ORDER: ApiOrderConfig;
  SUCCESS: SuccessConfig;
  FAIL: FailConfig;
  DELIVER_TO_CUSTOMER: DeliverToCustomerConfig;
}

export interface XY {
  x: number;
  y: number;
}

/** A node in the graph. `config` shape is determined by `type` (see NodeConfigMap). */
export interface WorkflowNode<T extends NodeType = NodeType> {
  id: string;
  type: T;
  config: NodeConfigMap[T];
  position: XY;
}

/** A directed edge from a node's output port to another node's input. */
export interface WorkflowEdge {
  id: string;
  from: string; // source node id
  fromPort: string; // one of NODE_OUTPUT_PORTS[sourceType]
  to: string; // target node id
}

/** The complete workflow graph stored in `workflow.graph` (JSONB). */
export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Declared workflow-level variables (names → default value). */
  variables?: Record<string, string>;
  settings?: {
    defaultNodeTimeoutMs?: number;
  };
}

/** Runtime variables captured during an execution (EXTRACT_DATA, SET_VARIABLE, order context). */
export type ExecutionVariables = Record<string, unknown>;
