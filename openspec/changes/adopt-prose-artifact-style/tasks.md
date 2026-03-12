# Adopt Prose Artifact Style — Tasks

### Task 1: Rename and generalize the block parser (refactoring) — done

Replace `RequirementBlock` with `Block` and `REQUIREMENT_HEADER_REGEX` with `BLOCK_HEADER_REGEX` (`/^###\s+(.+)\s*$/`) throughout `requirement-blocks.ts`. Rename the file to `block-parser.ts`. Replace `extractRequirementsSection` with `extractSection(content, sectionName)` that finds any `## {sectionName}` and parses `###` blocks within it. Add `extractAllSections(content)` that returns all `##` sections with their parsed blocks. Update all imports across the codebase.

**Files:** `src/core/parsers/requirement-blocks.ts` (rename to `block-parser.ts`), all files importing from it
**Acceptance criteria:**
- `BLOCK_HEADER_REGEX` matches `### Any Heading` and captures `Any Heading`
- `extractSection(content, "Behavior")` finds `## Behavior` and returns its `###` blocks
- `extractAllSections(content)` returns a map of section name → blocks
- No reference to `Requirement:` prefix anywhere in the parser
- No reference to hardcoded `## Requirements` section name
- All existing tests updated to use new interface names

### Task 2: Generalize delta parsing to multi-section (refactoring) — done

Update `parseDeltaSpec` to match `## (ADDED|MODIFIED|REMOVED|RENAMED)\s+(.+)` and produce a `DeltaPlan` keyed by target section name (for example, `sections: Record<string, SectionDeltaPlan>`). Update `parseRequirementBlocksFromSection` (rename to `parseBlocksFromSection`) to use `BLOCK_HEADER_REGEX`. Update `parseRemovedNames` to match `### Name` instead of `### Requirement: Name`, and update `parseRenamedPairs` to parse canonical `FROM: ### Old Name` / `TO: ### New Name` entries.

**Files:** `src/core/parsers/block-parser.ts`
**Acceptance criteria:**
- `parseDeltaSpec` on content with `## ADDED Behavior` returns a section plan with `targetSection: "Behavior"`
- `parseDeltaSpec` on content with `## ADDED Foo` and `## MODIFIED Bar` returns two section plans
- Repeated headers targeting the same section are normalized into one aggregated section plan
- Repeated raw headers (e.g., two `## ADDED Behavior` blocks) are valid and aggregated
- Removed names parsed from `### Name` headers (no `Requirement:` prefix)
- Renamed pairs parsed from `FROM: ### Old Name` / `TO: ### New Name` format
- Non-canonical rename bodies (legacy `### Requirement:` or freeform rename syntax) fail parsing/validation

### Task 3: Update spec apply logic for multi-section deltas (feature) — done

Update `buildUpdatedSpec` in `specs-apply.ts` to iterate over `DeltaPlan.sections`, applying each section's deltas to the corresponding `##` section in the target spec. Update `buildSpecSkeleton` to seed only `ADDED {Section}` targets for missing specs instead of hardcoding `## Requirements`.

**Files:** `src/core/specs-apply.ts`
**Acceptance criteria:**
- Deltas targeting `## Behavior` are applied to the `## Behavior` section in the target spec
- Deltas targeting multiple sections (e.g., `## Behavior` and `## Data Model`) are each applied to their respective sections
- New specs get skeleton sections matching only `ADDED {Section}` targets
- `ADDED {Section}` creates missing target sections in existing specs
- `MODIFIED/REMOVED/RENAMED {Section}` fail when target section is missing
- For missing target specs, only `ADDED {Section}` can seed sections; `MODIFIED/REMOVED/RENAMED` fail
- Newly created sections are appended after existing sections in first-appearance order from delta parsing
- Error messages reference `### Name` not `### Requirement: Name`
- Archive of a change with multi-section deltas produces correct merged spec

### Task 4: Update validation to drop format enforcement (refactoring)

Remove SHALL/MUST and Scenario enforcement from validation. Rename `RequirementSchema` to `BlockSchema` in `base.schema.ts` — keep the text-exists check, drop the `SHALL|MUST` refine and min-1 scenarios constraint. Update `SpecSchema` to accept any `##` sections with `###` blocks instead of requiring a `requirements` array. Update `ChangeSchema` to require `problem`, `constraints`, `successCriteria`, and `nonGoals` sections instead of `why`/`whatChanges`, and permit zero deltas before specs are authored. Remove `containsShallOrMust`, `countScenarios`, and scenario-related validation messages from `validator.ts` and `constants.ts`.

**Files:** `src/core/schemas/base.schema.ts`, `src/core/schemas/spec.schema.ts`, `src/core/schemas/change.schema.ts`, `src/core/validation/validator.ts`, `src/core/validation/constants.ts`
**Acceptance criteria:**
- A spec block with no SHALL/MUST passes validation
- A spec block with no `#### Scenario:` passes validation
- A spec block with no content after the `###` heading fails validation
- Duplicate `###` headers within a section still fail validation
- Duplicate `##` section names fail validation
- Conflicting operations on the same `###` block within a target section (after aggregation) still fail validation
- Change validation expects all four proposal sections (`## Problem`, `## Constraints`, `## Success Criteria`, `## Non-goals`)
- Change validation requires exactly one of each required proposal section in canonical order, with no extra top-level `##` sections
- Empty or comment-only proposal sections fail validation for all four required sections
- Legacy markers (`### Requirement:`, `#### Scenario:`, non-canonical rename bodies) fail validation
- Change validation accepts proposal/design/tasks-only changes with empty deltas

### Task 5: Update markdown parser for prose format (refactoring)

Update `MarkdownParser.parseSpec` to accept any `##` sections instead of requiring `## Purpose` + `## Requirements`. Parse `###` blocks without `Requirement:` prefix. Don't require `#### Scenario:` children. Return a generalized structure. Update `ChangeParser.parseChangeWithDeltas` to require all four proposal sections (`## Problem`, `## Constraints`, `## Success Criteria`, `## Non-goals`) instead of `## Why`/`## What Changes`.

**Files:** `src/core/parsers/markdown-parser.ts`, `src/core/parsers/change-parser.ts`
**Acceptance criteria:**
- A spec with `## Behavior` / `### Login` / prose content parses successfully
- A spec with multiple `##` sections each containing `###` blocks parses successfully
- `parseSpec` returns a structure with named sections and their blocks
- `parseChangeWithDeltas` fails when any required proposal section is missing
- `parseChangeWithDeltas` parses proposals when all four required proposal sections are present
- `parseChangeWithDeltas` fails for duplicate required sections, out-of-order required sections, or extra top-level proposal sections

### Task 6: Update schema definition and templates (feature)

Update `schemas/spec-driven/schema.yaml` with new artifact instructions for all five artifacts (proposal, specs, design, tasks, decisions). Update all template files in `schemas/spec-driven/templates/` to the new formats. Add `decisions.md` template. Update the artifact dependency chain to `proposal -> design -> tasks -> specs` with decisions as an optional sidecar.

**Files:** `schemas/spec-driven/schema.yaml`, `schemas/spec-driven/templates/proposal.md`, `schemas/spec-driven/templates/design.md`, `schemas/spec-driven/templates/tasks.md`, `schemas/spec-driven/templates/spec.md`, `schemas/spec-driven/templates/decisions.md` (new)
**Acceptance criteria:**
- `proposal.md` template has Problem/Constraints/Success Criteria/Non-goals sections
- `design.md` template has Overview/Architecture/Detailed Design/Non-goals sections
- `tasks.md` template shows `### Task N: Name (type)` format with Files and Acceptance criteria
- `spec.md` template shows `## ADDED {Section}` / `### {Name}` format with prose
- `spec.md`/schema docs include canonical rename entries (`FROM: ### Old Name`, `TO: ### New Name`) for `## RENAMED {Section}`
- `decisions.md` template shows Q&A format with options and answers
- Schema instruction text describes prose format, not Requirement/Scenario format
- Artifact dependency: `proposal -> design -> tasks -> specs`

### Task 7: Update workflow templates and skill generation (feature)

Update all workflow template files in `src/core/templates/workflows/` to reference the new artifact formats. Update `propose.ts` to describe Problem/Constraints/Success Criteria/Non-goals and mention decisions.md. Update `apply-change.ts` to parse `### Task N:` headings instead of `- [ ]` checkboxes, and mark completion with `— done` suffix. Update skill generation in `src/core/shared/skill-generation.ts` to emit prose format guidance.

**Files:** `src/core/templates/workflows/propose.ts`, `src/core/templates/workflows/apply-change.ts`, `src/core/templates/workflows/continue-change.ts` (if exists), `src/core/templates/workflows/explore.ts`, `src/core/shared/skill-generation.ts`
**Acceptance criteria:**
- Proposal skill describes Problem/Constraints/Success Criteria/Non-goals format
- Apply skill parses `### Task N:` headings for progress tracking
- Apply skill appends `— done` to task heading on completion
- No reference to `### Requirement:`, `#### Scenario:`, SHALL/MUST, or WHEN/THEN in any template
- Generated skills for all supported tools use prose format guidance

### Task 8: Align parsing and validation with specs-last workflow (feature)

Update parsing and validation so `proposal -> design -> tasks -> specs` works without requiring speculative deltas. `parseChangeWithDeltas` should return an empty delta list when no spec artifacts exist yet. Delta enforcement remains active once spec deltas are present and when running archive-time spec validation.

**Files:** `src/core/parsers/change-parser.ts`, `src/core/schemas/change.schema.ts`, `src/core/validation/validator.ts`, `src/commands/workflow/instructions.ts`, `src/commands/workflow/status.ts`
**Acceptance criteria:**
- `parseChangeWithDeltas` succeeds for a change containing only proposal/design/tasks artifacts
- A change with all four proposal sections and no `specs/*/spec.md` validates successfully
- A change containing spec delta files still validates delta structure/content rules
- Archive-time delta validation still fails malformed or conflicting deltas
- `openspec status --change <name>` works when `specs/` is absent and reports tasks from heading-based tracking
- `openspec status --change <name>` treats missing `specs/*/spec.md` as valid pre-spec state (`not started`), not as error
- `openspec status --change <name>` and `openspec instructions apply --change <name>` report the same completion counts

### Task 9: Update openspec-conventions spec as reference example (feature)

Rewrite `openspec/specs/openspec-conventions/spec.md` in the new prose format. This spec is self-referential — it defines the format that all other specs use. It should serve as both the format definition and a reference example of the prose style.

**Files:** `openspec/specs/openspec-conventions/spec.md`
**Acceptance criteria:**
- Defines `###` headings as merge keys (no `Requirement:` prefix)
- Defines delta operations as `## (ADDED|MODIFIED|REMOVED|RENAMED) {SectionName}`
- Documents the prose writing style (no Scenario/WHEN/THEN, no SHALL/MUST)
- Documents the proposal format (Problem/Constraints/Success Criteria/Non-goals)
- Documents the design format (Overview/Architecture/Detailed Design/Non-goals)
- Documents the task format (Task N with description, files, acceptance criteria)
- Documents the decisions format (Q&A with options and answers)
- The spec itself uses the format it describes

### Task 10: Update tests (refactoring)

Update all test files that assert on the old format — requirement header regex matches, scenario parsing, SHALL/MUST validation, checkbox task tracking, proposal Why/What sections. Add new tests for multi-section delta parsing, prose block parsing, and task-heading tracking.

**Files:** `test/core/parsers/`, `test/core/validation/`, `test/core/specs-apply/`, `test/core/templates/`, `test/commands/`
**Acceptance criteria:**
- All existing tests pass (updated to new format expectations)
- Tests cover multi-section delta parsing (`## ADDED Behavior` + `## MODIFIED Data Model`)
- Tests cover repeated delta headers for the same section and deterministic aggregation
- Tests cover duplicate/conflict validation after section aggregation (within section namespace)
- Tests cover same block names in different sections being valid
- Tests cover non-canonical rename bodies failing validation
- Tests cover `### Name` block parsing (no `Requirement:` prefix)
- Tests cover legacy `### Requirement:` / `#### Scenario:` markers failing validation
- Tests cover task heading tracking (`### Task N:` with `— done` suffix)
- Tests cover proposal parsing requiring all four sections
- Tests cover empty/comment-only proposal sections failing validation
- Tests cover proposal strictness: canonical section order, no duplicates, no extra top-level sections
- Tests cover deterministic insertion order when ADDED creates new sections
- No test references `### Requirement:`, `#### Scenario:`, or `containsShallOrMust`

### Task 11: Update documentation (feature)

Update user-facing documentation to describe the new artifact formats. Update examples throughout to use prose style.

**Files:** `docs/concepts.md`, `docs/workflows.md`, `docs/commands.md`, `docs/cli.md`, `docs/getting-started.md`, `AGENTS.md`, `README.md`
**Acceptance criteria:**
- All spec format examples use `### Name` prose style (no Requirement/Scenario)
- All proposal examples use Problem/Constraints/Success Criteria/Non-goals
- All design examples use Overview/Architecture/Detailed Design/Non-goals
- All task examples use `### Task N:` format with acceptance criteria
- Getting started guide walks through the new format
- No reference to SHALL/MUST, WHEN/THEN, or `### Requirement:` in docs
