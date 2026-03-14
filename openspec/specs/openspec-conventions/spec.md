# OpenSpec Conventions

## Purpose

OpenSpec conventions define how system capabilities are documented, how changes are proposed and tracked, and how specifications evolve over time. This meta-specification serves as the source of truth for OpenSpec's own conventions — and uses the format it describes.

## Spec Format

### Writing Style

Specs use plain prose organized under `###` headings within `##` sections. There is no formal markup — no `### Requirement:` prefix, no `#### Scenario:` blocks, no GIVEN/WHEN/THEN keywords, no RFC 2119 language (SHALL/MUST). Describe behavior in natural language. Agents infer edge cases from prose; humans can scan it.

### Heading Structure

A spec starts with a `# Title` heading. Content is organized into `##` sections, each containing one or more `###` blocks. The `###` heading text is the merge key — the unique identifier used by the delta system to match blocks between specs and deltas. Heading text is matched case-sensitively after trimming whitespace.

Each `###` block contains prose describing one coherent concept, behavior, or constraint. Use `####` or bold text for sub-structure within a block — never `###`, since every `###` heading is a merge target.

No duplicate `###` headings are allowed within a single `##` section. The same `###` heading may appear in different `##` sections.

### Behavior-First Content

Specs capture externally observable behavior, interfaces, error handling, and constraints. Implementation details — library choices, class structure, execution mechanics — belong in `design.md`, not in specs.

### Progressive Rigor

Specs stay lightweight by default. When a change is local and low-risk, use concise prose with minimal ceremony. When a change is cross-team, API-breaking, migration-heavy, or security-sensitive, increase detail proportionally.

## Delta Operations

### Delta Format

Delta specs express changes to a target spec using operation-prefixed section headers:

- `## ADDED {SectionName}` — adds new `###` blocks. Creates the target `##` section if it doesn't exist.
- `## MODIFIED {SectionName}` — replaces existing `###` blocks by heading match. The target section must exist.
- `## REMOVED {SectionName}` — removes `###` blocks by heading match. The target section must exist.
- `## RENAMED {SectionName}` — renames `###` blocks within the section. The target section must exist.

Repeated operation headers targeting the same section are valid and aggregated into a single plan. Conflicting operations on the same `###` block within a section are invalid.

### Rename Entries

Renamed blocks use canonical body entries:

```
FROM: ### Old Name
TO: ### New Name
```

A `## RENAMED {Section}` block may contain multiple rename entries as repeated `FROM:` / `TO:` pairs. If content also changes, include the block under `## MODIFIED {Section}` using the new name.

### Archive Process

Archiving applies deltas to the current spec programmatically:

1. Parse `RENAMED` sections and apply renames
2. Parse `REMOVED` sections and remove by heading match
3. Parse `MODIFIED` sections and replace by heading match (using new names if renamed)
4. Parse `ADDED` sections and append new blocks

All `MODIFIED`, `REMOVED`, and `RENAMED` headings must exist in the current spec. All `ADDED` headings must not already exist. Conflicts require manual resolution.

For new specs (target doesn't exist), only `ADDED` sections seed the skeleton. `MODIFIED`, `REMOVED`, and `RENAMED` cannot create sections in a missing spec.

Newly created sections append after existing sections in first-appearance order from delta parsing. Existing sections keep their original order.

### Output Symbols

CLI output uses these symbols for delta operations:

- `+` for ADDED (green)
- `~` for MODIFIED (yellow)
- `-` for REMOVED (red)
- `→` for RENAMED (cyan)

## Project Structure

### Directory Layout

An OpenSpec project maintains this structure:

```
openspec/
├── project.md              # Project-specific context
├── AGENTS.md               # AI assistant instructions
├── specs/                  # Current deployed capabilities
│   └── [capability]/       # Single, focused capability
│       ├── spec.md         # WHAT and WHY
│       └── design.md       # HOW (optional)
└── changes/                # Proposed changes
    ├── [change-name]/      # Descriptive change identifier
    │   ├── proposal.md     # Problem framing
    │   ├── design.md       # Technical blueprint (optional)
    │   ├── tasks.md        # Implementation plan
    │   ├── decisions.md    # Q&A from exploration (optional)
    │   └── specs/          # Delta specs
    │       └── [capability]/
    │           └── spec.md # Delta operations only
    └── archive/            # Completed changes
        └── YYYY-MM-DD-[name]/
```

### Capability Naming

Capabilities use verb-noun patterns (e.g., `user-auth`, `payment-capture`), hyphenated lowercase names, singular focus (one responsibility per capability), and a flat structure under `specs/`.

### Core Principles

Specs reflect what is currently built and deployed. Changes contain proposals for what should change. AI drives the documentation process. Specs are living documentation kept in sync with deployed code.

## Proposal Format

### Proposal Structure

Proposals use four required sections in this order:

1. `## Problem` — what's broken or missing, and why it matters
2. `## Constraints` — hard boundaries, technical limits, what can't change
3. `## Success Criteria` — observable outcomes when done, user-visible statements
4. `## Non-goals` — what is explicitly not being built

All four sections are required. Empty or comment-only sections fail validation. No additional top-level `##` sections are allowed. `Problem` and `Success Criteria` have stronger minimum content thresholds.

### When Proposals Are Required

A proposal is created for new features or capabilities, breaking changes, architecture or pattern changes, performance optimizations that change behavior, and security updates affecting access patterns.

A proposal is not required for bug fixes restoring intended behavior, typos or formatting fixes, non-breaking dependency updates, adding tests for existing behavior, or documentation clarifications.

## Design Format

### Design Structure

Design files use these sections:

1. `## Overview` — one paragraph describing what and why
2. `## Architecture` — diagrams, data flow, system structure
3. `## Detailed Design` — organized by concept: data models, APIs, integration points
4. `## Non-goals` — what this design explicitly avoids

An optional `## Decisions` section captures implementation-relevant choices that need to stay visible in the blueprint.

## Task Format

### Task Structure

Each task is a `###` heading with this format:

```
### Task N: Name (type)

What to implement, where, and why.

**Files:** paths
**Acceptance criteria:**
- criterion
```

The type annotation (`feature`, `refactoring`) tells the implementing agent whether it's building new or restructuring existing code. Completion is marked by appending ` — done` to the task heading.

## Decisions Format

### Decisions Structure

The decisions artifact captures Q&A from the exploration and proposal phase. Each entry contains a question, options with the chosen option bolded, and an answer with rationale:

```
## Topic

**Q:** Question that came up

- Option A
- **Option B** — chosen option
- Option C

**A:** Answer with rationale
```

## Change Lifecycle

### Lifecycle States

The artifact dependency chain is: `proposal → design → tasks → specs`. The optional `decisions.md` is a sidecar produced during the proposal phase.

The change process follows these states:

1. **Propose** — frame the problem, explore decisions, define success criteria
2. **Design** — create the technical blueprint
3. **Implement** — follow the task plan (can span multiple PRs)
4. **Spec** — write delta specs capturing the behavioral changes
5. **Deploy** — changes are deployed to production
6. **Update** — specs in `specs/` are updated via archive to match deployed reality
7. **Archive** — change is moved to `archive/YYYY-MM-DD-[name]/`

A change containing only proposal, design, and tasks artifacts (no spec deltas yet) is valid. Delta enforcement activates once spec artifacts are present.

## CLI Conventions

### Verb-Noun Command Structure

The CLI uses verbs as top-level commands with nouns as arguments or flags for scoping. For example, `openspec list` communicates the action, and `--changes` or `--specs` refines scope.

### Disambiguation

When item names are ambiguous between changes and specs, `openspec show` and `openspec validate` accept `--type spec|change`. Help text documents this clearly.
