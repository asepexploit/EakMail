/**
 * Frontend node catalog metadata: category → color token, per-node icon + display label,
 * and default config used when dropping a new node. The node `type` strings, categories,
 * and output ports come from the frozen @eakmail/shared-types contract — this file only
 * adds the visual/UX layer (DESIGN_SYSTEM.md §8.3, BLUEPRINT.md §8).
 */
import {
  NODE_CATEGORY,
  NodeCategory,
  NodeType,
  type NodeConfigMap,
  type NodeType as NodeTypeValue,
} from '@eakmail/shared-types';
import { featureStrings } from '@/features/shared/feature-strings';
import {
  ArrowRightLeft,
  Braces,
  CheckCircle2,
  Clock,
  GitBranch,
  Globe,
  Hand,
  Hourglass,
  ListTree,
  MessageSquare,
  MousePointerClick,
  Play,
  RefreshCw,
  Regex,
  Repeat,
  Settings2,
  Terminal,
  Timer,
  Truck,
  Variable,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

/** Category → CSS color-token variable (DESIGN_SYSTEM.md §8.3). */
export const CATEGORY_COLOR_VAR: Record<NodeCategory, string> = {
  [NodeCategory.TRIGGER]: 'var(--brand)',
  [NodeCategory.ACTION]: 'var(--brand-accent)',
  [NodeCategory.WAIT]: 'var(--warning)',
  [NodeCategory.LOGIC]: 'var(--info)',
  [NodeCategory.DATA]: 'var(--node-data)',
  [NodeCategory.CONTROL]: 'var(--neutral)',
  [NodeCategory.TERMINAL]: 'var(--success)',
};

/** SUCCESS is green, FAIL is red (DESIGN_SYSTEM.md §8.3). */
export function nodeColorVar(type: NodeTypeValue): string {
  if (type === NodeType.FAIL) return 'var(--danger)';
  if (type === NodeType.SUCCESS || type === NodeType.DELIVER_TO_CUSTOMER) return 'var(--success)';
  return CATEGORY_COLOR_VAR[NODE_CATEGORY[type]];
}

export const NODE_ICON: Record<NodeTypeValue, LucideIcon> = {
  START: Play,
  SEND_MESSAGE: MessageSquare,
  SEND_COMMAND: Terminal,
  CLICK_BUTTON: MousePointerClick,
  WAIT_MESSAGE: Hourglass,
  WAIT_RESPONSE: Hourglass,
  WAIT_BUTTON: Hand,
  DELAY: Clock,
  MATCH_TEXT: Regex,
  CONDITION: GitBranch,
  SWITCH: ListTree,
  EXTRACT_DATA: Braces,
  SET_VARIABLE: Variable,
  TRANSFORM: ArrowRightLeft,
  RETRY: RefreshCw,
  TIMEOUT: Timer,
  LOOP: Repeat,
  SUCCESS: CheckCircle2,
  FAIL: XCircle,
  DELIVER_TO_CUSTOMER: Truck,
  API_ORDER: Globe,
};

/** Fallback icon for anything unexpected. */
export const DEFAULT_NODE_ICON = Settings2;

/** Short display label per node type (code identifiers stay the enum values). */
export const NODE_LABEL: Record<NodeTypeValue, string> = {
  START: 'Start',
  SEND_MESSAGE: 'Send Message',
  SEND_COMMAND: 'Send Command',
  CLICK_BUTTON: 'Click Button',
  WAIT_MESSAGE: 'Wait Message',
  WAIT_RESPONSE: 'Wait Response',
  WAIT_BUTTON: 'Wait Button',
  DELAY: 'Delay',
  MATCH_TEXT: 'Match Text',
  CONDITION: 'Condition',
  SWITCH: 'Switch',
  EXTRACT_DATA: 'Extract Data',
  SET_VARIABLE: 'Set Variable',
  TRANSFORM: 'Transform',
  RETRY: 'Retry',
  TIMEOUT: 'Timeout',
  LOOP: 'Loop',
  SUCCESS: 'Success',
  FAIL: 'Fail',
  DELIVER_TO_CUSTOMER: 'Deliver',
  API_ORDER: 'API Order',
};

/**
 * Friendly localized display title for a node type (Bahasa Indonesia), sourced from
 * the centralized strings module. The code identifier (NodeType enum) stays English;
 * this is only user-facing copy. Falls back to the English NODE_LABEL if missing.
 */
export function nodeTitle(type: NodeTypeValue): string {
  return featureStrings.workflows.nodeDisplay[type]?.title ?? NODE_LABEL[type];
}

/** One-line localized description for a node type, shown in the palette. */
export function nodeDescription(type: NodeTypeValue): string {
  return featureStrings.workflows.nodeDisplay[type]?.description ?? '';
}

/** A concise one-line summary of a node's config for the canvas body. */
export function nodeSummary<T extends NodeTypeValue>(type: T, config: NodeConfigMap[T]): string {
  const c = config as Record<string, unknown>;
  switch (type) {
    case NodeType.SEND_MESSAGE:
      return truncate(String(c.text ?? ''));
    case NodeType.SEND_COMMAND:
      return String(c.command ?? '');
    case NodeType.CLICK_BUTTON:
      return `${c.strategy ?? ''}: ${c.value ?? ''}`;
    case NodeType.WAIT_RESPONSE:
    case NodeType.MATCH_TEXT:
      return `${c.mode ?? ''}: ${truncate(String(c.pattern ?? ''))}`;
    case NodeType.DELAY:
      return `${c.ms ?? 0}ms`;
    case NodeType.CONDITION:
      return truncate(String(c.expression ?? ''));
    case NodeType.SWITCH:
      return `on ${c.on ?? ''}`;
    case NodeType.EXTRACT_DATA:
      return truncate(String(c.regex ?? ''));
    case NodeType.SET_VARIABLE:
      return `${c.name ?? ''} = ${truncate(String(c.value ?? ''))}`;
    case NodeType.TRANSFORM:
      return `${c.input ?? ''} → ${c.output ?? ''}`;
    case NodeType.RETRY:
      return `${c.maxAttempts ?? 0}x ${c.backoff ?? ''}`;
    case NodeType.TIMEOUT:
      return `${c.ms ?? 0}ms`;
    case NodeType.LOOP:
      return String(c.mode ?? '');
    case NodeType.FAIL:
      return truncate(String(c.reason ?? ''));
    case NodeType.DELIVER_TO_CUSTOMER:
      return truncate(String(c.template ?? ''));
    case NodeType.API_ORDER:
      return truncate(String(c.baseUrl ?? ''));
    default:
      return '';
  }
}

function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Default config for a freshly dropped node of each type. */
export const DEFAULT_NODE_CONFIG: { [K in NodeTypeValue]: NodeConfigMap[K] } = {
  START: {},
  SEND_MESSAGE: { text: '', parseMode: 'none' },
  SEND_COMMAND: { command: '/', args: '' },
  CLICK_BUTTON: { strategy: 'label', value: '', messageRef: 'latest' },
  WAIT_MESSAGE: {},
  WAIT_RESPONSE: { mode: 'contains', pattern: '', caseSensitive: false },
  WAIT_BUTTON: {},
  DELAY: { ms: 1000 },
  MATCH_TEXT: { mode: 'contains', pattern: '', caseSensitive: false, source: 'lastMessage' },
  CONDITION: { expression: '' },
  SWITCH: { on: '', cases: [] },
  EXTRACT_DATA: { regex: '', source: 'lastMessage' },
  SET_VARIABLE: { name: '', value: '' },
  TRANSFORM: { input: '', output: '', operations: [] },
  RETRY: { maxAttempts: 3, backoff: 'exponential', delayMs: 1000 },
  TIMEOUT: { ms: 30000 },
  LOOP: { mode: 'count', count: 1, maxIterations: 10 },
  SUCCESS: { payload: '' },
  FAIL: { reason: '', refund: true },
  DELIVER_TO_CUSTOMER: { template: '' },
  API_ORDER: { baseUrl: '', apiKey: '', productId: '', quantity: '{{qty}}', resultVar: 'voucher' },
};

/** Palette grouping: category → its node types, in a stable display order. */
export const PALETTE_GROUPS: Array<{ category: NodeCategory; types: NodeTypeValue[] }> = (() => {
  const order: NodeCategory[] = [
    NodeCategory.TRIGGER,
    NodeCategory.ACTION,
    NodeCategory.WAIT,
    NodeCategory.LOGIC,
    NodeCategory.DATA,
    NodeCategory.CONTROL,
    NodeCategory.TERMINAL,
  ];
  return order.map((category) => ({
    category,
    types: (Object.keys(NODE_CATEGORY) as NodeTypeValue[]).filter(
      (type) => NODE_CATEGORY[type] === category,
    ),
  }));
})();
