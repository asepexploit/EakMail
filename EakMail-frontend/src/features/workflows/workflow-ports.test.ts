import { describe, expect, it } from 'vitest';
import { NODE_OUTPUT_PORTS, NodeType, type SwitchConfig } from '@eakmail/shared-types';
import { outputPortsFor } from './workflow-ports.js';

describe('outputPortsFor', () => {
  it('returns the static contract ports for non-SWITCH nodes', () => {
    expect(outputPortsFor(NodeType.START, {})).toEqual(['next']);
    expect(outputPortsFor(NodeType.CONDITION, { expression: '' })).toEqual(['true', 'false']);
    expect(outputPortsFor(NodeType.CLICK_BUTTON, {})).toEqual(['clicked', 'not-found']);
    expect(outputPortsFor(NodeType.LOOP, {})).toEqual(['body', 'done']);
  });

  it('returns no ports for terminal nodes', () => {
    expect(outputPortsFor(NodeType.SUCCESS, {})).toEqual([]);
    expect(outputPortsFor(NodeType.FAIL, {})).toEqual([]);
    expect(outputPortsFor(NodeType.DELIVER_TO_CUSTOMER, {})).toEqual([]);
  });

  it('SWITCH exposes only "default" when no cases are configured', () => {
    const config: SwitchConfig = { on: '{{status}}', cases: [] };
    expect(outputPortsFor(NodeType.SWITCH, config)).toEqual(['default']);
  });

  it('SWITCH exposes one case:<value> port per case, then default', () => {
    const config: SwitchConfig = {
      on: '{{status}}',
      cases: [{ value: 'paid' }, { value: 'pending' }, { value: 'failed' }],
    };
    expect(outputPortsFor(NodeType.SWITCH, config)).toEqual([
      'case:paid',
      'case:pending',
      'case:failed',
      'default',
    ]);
  });

  it('SWITCH tolerates a missing/undefined config without throwing', () => {
    expect(outputPortsFor(NodeType.SWITCH, undefined)).toEqual(['default']);
  });

  it('always ends a SWITCH port list with the static default port', () => {
    const config: SwitchConfig = { on: 'x', cases: [{ value: 'a' }] };
    const ports = outputPortsFor(NodeType.SWITCH, config);
    expect(ports.at(-1)).toBe('default');
    expect(ports.at(-1)).toBe(NODE_OUTPUT_PORTS.SWITCH[0]);
  });
});
