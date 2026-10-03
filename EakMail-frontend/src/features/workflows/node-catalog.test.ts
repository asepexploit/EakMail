import { describe, expect, it } from 'vitest';
import { NODE_CATEGORY, type NodeType as NodeTypeValue } from '@eakmail/shared-types';
import { featureStrings } from '@/features/shared/feature-strings';
import { nodeDescription, nodeTitle } from './node-catalog.js';

/**
 * Localization guard for the workflow builder (Phase 6): every node type must have a
 * non-empty Bahasa Indonesia display title + description, and every config-panel field
 * label must be a non-empty string, so nothing renders an English fallback or `undefined`.
 */

const allTypes = Object.keys(NODE_CATEGORY) as NodeTypeValue[];

describe('node display localization', () => {
  it('gives every node type a friendly Indonesian title and description', () => {
    for (const type of allTypes) {
      expect(nodeTitle(type).length).toBeGreaterThan(0);
      expect(nodeDescription(type).length).toBeGreaterThan(0);
    }
  });
});

describe('config-panel field labels', () => {
  it('exposes localized labels for every builder field', () => {
    const fields = featureStrings.workflows.fields;
    for (const key of Object.keys(fields) as Array<keyof typeof fields>) {
      expect(typeof fields[key]).toBe('string');
      expect(fields[key].length).toBeGreaterThan(0);
    }
  });
});
