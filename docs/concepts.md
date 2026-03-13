# Concepts

This guide explains the core ideas behind OpenSpec and how they fit together. For practical usage, see [Getting Started](getting-started.md) and [Workflows](workflows.md).

## Philosophy

OpenSpec is built around four principles:

```
fluid not rigid       — no phase gates, work on what makes sense
iterative not waterfall — learn as you build, refine as you go
easy not complex      — lightweight setup, minimal ceremony
brownfield-first      — works with existing codebases, not just greenfield
```

### Why These Principles Matter

**Fluid not rigid.** Traditional spec systems lock you into phases: first you plan, then you implement, then you're done. OpenSpec is more flexible — you can create artifacts in any order that makes sense for your work.

**Iterative not waterfall.** Requirements change. Understanding deepens. What seemed like a good approach at the start might not hold up after you see the codebase. OpenSpec embraces this reality.

**Easy not complex.** Some spec frameworks require extensive setup, rigid formats, or heavyweight processes. OpenSpec stays out of your way. Initialize in seconds, start working immediately, customize only if you need to.

**Brownfield-first.** Most software work isn't building from scratch — it's modifying existing systems. OpenSpec's delta-based approach makes it easy to specify changes to existing behavior, not just describe new systems.

## The Big Picture

OpenSpec organizes your work into two main areas:

```
┌─────────────────────────────────────────────────────────────────┐
│                        openspec/                                 │
│                                                                  │
│   ┌─────────────────────┐      ┌──────────────────────────────┐ │
│   │       specs/        │      │         changes/              │ │
│   │                     │      │                               │ │
│   │  Source of truth    │◄─────│  Proposed modifications       │ │
│   │  How your system    │ merge│  Each change = one folder     │ │
│   │  currently works    │      │  Contains artifacts + deltas  │ │
│   │                     │      │                               │ │
│   └─────────────────────┘      └──────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Specs** are the source of truth — they describe how your system currently behaves.

**Changes** are proposed modifications — they live in separate folders until you're ready to merge them.

This separation is key. You can work on multiple changes in parallel without conflicts. You can review a change before it affects the main specs. And when you archive a change, its deltas merge cleanly into the source of truth.

## Specs

Specs describe your system's behavior using plain prose organized under named headings.

### Structure

```
openspec/specs/
├── auth/
│   └── spec.md           # Authentication behavior
├── payments/
│   └── spec.md           # Payment processing
├── notifications/
│   └── spec.md           # Notification system
└── ui/
    └── spec.md           # UI behavior and themes
```

Organize specs by domain — logical groupings that make sense for your system. Common patterns:

- **By feature area**: `auth/`, `payments/`, `search/`
- **By component**: `api/`, `frontend/`, `workers/`
- **By bounded context**: `ordering/`, `fulfillment/`, `inventory/`

### Spec Format

A spec uses plain prose organized under `##` sections with `###` blocks as merge keys:

```markdown
# Auth Specification

## Purpose
Authentication and session management for the application.

## Behavior

### User Authentication
The system issues a JWT token upon successful login. When a user submits
valid credentials, a JWT token is returned and the user is redirected to
the dashboard. When credentials are invalid, an error message is displayed
and no token is issued.

### Session Expiration
Sessions expire after 30 minutes of inactivity. When 30 minutes pass
without activity, the session is invalidated and the user must
re-authenticate.
```

**Key elements:**

| Element | Purpose |
|---------|---------|
| `## Purpose` | High-level description of this spec's domain |
| `## Behavior` (or other `##` sections) | Groups of related behaviors |
| `### Name` | A specific behavior — the heading text is the merge key |

### Why Structure Specs This Way

**Plain prose is easier to read and write.** No special markup or keywords to remember — just describe the behavior in natural language.

**`###` headings are merge keys.** The delta system uses `###` heading text to match blocks between specs and deltas. This makes merging predictable without requiring formal identifiers.

**`##` sections organize related behaviors.** Group behaviors into logical sections like `## Behavior`, `## Error Handling`, `## Security`. Delta operations target these sections (e.g., `## ADDED Behavior`).

### What a Spec Is (and Is Not)

A spec is a **behavior contract**, not an implementation plan.

Good spec content:
- Observable behavior users or downstream systems rely on
- Inputs, outputs, and error conditions
- External constraints (security, privacy, reliability, compatibility)
- Concrete examples that can be tested or validated

Avoid in specs:
- Internal class/function names
- Library or framework choices
- Step-by-step implementation details
- Detailed execution plans (those belong in `design.md` or `tasks.md`)

Quick test:
- If implementation can change without changing externally visible behavior, it likely does not belong in the spec.

### Keep It Lightweight: Progressive Rigor

OpenSpec aims to avoid bureaucracy. Use the lightest level that still makes the change verifiable.

**Lite spec (default):**
- Short behavior-first requirements
- Clear scope and non-goals
- A few concrete acceptance checks

**Full spec (for higher risk):**
- Cross-team or cross-repo changes
- API/contract changes, migrations, security/privacy concerns
- Changes where ambiguity is likely to cause expensive rework

Most changes should stay in Lite mode.

### Human + Agent Collaboration

In many teams, humans explore and agents draft artifacts. The intended loop is:

1. Human provides intent, context, and constraints.
2. Agent converts this into behavior descriptions in plain prose.
3. Agent keeps implementation detail in `design.md` and `tasks.md`, not `spec.md`.
4. Validation confirms structure and clarity before implementation.

This keeps specs readable for humans and consistent for agents.

## Changes

A change is a proposed modification to your system, packaged as a folder with everything needed to understand and implement it.

### Change Structure

```
openspec/changes/add-dark-mode/
├── proposal.md           # Why and what
├── design.md             # How (technical approach)
├── tasks.md              # Implementation checklist
├── .openspec.yaml        # Change metadata (optional)
└── specs/                # Delta specs
    └── ui/
        └── spec.md       # What's changing in ui/spec.md
```

Each change is self-contained. It has:
- **Artifacts** — documents that capture intent, design, and tasks
- **Delta specs** — specifications for what's being added, modified, or removed
- **Metadata** — optional configuration for this specific change

### Why Changes Are Folders

Packaging a change as a folder has several benefits:

1. **Everything together.** Proposal, design, tasks, and specs live in one place. No hunting through different locations.

2. **Parallel work.** Multiple changes can exist simultaneously without conflicting. Work on `add-dark-mode` while `fix-auth-bug` is also in progress.

3. **Clean history.** When archived, changes move to `changes/archive/` with their full context preserved. You can look back and understand not just what changed, but why.

4. **Review-friendly.** A change folder is easy to review — open it, read the proposal, check the design, see the spec deltas.

## Artifacts

Artifacts are the documents within a change that guide the work.

### The Artifact Flow

```
proposal ──────► design ──────► tasks ──────► specs ──────► implement
    │               │             │              │
   why             how          steps          what
 + scope        approach      to take       changes
```

Artifacts build on each other. Each artifact provides context for the next. Specs come last — they capture what changed after you know the implementation plan.

### Artifact Types

#### Proposal (`proposal.md`)

The proposal captures **why** this change matters and **what success looks like**.

```markdown
# Proposal: Add Dark Mode

## Problem
Users report eye strain during nighttime usage. There is no way to
switch to a darker color scheme or detect system preferences.

## Constraints
- Must work with existing CSS architecture
- No additional runtime dependencies
- Must not break existing theme

## Success Criteria
- Users can toggle between light and dark themes
- System preference is detected on first load
- Preference persists across sessions via localStorage

## Non-goals
- Custom color themes (future work)
- Per-page theme overrides
```

**When to update the proposal:**
- Scope changes (narrowing or expanding)
- Problem understanding deepens
- Constraints change

#### Specs (delta specs in `specs/`)

Delta specs describe **what's changing** relative to the current specs. See [Delta Specs](#delta-specs) below.

#### Design (`design.md`)

The design captures **how** the change will be implemented.

````markdown
# Design: Add Dark Mode

## Overview
Add theme switching using React Context for state and CSS custom
properties for styling. Detect system preference on first load,
persist user choice in localStorage.

## Architecture
```
ThemeProvider (context)
       │
       ▼
ThemeToggle ◄──► localStorage
       │
       ▼
CSS Variables (applied to :root)
```

## Detailed Design

### Theme state management
React Context holds the current theme (light/dark). Chosen over
Redux because it's simple binary state with no complex transitions.

### CSS custom properties
CSS variables on `:root` enable runtime switching without class
toggling. Works with existing stylesheets, no runtime overhead.

### File changes
- `src/contexts/ThemeContext.tsx` (new)
- `src/components/ThemeToggle.tsx` (new)
- `src/styles/globals.css` (modified)

## Non-goals
- CSS-in-JS migration
- Server-side theme rendering
````

**When to update the design:**
- Implementation reveals the approach won't work
- Better solution discovered
- Dependencies or constraints change

#### Tasks (`tasks.md`)

Tasks are the **implementation plan** — concrete steps with files and acceptance criteria.

```markdown
# Tasks

### Task 1: Create theme infrastructure (feature)

Set up ThemeContext with light/dark state, CSS custom properties
for colors, localStorage persistence, and system preference detection.

**Files:** `src/contexts/ThemeContext.tsx`, `src/styles/globals.css`
**Acceptance criteria:**
- ThemeContext provides current theme and toggle function
- CSS variables switch when theme changes
- Preference survives page reload

### Task 2: Build UI components (feature)

Create ThemeToggle component and add it to settings page and header.

**Files:** `src/components/ThemeToggle.tsx`, `src/pages/Settings.tsx`, `src/components/Header.tsx`
**Acceptance criteria:**
- Toggle switches theme immediately on click
- Toggle reflects current theme state

### Task 3: Define dark theme palette (feature)

Define dark theme color palette and update components to use CSS variables.
Test contrast ratios for accessibility.

**Files:** `src/styles/globals.css`, `src/styles/themes.css`
**Acceptance criteria:**
- All text meets WCAG AA contrast ratios in dark mode
- No hard-coded colors remain in component styles
```

**Task best practices:**
- Each task has a name, type, files, and acceptance criteria
- Keep tasks small enough to complete in one session
- Append ` — done` to the heading when complete

## Delta Specs

Delta specs are the key concept that makes OpenSpec work for brownfield development. They describe **what's changing** rather than restating the entire spec.

### The Format

```markdown
# Delta for Auth

## ADDED Behavior

### Two-Factor Authentication
The system supports TOTP-based two-factor authentication. When a user
without 2FA enabled turns it on in settings, a QR code is displayed
for authenticator app setup, and the user must verify with a code
before activation. When a user with 2FA enabled submits valid
credentials, an OTP challenge is presented and login completes only
after a valid OTP.

## MODIFIED Behavior

### Session Expiration
Sessions expire after 15 minutes of inactivity. When 15 minutes pass
without activity, the session is invalidated.
(Previously: 30 minutes)

## REMOVED Behavior

### Remember Me
**Reason:** Deprecated in favor of 2FA.
**Migration:** Users should re-authenticate each session.
```

### Delta Sections

| Section | Meaning | What Happens on Archive |
|---------|---------|------------------------|
| `## ADDED {Section}` | New behavior | Appended to matching `##` section in main spec |
| `## MODIFIED {Section}` | Changed behavior | Replaces existing `###` block by heading match |
| `## REMOVED {Section}` | Deprecated behavior | Deleted from main spec |
| `## RENAMED {Section}` | Renamed block | Updates the `###` heading text |

### Why Deltas Instead of Full Specs

**Clarity.** A delta shows exactly what's changing. Reading a full spec, you'd have to diff it mentally against the current version.

**Conflict avoidance.** Two changes can touch the same spec file without conflicting, as long as they modify different requirements.

**Review efficiency.** Reviewers see the change, not the unchanged context. Focus on what matters.

**Brownfield fit.** Most work modifies existing behavior. Deltas make modifications first-class, not an afterthought.

## Schemas

Schemas define the artifact types and their dependencies for a workflow.

### How Schemas Work

```yaml
# openspec/schemas/spec-driven/schema.yaml
name: spec-driven
artifacts:
  - id: proposal
    generates: proposal.md
    requires: []              # No dependencies, can create first

  - id: design
    generates: design.md
    requires: [proposal]      # Needs proposal before creating

  - id: tasks
    generates: tasks.md
    requires: [design]        # Needs design before creating

  - id: specs
    generates: specs/**/*.md
    requires: [tasks]         # Comes last, after implementation plan
```

**Artifacts form a dependency chain:**

```
proposal ──► design ──► tasks ──► specs
   │            │          │         │
  why          how       steps     what
+ scope     approach    to take  changes
```

**Dependencies are enablers, not gates.** They show what's possible to create, not what you must create next. You can skip design if you don't need it. A change with only `proposal + design + tasks` (no specs) is valid — delta enforcement activates only once spec artifacts are present.

### Built-in Schemas

**spec-driven** (default)

The standard workflow for spec-driven development:

```
proposal → design → tasks → specs → implement
```

Best for: Most feature work where you want to plan the approach, define tasks, then capture spec changes.

### Custom Schemas

Create custom schemas for your team's workflow:

```bash
# Create from scratch
openspec schema init research-first

# Or fork an existing one
openspec schema fork spec-driven research-first
```

**Example custom schema:**

```yaml
# openspec/schemas/research-first/schema.yaml
name: research-first
artifacts:
  - id: research
    generates: research.md
    requires: []           # Do research first

  - id: proposal
    generates: proposal.md
    requires: [research]   # Proposal informed by research

  - id: tasks
    generates: tasks.md
    requires: [proposal]   # Skip specs/design, go straight to tasks
```

See [Customization](customization.md) for full details on creating and using custom schemas.

## Archive

Archiving completes a change by merging its delta specs into the main specs and preserving the change for history.

### What Happens When You Archive

```
Before archive:

openspec/
├── specs/
│   └── auth/
│       └── spec.md ◄────────────────┐
└── changes/                         │
    └── add-2fa/                     │
        ├── proposal.md              │
        ├── design.md                │ merge
        ├── tasks.md                 │
        └── specs/                   │
            └── auth/                │
                └── spec.md ─────────┘


After archive:

openspec/
├── specs/
│   └── auth/
│       └── spec.md        # Now includes 2FA requirements
└── changes/
    └── archive/
        └── 2025-01-24-add-2fa/    # Preserved for history
            ├── proposal.md
            ├── design.md
            ├── tasks.md
            └── specs/
                └── auth/
                    └── spec.md
```

### The Archive Process

1. **Merge deltas.** Each delta spec section (ADDED/MODIFIED/REMOVED) is applied to the corresponding main spec.

2. **Move to archive.** The change folder moves to `changes/archive/` with a date prefix for chronological ordering.

3. **Preserve context.** All artifacts remain intact in the archive. You can always look back to understand why a change was made.

### Why Archive Matters

**Clean state.** Active changes (`changes/`) shows only work in progress. Completed work moves out of the way.

**Audit trail.** The archive preserves the full context of every change — not just what changed, but the proposal explaining why, the design explaining how, and the tasks showing the work done.

**Spec evolution.** Specs grow organically as changes are archived. Each archive merges its deltas, building up a comprehensive specification over time.

## How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OPENSPEC FLOW                                   │
│                                                                              │
│   ┌────────────────┐                                                         │
│   │  1. START      │  /opsx:propose (core) or /opsx:new (expanded)          │
│   │     CHANGE     │                                                         │
│   └───────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│   ┌────────────────┐                                                         │
│   │  2. CREATE     │  /opsx:ff or /opsx:continue (expanded workflow)         │
│   │     ARTIFACTS  │  Creates proposal → design → tasks → specs              │
│   │                │  (based on schema dependencies)                         │
│   └───────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│   ┌────────────────┐                                                         │
│   │  3. IMPLEMENT  │  /opsx:apply                                            │
│   │     TASKS      │  Work through tasks, checking them off                  │
│   │                │◄──── Update artifacts as you learn                      │
│   └───────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│   ┌────────────────┐                                                         │
│   │  4. VERIFY     │  /opsx:verify (optional)                                │
│   │     WORK       │  Check implementation matches specs                     │
│   └───────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│   ┌────────────────┐     ┌──────────────────────────────────────────────┐   │
│   │  5. ARCHIVE    │────►│  Delta specs merge into main specs           │   │
│   │     CHANGE     │     │  Change folder moves to archive/             │   │
│   └────────────────┘     │  Specs are now the updated source of truth   │   │
│                          └──────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**The virtuous cycle:**

1. Specs describe current behavior
2. Changes propose modifications (as deltas)
3. Implementation makes the changes real
4. Archive merges deltas into specs
5. Specs now describe the new behavior
6. Next change builds on updated specs

## Glossary

| Term | Definition |
|------|------------|
| **Artifact** | A document within a change (proposal, design, tasks, or delta specs) |
| **Archive** | The process of completing a change and merging its deltas into main specs |
| **Block** | A `###` heading and its content — the merge key used by the delta system |
| **Change** | A proposed modification to the system, packaged as a folder with artifacts |
| **Decisions** | Optional Q&A artifact capturing design decisions made during planning |
| **Delta spec** | A spec that describes changes (ADDED/MODIFIED/REMOVED/RENAMED) relative to current specs |
| **Domain** | A logical grouping for specs (e.g., `auth/`, `payments/`) |
| **Schema** | A definition of artifact types and their dependencies |
| **Section** | A `##` heading in a spec that groups related `###` blocks |
| **Spec** | A specification describing system behavior in plain prose under named headings |
| **Source of truth** | The `openspec/specs/` directory, containing the current agreed-upon behavior |

## Next Steps

- [Getting Started](getting-started.md) - Practical first steps
- [Workflows](workflows.md) - Common patterns and when to use each
- [Commands](commands.md) - Full command reference
- [Customization](customization.md) - Create custom schemas and configure your project
