/**
 * Per-node-type required-config rules. A registry (not a switch) mapping each
 * NodeType to a predicate that returns human-readable error messages for any
 * missing/invalid required config. Config shapes come from shared-types
 * (workflow.ts NodeConfigMap); this only enforces the "required" subset that
 * the builder cannot guarantee structurally.
 */
import {
  NodeType,
  type ClickButtonConfig,
  type ConditionConfig,
  type DelayConfig,
  type DeliverToCustomerConfig,
  type ExtractDataConfig,
  type FailConfig,
  type LoopConfig,
  type MatchTextConfig,
  type NodeConfigMap,
  type RetryConfig,
  type SendCommandConfig,
  type SendMessageConfig,
  type SetVariableConfig,
  type SwitchConfig,
  type TimeoutConfig,
  type TransformConfig,
  type WaitResponseConfig,
} from '@eakmail/shared-types';

/** A rule inspects one node's config and returns zero or more error messages. */
type ConfigRule<T extends NodeType> = (config: NodeConfigMap[T]) => string[];

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const isPositiveNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const sendMessageRule: ConfigRule<'SEND_MESSAGE'> = (config: SendMessageConfig) =>
  isBlank(config.text) ? ['SEND_MESSAGE requires non-empty "text".'] : [];

const sendCommandRule: ConfigRule<'SEND_COMMAND'> = (config: SendCommandConfig) =>
  isBlank(config.command) ? ['SEND_COMMAND requires non-empty "command".'] : [];

const clickButtonRule: ConfigRule<'CLICK_BUTTON'> = (config: ClickButtonConfig) => {
  const issues: string[] = [];
  if (isBlank(config.strategy)) issues.push('CLICK_BUTTON requires a "strategy".');
  if (isBlank(config.value)) issues.push('CLICK_BUTTON requires a "value".');
  return issues;
};

const waitResponseRule: ConfigRule<'WAIT_RESPONSE'> = (config: WaitResponseConfig) => {
  const issues: string[] = [];
  if (isBlank(config.mode)) issues.push('WAIT_RESPONSE requires a "mode".');
  if (isBlank(config.pattern)) issues.push('WAIT_RESPONSE requires a "pattern".');
  return issues;
};

const delayRule: ConfigRule<'DELAY'> = (config: DelayConfig) =>
  isPositiveNumber(config.ms) ? [] : ['DELAY requires "ms" to be a positive number.'];

const matchTextRule: ConfigRule<'MATCH_TEXT'> = (config: MatchTextConfig) => {
  const issues: string[] = [];
  if (isBlank(config.mode)) issues.push('MATCH_TEXT requires a "mode".');
  if (isBlank(config.pattern)) issues.push('MATCH_TEXT requires a "pattern".');
  return issues;
};

const conditionRule: ConfigRule<'CONDITION'> = (config: ConditionConfig) =>
  isBlank(config.expression) ? ['CONDITION requires a non-empty "expression".'] : [];

const switchRule: ConfigRule<'SWITCH'> = (config: SwitchConfig) => {
  const issues: string[] = [];
  if (isBlank(config.on)) issues.push('SWITCH requires a non-empty "on" expression.');
  if (!Array.isArray(config.cases) || config.cases.length === 0) {
    issues.push('SWITCH requires at least one case.');
  } else if (config.cases.some((branch) => isBlank(branch.value))) {
    issues.push('SWITCH cases must each have a non-empty "value".');
  }
  return issues;
};

const extractDataRule: ConfigRule<'EXTRACT_DATA'> = (config: ExtractDataConfig) =>
  isBlank(config.regex) ? ['EXTRACT_DATA requires a non-empty "regex".'] : [];

const setVariableRule: ConfigRule<'SET_VARIABLE'> = (config: SetVariableConfig) =>
  isBlank(config.name) ? ['SET_VARIABLE requires a "name".'] : [];

const transformRule: ConfigRule<'TRANSFORM'> = (config: TransformConfig) => {
  const issues: string[] = [];
  if (isBlank(config.input)) issues.push('TRANSFORM requires an "input" variable.');
  if (isBlank(config.output)) issues.push('TRANSFORM requires an "output" variable.');
  if (!Array.isArray(config.operations) || config.operations.length === 0) {
    issues.push('TRANSFORM requires at least one operation.');
  }
  return issues;
};

const retryRule: ConfigRule<'RETRY'> = (config: RetryConfig) =>
  isPositiveNumber(config.maxAttempts)
    ? []
    : ['RETRY requires "maxAttempts" to be a positive number.'];

const timeoutRule: ConfigRule<'TIMEOUT'> = (config: TimeoutConfig) =>
  isPositiveNumber(config.ms) ? [] : ['TIMEOUT requires "ms" to be a positive number.'];

const loopRule: ConfigRule<'LOOP'> = (config: LoopConfig) => {
  const issues: string[] = [];
  if (config.mode !== 'while' && config.mode !== 'count') {
    issues.push('LOOP requires "mode" to be "while" or "count".');
  } else if (config.mode === 'while' && isBlank(config.whileExpression)) {
    issues.push('LOOP in "while" mode requires a "whileExpression".');
  } else if (config.mode === 'count' && !isPositiveNumber(config.count)) {
    issues.push('LOOP in "count" mode requires a positive "count".');
  }
  if (!isPositiveNumber(config.maxIterations)) {
    issues.push('LOOP requires "maxIterations" to be a positive number.');
  }
  return issues;
};

const failRule: ConfigRule<'FAIL'> = (config: FailConfig) =>
  isBlank(config.reason) ? ['FAIL requires a "reason".'] : [];

const deliverRule: ConfigRule<'DELIVER_TO_CUSTOMER'> = (config: DeliverToCustomerConfig) =>
  isBlank(config.template) ? ['DELIVER_TO_CUSTOMER requires a "template".'] : [];

/**
 * Registry of required-config rules. Node types with no required config (START,
 * WAIT_MESSAGE, WAIT_BUTTON, SUCCESS) are intentionally absent — nothing to check.
 */
const CONFIG_RULES: Partial<{ [T in NodeType]: ConfigRule<T> }> = {
  SEND_MESSAGE: sendMessageRule,
  SEND_COMMAND: sendCommandRule,
  CLICK_BUTTON: clickButtonRule,
  WAIT_RESPONSE: waitResponseRule,
  DELAY: delayRule,
  MATCH_TEXT: matchTextRule,
  CONDITION: conditionRule,
  SWITCH: switchRule,
  EXTRACT_DATA: extractDataRule,
  SET_VARIABLE: setVariableRule,
  TRANSFORM: transformRule,
  RETRY: retryRule,
  TIMEOUT: timeoutRule,
  LOOP: loopRule,
  FAIL: failRule,
  DELIVER_TO_CUSTOMER: deliverRule,
};

/** Returns required-config error messages for a node, or [] when it is complete. */
export function checkRequiredConfig<T extends NodeType>(
  type: T,
  config: NodeConfigMap[T],
): string[] {
  const rule = CONFIG_RULES[type] as ConfigRule<T> | undefined;
  if (!rule) return [];
  // A missing config object is itself an error for any node that has a rule.
  if (config === undefined || config === null) {
    return [`${type} is missing its configuration.`];
  }
  return rule(config);
}
