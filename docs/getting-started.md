# Getting Started

This guide explains how OpenSpec works after you've installed and initialized it. For installation instructions, see the [main README](../README.md#quick-start).

## How It Works

OpenSpec helps you and your AI coding assistant agree on what to build before any code is written.

**Default quick path (core profile):**

```text
/opsx:propose ──► /opsx:apply ──► /opsx:archive
```

**Expanded path (custom workflow selection):**

```text
/opsx:new ──► /opsx:ff or /opsx:continue ──► /opsx:apply ──► /opsx:verify ──► /opsx:archive
```

The default global profile is `core`, which includes `propose`, `explore`, `apply`, and `archive`. You can enable the expanded workflow commands with `openspec config profile` and then `openspec update`.

## What OpenSpec Creates

After running `openspec init`, your project has this structure:

```
openspec/
├── specs/              # Source of truth (your system's behavior)
│   └── <domain>/
│       └── spec.md
├── changes/            # Proposed updates (one folder per change)
│   └── <change-name>/
│       ├── proposal.md
│       ├── design.md
│       ├── tasks.md
│       └── specs/      # Delta specs (what's changing)
│           └── <domain>/
│               └── spec.md
└── config.yaml         # Project configuration (optional)
```

**Two key directories:**

- **`specs/`** - The source of truth. These specs describe how your system currently behaves. Organized by domain (e.g., `specs/auth/`, `specs/payments/`).

- **`changes/`** - Proposed modifications. Each change gets its own folder with all related artifacts. When a change is complete, its specs merge into the main `specs/` directory.

## Understanding Artifacts

Each change folder contains artifacts that guide the work:

| Artifact | Purpose |
|----------|---------|
| `proposal.md` | The "why" — problem, constraints, success criteria, non-goals |
| `design.md` | The "how" — overview, architecture, detailed design, non-goals |
| `tasks.md` | The "steps" — named tasks with files and acceptance criteria |
| `specs/` | Delta specs showing ADDED/MODIFIED/REMOVED/RENAMED behaviors |

**Artifacts build on each other:**

```
proposal ──► design ──► tasks ──► specs ──► implement
   ▲           ▲          ▲                    │
   └───────────┴──────────┴────────────────────┘
            update as you learn
```

You can always go back and refine earlier artifacts as you learn more during implementation.

## How Delta Specs Work

Delta specs are the key concept in OpenSpec. They show what's changing relative to your current specs.

### The Format

Delta specs use sections to indicate the type of change:

```markdown
# Delta for Auth

## ADDED Behavior

### Two-Factor Authentication
The system requires a second factor during login. When a user with 2FA
enabled submits valid credentials, an OTP challenge is presented and
login completes only after a valid OTP.

## MODIFIED Behavior

### Session Timeout
Sessions expire after 30 minutes of inactivity. When 30 minutes pass
without activity, the session is invalidated.
(Previously: 60 minutes)

## REMOVED Behavior

### Remember Me
**Reason:** Deprecated in favor of 2FA.
**Migration:** Users should re-authenticate each session.
```

### What Happens on Archive

When you archive a change:

1. **ADDED** blocks are appended to the matching `##` section in the main spec
2. **MODIFIED** blocks replace the existing `###` block by heading match
3. **REMOVED** blocks are deleted from the main spec

The change folder moves to `openspec/changes/archive/` for audit history.

## Example: Your First Change

Let's walk through adding dark mode to an application.

### 1. Start the Change (Default)

```text
You: /opsx:propose add-dark-mode

AI:  Created openspec/changes/add-dark-mode/
     ✓ proposal.md — problem, constraints, success criteria
     ✓ design.md    — technical approach
     ✓ tasks.md     — implementation plan
     ✓ specs/       — delta specs for behavior changes
     Ready for implementation!
```

If you've enabled the expanded workflow profile, you can also do this as two steps: `/opsx:new` then `/opsx:ff` (or `/opsx:continue` incrementally).

### 2. What Gets Created

**proposal.md** — Captures why and what success looks like:

```markdown
# Proposal: Add Dark Mode

## Problem
Users report eye strain during nighttime usage. There is no way to
switch to a darker color scheme or detect system preferences.

## Constraints
- Must work with existing CSS architecture
- No additional runtime dependencies

## Success Criteria
- Users can toggle between light and dark themes
- System preference is detected on first load
- Preference persists across sessions via localStorage

## Non-goals
- Custom color themes (future work)
- Per-page theme overrides
```

**specs/ui/spec.md** — Delta showing new behaviors:

```markdown
# Delta for UI

## ADDED Behavior

### Theme Selection
Users can choose between light and dark themes. Clicking the theme
toggle switches the theme immediately and the preference persists
across sessions. On first load with no saved preference, the system's
preferred color scheme is used.
```

**tasks.md** — Implementation plan:

```markdown
# Tasks

### Task 1: Create theme infrastructure (feature)

Set up ThemeContext with light/dark state, CSS custom properties,
and localStorage persistence.

**Files:** `src/contexts/ThemeContext.tsx`, `src/styles/globals.css`
**Acceptance criteria:**
- ThemeContext provides current theme and toggle function
- CSS variables switch when theme changes
- Preference survives page reload

### Task 2: Build UI components (feature)

Create ThemeToggle component and wire it into settings and header.

**Files:** `src/components/ThemeToggle.tsx`, `src/pages/Settings.tsx`
**Acceptance criteria:**
- Toggle switches theme immediately on click
- Toggle reflects current theme state

### Task 3: Define dark theme palette (feature)

Define dark color palette and update components to use CSS variables.

**Files:** `src/styles/globals.css`, `src/styles/themes.css`
**Acceptance criteria:**
- All text meets WCAG AA contrast ratios in dark mode
```

### 3. Implement

```
You: /opsx:apply

AI:  Working through tasks...
     ✓ 1.1 Created ThemeContext with light/dark state
     ✓ 1.2 Added CSS custom properties to globals.css
     ✓ 1.3 Implemented localStorage persistence
     ✓ 2.1 Created ThemeToggle component
     ...
     All tasks complete!
```

During implementation, if you discover the design needs adjustment, just update the artifact and continue.

### 4. Archive

```
You: /opsx:archive

AI:  Archiving add-dark-mode...
     ✓ Merged specs into openspec/specs/ui/spec.md
     ✓ Moved to openspec/changes/archive/2025-01-24-add-dark-mode/
     Done! Ready for the next feature.
```

Your delta specs are now part of the main specs, documenting how your system works.

## Verifying and Reviewing

Use the CLI to check on your changes:

```bash
# List active changes
openspec list

# View change details
openspec show add-dark-mode

# Validate spec formatting
openspec validate add-dark-mode

# Interactive dashboard
openspec view
```

## Next Steps

- [Workflows](workflows.md) - Common patterns and when to use each command
- [Commands](commands.md) - Full reference for all slash commands
- [Concepts](concepts.md) - Deeper understanding of specs, changes, and schemas
- [Customization](customization.md) - Make OpenSpec work your way
