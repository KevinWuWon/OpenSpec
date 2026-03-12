import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../validation/constants.js';

export const SectionBlockSchema = z.object({
  name: z.string().min(1, VALIDATION_MESSAGES.BLOCK_NAME_EMPTY),
  text: z.string(),
});

export const SpecSectionSchema = z.object({
  blocks: z.array(SectionBlockSchema),
});

export const SpecSchema = z.object({
  name: z.string().min(1, VALIDATION_MESSAGES.SPEC_NAME_EMPTY),
  sections: z.record(z.string(), SpecSectionSchema),
  metadata: z.object({
    version: z.string().default('1.0.0'),
    format: z.literal('openspec'),
    sourcePath: z.string().optional(),
  }).optional(),
});

export type SectionBlock = z.infer<typeof SectionBlockSchema>;
export type SpecSection = z.infer<typeof SpecSectionSchema>;
export type Spec = z.infer<typeof SpecSchema>;
