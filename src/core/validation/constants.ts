/**
 * Validation threshold constants
 */

// Minimum character lengths
export const MIN_PROBLEM_SECTION_LENGTH = 50;
export const MIN_SUCCESS_CRITERIA_LENGTH = 50;
export const MIN_PURPOSE_LENGTH = 50;

// Maximum character/item limits
export const MAX_BLOCK_TEXT_LENGTH = 500;
export const MAX_DELTAS_PER_CHANGE = 10;

// Canonical proposal sections in required order
export const PROPOSAL_SECTIONS = ['Problem', 'Constraints', 'Success Criteria', 'Non-goals'] as const;

// Validation messages
export const VALIDATION_MESSAGES = {
  // Block validation
  BLOCK_EMPTY: 'Block text cannot be empty',
  BLOCK_NAME_EMPTY: 'Block name cannot be empty',

  // Spec validation
  SPEC_NAME_EMPTY: 'Spec name cannot be empty',
  SPEC_PURPOSE_EMPTY: 'Purpose section cannot be empty',
  SPEC_NO_REQUIREMENTS: 'Spec must have at least one requirement',
  SPEC_DUPLICATE_SECTION: 'Duplicate ## section name',
  SPEC_DUPLICATE_BLOCK: 'Duplicate ### block name within section',

  // Change validation
  CHANGE_NAME_EMPTY: 'Change name cannot be empty',
  CHANGE_PROBLEM_TOO_SHORT: `Problem section must be at least ${MIN_PROBLEM_SECTION_LENGTH} characters`,
  CHANGE_CONSTRAINTS_EMPTY: 'Constraints section cannot be empty',
  CHANGE_SUCCESS_CRITERIA_TOO_SHORT: `Success Criteria section must be at least ${MIN_SUCCESS_CRITERIA_LENGTH} characters`,
  CHANGE_NON_GOALS_EMPTY: 'Non-goals section cannot be empty',
  CHANGE_MISSING_PROPOSAL_SECTION: 'Missing required proposal section',
  CHANGE_EXTRA_PROPOSAL_SECTION: 'Unexpected top-level ## section',
  CHANGE_PROPOSAL_SECTION_ORDER: 'Proposal sections must appear in canonical order: Problem, Constraints, Success Criteria, Non-goals',
  CHANGE_DUPLICATE_PROPOSAL_SECTION: 'Duplicate proposal section',
  CHANGE_SECTION_EMPTY_OR_COMMENT: 'Section content is empty or contains only comments',
  CHANGE_NO_DELTAS: 'Change must have at least one delta',
  CHANGE_TOO_MANY_DELTAS: `Consider splitting changes with more than ${MAX_DELTAS_PER_CHANGE} deltas`,
  DELTA_SPEC_EMPTY: 'Spec name cannot be empty',
  DELTA_DESCRIPTION_EMPTY: 'Delta description cannot be empty',

  // Legacy marker rejection
  LEGACY_REQUIREMENT_PREFIX: 'Legacy marker detected: "### Requirement:" headers are no longer supported. Use "### Name" instead',
  LEGACY_SCENARIO_HEADER: 'Legacy marker detected: "#### Scenario:" headers are no longer supported',
  LEGACY_RENAME_BODY: 'Legacy marker detected: rename entries must use "FROM: ### Name" / "TO: ### Name" format (not "### Requirement: Name")',

  // Warnings
  PURPOSE_TOO_BRIEF: `Purpose section is too brief (less than ${MIN_PURPOSE_LENGTH} characters)`,
  BLOCK_TOO_LONG: `Block text is very long (>${MAX_BLOCK_TEXT_LENGTH} characters). Consider breaking it down.`,
  DELTA_DESCRIPTION_TOO_BRIEF: 'Delta description is too brief',

  // Guidance snippets (appended to primary messages for remediation)
  GUIDE_NO_DELTAS:
    'No deltas found. Ensure your change has a specs/ directory with capability folders (e.g. specs/http-server/spec.md) containing .md files that use delta headers (## ADDED/MODIFIED/REMOVED/RENAMED SectionName) and that each section includes at least one "###" block.',
  GUIDE_MISSING_SPEC_SECTIONS:
    'Missing required sections. A spec must have at least one ## section containing ### blocks with content.',
  GUIDE_MISSING_CHANGE_SECTIONS:
    'Missing required sections. Expected headers: "## Problem", "## Constraints", "## Success Criteria", "## Non-goals".',
} as const;
