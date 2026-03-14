import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../validation/constants.js';

/**
 * Schema for a prose block (### heading with content).
 */
export const BlockSchema = z.object({
  text: z.string().min(1, VALIDATION_MESSAGES.BLOCK_EMPTY),
});

export type Block = z.infer<typeof BlockSchema>;
