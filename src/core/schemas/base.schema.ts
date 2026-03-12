import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../validation/constants.js';

/**
 * Schema for a prose block (### heading with content).
 * Replaces the old RequirementSchema — no SHALL/MUST or Scenario enforcement.
 */
export const BlockSchema = z.object({
  text: z.string().min(1, VALIDATION_MESSAGES.BLOCK_EMPTY),
});

export type Block = z.infer<typeof BlockSchema>;

// ---------------------------------------------------------------------------
// Backward compatibility aliases — parsers still produce { text, scenarios }
// until Task 5 updates them. These aliases keep compilation working.
// ---------------------------------------------------------------------------

export const ScenarioSchema = z.object({
  rawText: z.string().min(1),
});

/**
 * @deprecated Use BlockSchema. Kept until Task 5 updates parsers.
 */
export const RequirementSchema = z.object({
  text: z.string().min(1, VALIDATION_MESSAGES.BLOCK_EMPTY),
  scenarios: z.array(ScenarioSchema).optional(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
/** @deprecated Use Block */
export type Requirement = z.infer<typeof RequirementSchema>;
