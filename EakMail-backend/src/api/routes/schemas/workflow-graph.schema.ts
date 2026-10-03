/**
 * Runtime (Zod) schema for the WorkflowGraph wire shape. Types are compile-time
 * only, so the API boundary re-validates every inbound graph (shared-types.md §3).
 * Deep per-node config correctness is enforced separately by the graph validator;
 * here we guarantee the structural contract the validator assumes.
 */
import { NodeType } from '@eakmail/shared-types';
import { z } from 'zod';

const nodeTypeSchema = z.enum(Object.values(NodeType) as [string, ...string[]]);

const xySchema = z.object({
  x: z.number(),
  y: z.number(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  // Config shape is discriminated by `type`; validated in depth by the graph validator.
  config: z.record(z.unknown()),
  position: xySchema,
});

const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  fromPort: z.string().min(1),
  to: z.string().min(1),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  variables: z.record(z.string()).optional(),
  settings: z
    .object({
      defaultNodeTimeoutMs: z.number().optional(),
    })
    .optional(),
});
