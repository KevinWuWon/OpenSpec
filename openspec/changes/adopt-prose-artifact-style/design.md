# Adopt Prose Artifact Style — Design

## Overview

Replace OpenSpec's formal Requirement/Scenario/SHALL format with plain prose across all artifacts. The delta merge system stays mechanical but operates on `### Heading` blocks instead of `### Requirement: Name` blocks, and targets any `##` section instead of only `## Requirements`. Proposals adopt waterfall's Problem/Constraints/Success Criteria/Non-goals structure. Design files adopt Overview/Architecture/Detailed Design/Non-goals. Task files adopt numbered task sections with descriptions, file lists, and acceptance criteria. A new decisions.md artifact captures Q&A from the exploration phase.

This is a hard cutover. There is no legacy parser mode and no migration workflow in this change. The repository is assumed to contain only new-format artifacts.

## Architecture

```
Current format flow:

  spec.md                     delta spec.md
  ┌─────────────────┐         ┌──────────────────────────┐
  │ ## Requirements  │         │ ## ADDED Requirements    │
  │ ### Requirement: │◄────────│ ### Requirement: Name    │
  │   Name           │  merge  │   SHALL ... WHEN ... THEN│
  │   SHALL ...      │  key    │                          │
  │   #### Scenario: │         │ ## MODIFIED Requirements │
  │     WHEN/THEN    │         │ ### Requirement: Name    │
  └─────────────────┘         └──────────────────────────┘

New format flow:

  spec.md                     delta spec.md
  ┌─────────────────┐         ┌──────────────────────────┐
  │ ## Behavior      │         │ ## ADDED Behavior        │
  │ ### Login        │◄────────│ ### Two-Factor Auth      │
  │   Prose...       │  merge  │   Prose...               │
  │                  │  key    │                          │
  │ ## Data Model    │         │ ## MODIFIED Data Model   │
  │ ### Sessions     │◄────────│ ### Sessions             │
  │   Prose...       │  merge  │   Updated prose...       │
  └─────────────────┘         └──────────────────────────┘
```

The merge algorithm (RENAMED → REMOVED → MODIFIED → ADDED) is unchanged. What changes:
- The regex that identifies blocks: `### Requirement: Name` → `### Name`
- The section targeting: hardcoded `## Requirements` → dynamic `## {SectionName}`
- Validation rules: drop SHALL/MUST and Scenario enforcement

## Detailed Design

### Parser changes (`src/core/parsers/block-parser.ts`, renamed from `requirement-blocks.ts`)

The parser currently has one regex and one section name hardcoded throughout:

```
REQUIREMENT_HEADER_REGEX = /^###\s*Requirement:\s*(.+)\s*$/
Section target: "## Requirements"
```

**New regex:**

```
BLOCK_HEADER_REGEX = /^###\s+(.+)\s*$/
```

Replace `REQUIREMENT_HEADER_REGEX` entirely. All code paths that match `### Requirement: Name` switch to matching `### Name`. The `RequirementBlock` interface renames to `Block` — same shape, different name.

**Section targeting becomes dynamic.** `extractRequirementsSection` is replaced by `extractSection(content, sectionName)` which finds `## {sectionName}` and parses `###` blocks within it. A new `extractAllSections(content)` returns all `##` sections with their blocks, used when the caller doesn't know section names in advance (e.g., validation).

**Delta section parsing changes.** `parseDeltaSpec` currently looks for `ADDED Requirements`, `MODIFIED Requirements`, etc. The new parser uses a regex to match `## (ADDED|MODIFIED|REMOVED|RENAMED)\s+(.+)` and captures the operation and the target section name. Raw duplicate delta headers are allowed; they are merged into a single aggregated section plan keyed by target section:

```typescript
interface SectionDeltaPlan {
  targetSection: string;       // e.g., "Behavior", "Data Model"
  added: Block[];
  modified: Block[];
  removed: string[];
  renamed: Array<{ from: string; to: string }>;
}

interface DeltaPlan {
  sections: Record<string, SectionDeltaPlan>; // keyed by target section
}
```

### Apply changes (`src/core/specs-apply.ts`)

`buildUpdatedSpec` currently calls `extractRequirementsSection` once and applies all deltas to that one section. The new version:

1. Parses the delta spec into section-keyed `SectionDeltaPlan` entries
2. For each target section in the delta:
   - Calls `extractSection(targetContent, sectionName)` to get the section's blocks
   - Applies RENAMED → REMOVED → MODIFIED → ADDED (same algorithm)
   - Recomposes the section
3. Reassembles the full spec from all sections (modified and unmodified)

Deterministic section rules:
- `ADDED {Section}` creates the section when it doesn't exist in the target spec
- `MODIFIED/REMOVED/RENAMED {Section}` fail if the target section doesn't exist
- Existing sections keep their original order
- Newly created sections are appended after existing sections in first-appearance order from delta parsing
- Duplicate `##` section names are invalid in base specs
- In delta specs, repeated operation headers targeting the same section are valid and merged
- Validation runs after section aggregation, and duplicate/conflict checks apply within each target section namespace
- The same `###` block name can appear in different target sections (for example `## Behavior` and `## Admin Operations`)

For new specs (target doesn't exist), the skeleton builder creates sections only for `ADDED {Section}` targets instead of hardcoding `## Requirements`. `MODIFIED/REMOVED/RENAMED` entries never create sections in a missing spec.

### Validation changes (`src/core/validation/`)

**Drop RFC-2119/scenario requirements, keep structural checks, and reject legacy markers.**

Current validation enforces:
- Every requirement has SHALL or MUST (`containsShallOrMust`) — **remove**
- Every requirement has at least one `#### Scenario:` block (`countScenarios`) — **remove**
- Requirement text exists after the header — **keep** (blocks should have content)
- No duplicate headers within a section — **keep**
- No conflicting operations on the same `###` block within a target section (after aggregation) — **keep**
- At least one `##` section exists and each section has at least one `###` block — **keep**
- Duplicate `##` section names are rejected — **keep**
- Legacy markers (`### Requirement:`, `#### Scenario:`, non-canonical rename bodies) are rejected in hard-cutover mode — **keep**

The `RequirementSchema` in `base.schema.ts` drops the SHALL/MUST refine and the min-1 scenarios constraint. Rename to `BlockSchema` to reflect the generalized concept. The `SpecSchema` in `spec.schema.ts` drops the hard requirement for a `requirements` array — specs can have any `##` sections with `###` blocks.

The `ChangeSchema` in `change.schema.ts` drops the `why`/`whatChanges` field requirements since proposals now use Problem/Constraints/Success Criteria/Non-goals. Replace with required `problem`, `constraints`, `successCriteria`, and `nonGoals` fields (with stronger minimum lengths for `problem` and `successCriteria`, plus trimmed non-empty checks for `constraints` and `nonGoals`). Empty or comment-only sections fail validation. Because specs now come last, allow `deltas` to be empty before the specs artifact exists. Delta requirements are enforced when specs are generated and during delta/spec archive validation.

### Schema definition (`schemas/spec-driven/schema.yaml`)

Update artifact definitions:

**proposal** — new instruction text describing Problem/Constraints/Success Criteria/Non-goals format. New template with those section headers.

**specs** — new instruction text dropping Requirement/Scenario format guidance. Describes prose blocks under `###` headings within any `##` section. Delta operations reference target sections by name (`## ADDED Behavior` not `## ADDED Requirements`). Drop the SHALL/MUST and Scenario enforcement language.

**design** — new instruction text describing Overview/Architecture/Detailed Design/Non-goals structure with optional Decisions section. Drop Context/Goals/Decisions/Risks/Migration structure.

**tasks** — new instruction text describing numbered task sections with descriptions, file lists, and acceptance criteria. Drop checkbox format guidance. Update `apply.tracks` from checkbox parsing to task-section parsing.

**New artifact: decisions** — Q&A format artifact. Optional, no dependencies. Produced during proposal phase.

`decisions.md` is the proposal/exploration Q&A record. The optional `## Decisions` section in `design.md` is only for implementation-relevant choices that need to stay visible in the blueprint.

### Template updates (`schemas/spec-driven/templates/`)

**`proposal.md` template:**
```markdown
## Problem

<!-- What's broken or missing. Why it matters. -->

## Constraints

<!-- Hard boundaries. Technical limits. What can't change. -->

## Success Criteria

<!-- Observable outcomes when done. User-visible statements. -->

## Non-goals

<!-- What we're explicitly not building. -->
```

**`design.md` template:**
```markdown
## Overview

<!-- One paragraph. What and why. -->

## Architecture

<!-- Diagrams, data flow, system structure. -->

## Detailed Design

<!-- Organized by concept. Data models, APIs, integration points. -->

## Non-goals

<!-- What this design explicitly avoids. -->
```

**`tasks.md` template:**
```markdown
### Task 1: <!-- Name --> (<!-- feature|refactoring -->)

<!-- What to implement, where, and why. -->

**Files:** <!-- paths -->
**Acceptance criteria:**
- <!-- criterion -->
```

**`spec.md` template:**
```markdown
## ADDED <!-- Section Name -->

### <!-- Block name -->
<!-- Describe the behavior in plain prose. -->
```

Canonical rename entry format for `## RENAMED {Section}`:

```markdown
FROM: ### Old Name
TO: ### New Name
```

A `## RENAMED {Section}` block may contain multiple rename entries as repeated `FROM:` / `TO:` pairs, optionally separated by blank lines.

**`decisions.md` template (new):**
```markdown
## <!-- Topic -->

**Q:** <!-- Question that came up -->

- <!-- Option A -->
- **Option B** — <!-- chosen option -->
- <!-- Option C -->

**A:** <!-- Answer with rationale -->
```

### Skill and command template updates

The workflow templates in `src/core/templates/workflows/` embed instruction text that references the old format. Each needs updating:

- **`propose.ts`** — change artifact descriptions from "proposal.md (what & why)" to Problem/Constraints/Success Criteria/Non-goals. Add decisions.md as a sidecar artifact.
- **`apply-change.ts`** — update task parsing from checkbox format to task-section format. Look for `### Task N:` headings instead of `- [ ]` checkboxes.
- **`continue-change.ts`** (if exists) — update artifact format descriptions.
- **Skill generation** (`src/core/shared/skill-generation.ts`) — update any embedded format guidance.

### Markdown parser changes (`src/core/parsers/markdown-parser.ts`)

The `MarkdownParser.parseSpec` method currently expects `## Purpose` and `## Requirements` sections with `### Requirement:` blocks containing `#### Scenario:` children. Update to:
- Accept any `##` sections (not just Purpose + Requirements)
- Parse `###` blocks without requiring `Requirement:` prefix
- Don't require `#### Scenario:` children
- Return a generalized structure instead of `{ overview, requirements: Requirement[] }`

### Change parser changes (`src/core/parsers/change-parser.ts`)

The `ChangeParser.parseChangeWithDeltas` method currently expects `## Why` and `## What Changes` sections. Update to require `## Problem`, `## Constraints`, `## Success Criteria`, and `## Non-goals`.

Proposal structure is strict: exactly one of each required section, in canonical order, with no additional top-level `##` sections.

When no `specs/*/spec.md` files exist yet, `parseChangeWithDeltas` returns an empty `deltas` array instead of failing. This unblocks the `proposal -> design -> tasks -> specs` dependency chain.

### Apply-phase task tracking

The apply phase currently tracks progress by parsing `- [ ]` / `- [x]` checkboxes in tasks.md. Replace with `### Task N:` heading parsing and track completion by appending `— done` to the heading (waterfall style). Do not include legacy checkbox fallback logic.

### Status and progress commands

`openspec status` and apply instruction generation must parse task progress from heading markers (`### Task N: ...` and `— done` suffix), not checkboxes. This must work for both proposal/design/tasks-only changes and specs-last changes.

If `changes/<name>/specs/*/spec.md` is absent, status treats it as a valid pre-spec state and reports specs as not started (never as a parse/validation error).

Update both instruction parsing and status command surfaces (`src/commands/workflow/instructions.ts` and `src/commands/workflow/status.ts`) to keep reporting behavior consistent.

## Decisions

### Use `### Heading` as the universal block identifier instead of introducing a new prefix

The temptation is to replace `### Requirement:` with another prefix like `### Block:` or `### Behavior:`. But any prefix adds the same problem — forced vocabulary that may not fit every context. Plain `### Heading` is the most natural markdown and works for any content type.

**Trade-off:** Without a prefix, every `###` heading inside a `##` section becomes a merge target. This means you can't use `###` headings for non-mergeable substructure within a section. In practice this isn't a problem — if you need sub-headings within a block, use `####` or bold text.

## Non-goals

- Not changing the archive algorithm order (RENAMED → REMOVED → MODIFIED → ADDED)
- Not adding AI-mediated merging — the merge stays deterministic
- Not changing the CLI command interface (`openspec archive`, `validate`, `status`, etc.)
- Not changing directory structure (`openspec/specs/`, `openspec/changes/`)
- Not supporting the old `### Requirement: Name`, `#### Scenario:`, or checkbox-task formats
- Not building migration scripts for legacy specs/changes/docs
- Not changing how delta specs are discovered (scan `changes/{name}/specs/` for directories with `spec.md`)
