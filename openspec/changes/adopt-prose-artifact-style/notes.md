# Adopt Prose Artifact Style — Implementation Notes

## Task 1: Rename and generalize block parser (2026-03-13)

[learning] The `specs-apply.ts` file had a hardcoded regex `/^###\s*Requirement:\s*(.+)\s*$/` on line 279 for validating MODIFIED block headers, separate from the shared `REQUIREMENT_HEADER_REGEX`. After updating the parser, this caused archive tests to fail with "header mismatch in content" because the new `BLOCK_HEADER_REGEX` captures `Requirement: Name` as the full name (including the prefix), but the validation regex was still stripping it. Updated to use `/^###\s+(.+)\s*$/` to match the new format.

[learning] The renamed block header construction in `specs-apply.ts` also used `### Requirement: ${to}` — had to update to `### ${to}` to match the generalized format.

[question] `parseDeltaSpec` still references `ADDED Requirements`, `MODIFIED Requirements`, etc. as section names. Left this as-is per task scope — Task 2 will generalize delta parsing to multi-section format. The `parseRemovedNames` and `parseRenamedPairs` functions now use `BLOCK_HEADER_REGEX` (matching `### Name`) instead of the old `Requirement:` prefix regex, and the renamed pair regexes were updated from `### Requirement:` to `### ` in FROM/TO patterns.

## Task 2: Generalize delta parsing to multi-section (2026-03-13)

[design] Replaced flat `DeltaPlan` (`added`, `modified`, `removed`, `renamed` arrays + `sectionPresence`) with `SectionDeltaPlan` per target section, nested under `DeltaPlan.sections: Record<string, SectionDeltaPlan>`. The regex `DELTA_HEADER_REGEX = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+(.+?)\s*$/i` captures operation + target section name dynamically.

[design] Removed `splitTopLevelSections` and `getSectionCaseInsensitive` helper functions — replaced by inline parsing in the new `parseDeltaSpec`. The new implementation scans lines for `DELTA_HEADER_REGEX` matches, collects body ranges, and aggregates into the appropriate `SectionDeltaPlan`.

[refactor] Extracted `validateSectionDeltaPlan` and `applySectionDelta` helper functions in `specs-apply.ts` to apply validation and delta operations per-section rather than globally. The core merge algorithm (RENAMED → REMOVED → MODIFIED → ADDED) is unchanged.

[note] `validator.ts` validation now runs per target section — duplicate/conflict checks are scoped within each section's namespace, matching the design doc's requirement that the same `###` block name can appear in different target sections.

## Task 3: Update spec apply logic for multi-section deltas (2026-03-13)

[fix] `buildSpecSkeleton` no longer hardcodes `## Requirements`. Now accepts `sectionNames: string[]` parameter and seeds only ADDED section targets in first-appearance order from delta parsing. Default is empty array for backwards compatibility.

[fix] `applySectionDelta` now checks whether the target section exists in content before extracting. For MODIFIED/REMOVED/RENAMED, missing sections throw an error. Only ADDED can create new sections.

[behavior-change] REMOVED operations on new specs now fail with an error instead of being warned and skipped. This aligns with the design doc rule: "For missing target specs, only ADDED can seed sections." Updated 3 archive tests to match.

[fix] Error messages changed from "duplicate requirement" to "duplicate block" and from "only ADDED requirements" to "only ADDED blocks" throughout `specs-apply.ts`.

[note] Added `sectionExistsInContent` helper that does a line-by-line check for `## SectionName` (case-insensitive) without needing regex escaping for section names.

## Task 4: Update validation to drop format enforcement (2026-03-13)

[design] Introduced `BlockSchema` in `base.schema.ts` with only `text: z.string().min(1)` — no SHALL/MUST refine, no scenarios constraint. Kept `RequirementSchema` as a backward-compat alias with optional scenarios until Task 5 updates parsers.

[design] ChangeSchema now allows empty deltas (`.min(1)` removed) for pre-spec proposal/design/tasks-only changes. The `why`/`whatChanges` fields are kept as optional for parser backward compat. Proposal section validation (Problem, Constraints, Success Criteria, Non-goals) is enforced via raw-content checks in `Validator.validateProposalSections()`, not through the schema shape.

[behavior-change] `validateChangeDeltaSpecs` no longer errors when `specs/` directory doesn't exist — returns valid report for pre-spec changes. Only enforces non-empty deltas when the specs dir exists and was successfully read.

[behavior-change] Removed `containsShallOrMust`, `countScenarios`, `extractRequirementText` from validator. Delta spec validation now checks `blockHasContent` (any non-blank content after the header) instead of SHALL/MUST and scenario counts.

[feature] Added legacy marker rejection in `validateChangeDeltaSpecs`: detects `### Requirement:` headers, `#### Scenario:` headers, and old `FROM: ### Requirement:` rename format. Reports as ERROR with descriptive messages.

[feature] Added `checkDuplicateSections` and `checkDuplicateBlocks` helpers in validator for spec validation. Duplicate `##` section names and duplicate `###` block names within the same section are now detected from raw content.

[feature] `validateProposalSections` validates: all four required sections present, canonical order, no extras, no duplicates, not empty/comment-only, minimum lengths for Problem (50 chars) and Success Criteria (50 chars).

[note] Error messages updated from "requirement" terminology to "block" throughout `validateChangeDeltaSpecs`. Guidance messages updated to reference `## ADDED SectionName` instead of `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`.

[note] Test fixtures (`test/fixtures/tmp-init/`) updated from old format to new prose format. All tests updated to match new validation behavior (40 validation schema/validator tests, 3 enriched-messages tests, enriched-output test, and 2 validate command tests).
