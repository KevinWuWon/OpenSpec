# Adopt Prose Artifact Style — Replace formal spec language with plain prose across all artifacts

## Problem

OpenSpec's artifact formats are over-structured for their audience. Spec files use RFC 2119 language (SHALL/MUST) with Requirement/Scenario/GIVEN-WHEN-THEN markup that reads like test cases, not documentation. It takes 11 scenarios to say "kebab-case only." Proposals use a freeform Why/What/Impact structure that doesn't force clear problem framing. Design documents mix architecture with exhaustive alternatives-considered sections. Tasks are bare checkbox lists with no acceptance criteria — the implementing agent has to cross-reference design.md to understand what "done" means.

The primary consumers of these artifacts are AI agents and the humans directing them. Agents don't need BDD ceremony to understand constraints — they infer edge cases from prose. Humans don't want to read `#### Scenario: Uppercase characters rejected` twelve times when a bullet point would do.

Meanwhile, Skiddee's waterfall skill system demonstrates a prose-first approach that produces more readable, higher-signal artifacts with the same (or better) coverage. Their requirements use Problem/Constraints/Success Criteria/Non-goals. Their blueprints combine architecture diagrams, data models, and tasks with inline acceptance criteria in a single document. Their decisions are captured as Q&A transcripts during the interview phase, not retrospectively documented in a design record.

## Constraints

- The delta spec merge system (ADDED/MODIFIED/REMOVED/RENAMED) must continue to work mechanically — the archive command applies deltas programmatically without AI involvement
- Delta merging relies on `### Heading` as the merge key; the parser needs a structural anchor in spec files
- Hard cutover only: parser, validator, templates, and workflows support the new prose format only (no dual-mode compatibility)
- Assume a clean repository with no legacy artifacts to migrate
- The CLI tooling (`openspec archive`, `openspec validate`, `openspec status`) must continue to function
- Skill and command templates that generate artifact content must be updated to produce the new format

## Success Criteria

- **Spec files** use prose organized under `###` headings (the merge key), with no Requirement/Scenario/GIVEN-WHEN-THEN markup or RFC 2119 keywords
- **Proposals** contain all four required sections (`## Problem`, `## Constraints`, `## Success Criteria`, `## Non-goals`) with trimmed non-empty content (empty/comment-only sections fail validation)
- **Proposal structure** is strict: exactly one of each required section, in canonical order, with no additional top-level `##` sections
- **Design files** adopt Overview/Architecture/Detailed Design/Non-goals structure — dropping exhaustive alternatives-considered sections in favor of a Decisions section used only when a choice is non-obvious
- **Task files** adopt numbered task sections with a paragraph description, explicit file lists, and inline acceptance criteria — replacing bare checkbox lists
- **Task progress tracking** uses content-based heading markers (`### Task N: ... — done`) as the source of truth
- **An optional decisions.md sidecar artifact** captures Q&A from the exploration/proposal phase as interview transcripts (question, options with chosen option marked, answer with rationale)
- **Delta specs** use `## ADDED {Section}` / `## MODIFIED {Section}` / `## REMOVED {Section}` / `## RENAMED {Section}`; `ADDED` may create missing target sections while `MODIFIED/REMOVED/RENAMED` require the target section to already exist
- **The delta parser** (`block-parser.ts`, renamed from `requirement-blocks.ts`) matches `### Heading` instead of `### Requirement: Name` — same algorithm, relaxed regex
- **Archive merging** works against any `##` section in the target spec, not only `## Requirements`
- **Section-level merge behavior** is deterministic: `ADDED {Section}` can create missing sections; `MODIFIED/REMOVED/RENAMED {Section}` fail when target section is missing
- **Brand-new spec behavior** is strict: initial sections are seeded only by `ADDED {Section}` entries; `MODIFIED/REMOVED/RENAMED` cannot create sections in a missing spec
- **Section insertion order** is deterministic: newly created sections are appended after existing sections in first-appearance order from delta parsing
- **RENAMED blocks** use canonical body entries (`FROM: ### Old Name` and `TO: ### New Name`)
- **Skill/command templates** generate artifacts in the new format
- **The openspec-conventions spec** is rewritten in the new prose style, serving as both the format definition and a reference example
- **Artifact dependency chain** simplifies from `proposal -> specs -> design -> tasks` to `proposal -> design -> tasks -> specs`, with optional decisions.md sidecar output during proposal
- **Change validation/parsing** allows proposal/design/tasks artifacts to exist before specs are written (zero deltas in pre-spec state), while still validating deltas once specs are authored
- **`openspec status`** correctly reports progress for proposal/design/tasks-only changes and for specs-last changes after delta specs are added
- **Missing specs are valid pre-spec state:** absence of `changes/<name>/specs/*/spec.md` is treated as "not started" by status, not as a parsing/validation error
- **Hard-cutover validation** rejects legacy markers (`### Requirement:`, `#### Scenario:`, and legacy rename body forms)

## Non-goals

- Not preserving backwards compatibility with the old `### Requirement: Name` / `#### Scenario:` / checkbox task formats
- Not providing migration tooling for legacy specs, changes, or docs
- Not changing the archive algorithm (RENAMED -> REMOVED -> MODIFIED -> ADDED order) — only the regex and section-matching logic change
- Not adding AI-mediated merging — the merge remains mechanical and deterministic
- Not changing the CLI command surface — `openspec archive`, `openspec validate`, etc. keep the same flags and behavior
- Not changing the directory structure — `openspec/specs/` and `openspec/changes/` stay the same
- Not adopting waterfall's execution engine, team management, or process state tracking — this change is about writing style only
