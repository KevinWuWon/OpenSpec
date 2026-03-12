# Adopt Prose Artifact Style — Decisions

Questions asked and answers selected during proposal and exploration.

## Spec File Format

**Q:** What format should spec files use instead of Requirement/Scenario/GIVEN-WHEN-THEN?

- **Plain prose under `###` headings** — describe behavior in natural language, organized by concept. Headings serve as merge keys for the delta system.
- Keep Requirement/Scenario structure but drop GIVEN/WHEN/THEN keywords — less verbose but still structured.
- Freeform markdown with no heading constraints — maximum flexibility but breaks mechanical merging.

**A:** Plain prose under `###` headings. Agents infer edge cases from prose; humans can scan it. The `###` headings preserve the merge key contract needed by the delta system. The parser regex changes from `^###\s*Requirement:\s*(.+)` to `^###\s+(.+)` — same algorithm, relaxed pattern.

## Delta Spec Section Targeting

**Q:** Should delta specs target only `## Requirements` sections, or any `##` section in the target spec?

- **Any `##` section** — delta headers like `## ADDED Behavior`, `## MODIFIED Data Model` reference the target section by name. Parser strips the operation prefix to find the target.
- Keep `## Requirements` as the only mergeable section — simpler but forces all content into one section.

**A:** Any `##` section. Prose specs naturally organize into multiple sections (`## Behavior`, `## Data Model`, `## Admin Operations`). Locking everything into `## Requirements` was an artifact of the formal format. The parser change is small — match `## (ADDED|MODIFIED|REMOVED|RENAMED)\s+(.+)` and use the captured group to find the target section.

## Proposal Format

**Q:** What structure should proposals use?

- **Problem / Constraints / Success Criteria / Non-goals** — waterfall's requirements format. Forces clear problem framing with explicit boundaries.
- Keep Why / What Changes / Capabilities / Impact — OpenSpec's current freeform format.
- Single narrative document — no structure, just prose.

**A:** Problem / Constraints / Success Criteria / Non-goals. The structured sections force better thinking: Problem defines why, Constraints define boundaries, Success Criteria define done, Non-goals prevent scope creep. Non-goals appear in both proposal (scoping the problem) and design (scoping the solution) — intentional, different audiences.

## Design File Format

**Q:** What structure should design files use?

- **Overview / Architecture / Detailed Design / Non-goals** with an optional Decisions section for non-obvious choices — waterfall's blueprint structure minus the tasks.
- Keep Context / Goals / Decisions / Risks / Migration — OpenSpec's current decision-record format.
- Combined blueprint with tasks — single file for everything.

**A:** Overview / Architecture / Detailed Design / Non-goals with optional Decisions section. Architecture diagrams and data model tables front and center. Decisions section only included when a choice is non-obvious and worth recording — not every decision needs alternatives-considered.

## Design and Tasks: Separate or Combined?

**Q:** Should design.md and tasks.md be merged into a single blueprint.md (like waterfall) or stay separate?

- Combined blueprint.md — one file with design + tasks. Waterfall's approach. Single source of truth.
- **Separate design.md and tasks.md** — design is reviewed independently; tasks can be handed to an implementing agent without design context it doesn't need; each file is shorter and easier to scan.

**A:** Separate. The combined blueprint works for waterfall because their execution engine spawns workers that get pasted individual tasks from it. OpenSpec doesn't have that constraint. Separate files serve different audiences at different times.

## Task File Format

**Q:** What format should tasks use?

- **Numbered task sections** with paragraph descriptions, explicit file lists, and inline acceptance criteria — waterfall's task format.
- Keep checkbox lists with hierarchical IDs (1.1, 1.2) — OpenSpec's current format.
- Kanban-style with status columns — overkill for a text file.

**A:** Numbered task sections. Each task gets a heading (`### Task N: Name (type)`), a paragraph describing what to implement, a `**Files:**` list scoping the work, and `**Acceptance criteria:**` bullets defining done. Type annotation (`feature`, `refactoring`) tells the agent whether it's building new or restructuring. Completion is content-based by appending `— done` to the task heading.

## Proposal Section Strictness

**Q:** Should proposal validation require all four sections or only `## Problem`?

- Require only `## Problem` and treat the rest as guidance.
- **Require all four sections** (`## Problem`, `## Constraints`, `## Success Criteria`, `## Non-goals`) for deterministic quality.

**A:** Require all four sections. OpenSpec benefits from predictable, machine-checkable structure; waterfall benefits from explicit framing. `Problem` and `Success Criteria` should have stronger minimum content thresholds, while `Constraints` and `Non-goals` still must be present and non-empty.

## Decisions Artifact

**Q:** How should design decisions and their rationale be captured?

- **Separate decisions.md with Q&A format** — produced during the proposal/exploration phase as the agent interviews the user. Each entry: question, options (chosen bolded), answer with rationale.
- Alternatives-considered sections in design.md — OpenSpec's current approach. Retrospectively documented.
- No formal decision tracking — decisions are implicit in the design.

**A:** Separate decisions.md. Decisions are interview output that happens naturally during exploration, not a deliverable authored after the fact. Keeps design.md clean and implementation-focused. If you want to know *why* a choice was made, look at decisions.md.

## Cutover Strategy

**Q:** Should we support legacy artifact formats during rollout?

- Dual-mode parser/validator — support old and new formats simultaneously.
- Build migration tooling to rewrite old specs/changes/docs before enforcing the new format.
- **Hard cutover with no migration** — support only the new prose format and assume no legacy files exist.

**A:** Hard cutover with no migration. Supporting dual formats adds long-term parser/validator complexity and weakens format guarantees. Migration tooling adds one-time implementation cost and risk we don't need under a clean-repo assumption. This change treats legacy artifacts as out of scope.

## File Naming

**Q:** Should design.md be renamed to blueprint.md to match waterfall's terminology?

- Rename to blueprint.md — adopts waterfall's term.
- **Keep design.md** — OpenSpec already uses it, renaming adds churn with no benefit. The content changes, the name stays.

**A:** Keep design.md. "Blueprint" is waterfall's term and carries its connotations. The improvement is in the content format, not the filename.
