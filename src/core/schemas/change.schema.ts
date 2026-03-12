import { z } from 'zod';
import { BlockSchema } from './base.schema.js';
import {
  MAX_DELTAS_PER_CHANGE,
  VALIDATION_MESSAGES
} from '../validation/constants.js';

export const DeltaOperationType = z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']);

export const DeltaSchema = z.object({
  spec: z.string().min(1, VALIDATION_MESSAGES.DELTA_SPEC_EMPTY),
  operation: DeltaOperationType,
  description: z.string().min(1, VALIDATION_MESSAGES.DELTA_DESCRIPTION_EMPTY),
  requirement: BlockSchema.optional(),
  requirements: z.array(BlockSchema).optional(),
  rename: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
});

/**
 * ChangeSchema — proposal sections are required; deltas may be empty for
 * proposal/design/tasks-only changes (specs come last in the workflow).
 */
export const ChangeSchema = z.object({
  name: z.string().min(1, VALIDATION_MESSAGES.CHANGE_NAME_EMPTY),
  problem: z.string().min(1),
  constraints: z.string().min(1),
  successCriteria: z.string().min(1),
  nonGoals: z.string().min(1),
  deltas: z.array(DeltaSchema)
    .max(MAX_DELTAS_PER_CHANGE, VALIDATION_MESSAGES.CHANGE_TOO_MANY_DELTAS),
  metadata: z.object({
    version: z.string().default('1.0.0'),
    format: z.literal('openspec-change'),
    sourcePath: z.string().optional(),
  }).optional(),
});

export type DeltaOperation = z.infer<typeof DeltaOperationType>;
export type Delta = z.infer<typeof DeltaSchema>;
export type Change = z.infer<typeof ChangeSchema>;
