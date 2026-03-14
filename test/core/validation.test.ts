import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { Validator } from '../../src/core/validation/validator.js';
import {
  BlockSchema,
  SpecSchema,
  ChangeSchema,
  DeltaSchema
} from '../../src/core/schemas/index.js';

describe('Validation Schemas', () => {
  describe('BlockSchema', () => {
    it('should validate a block with text content', () => {
      const result = BlockSchema.safeParse({ text: 'Users can log in with email and password' });
      expect(result.success).toBe(true);
    });

    it('should reject a block with empty text', () => {
      const result = BlockSchema.safeParse({ text: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Block text cannot be empty');
      }
    });

    it('should pass a block with no SHALL/MUST (format enforcement dropped)', () => {
      const result = BlockSchema.safeParse({ text: 'The system provides user authentication' });
      expect(result.success).toBe(true);
    });
  });

  describe('SpecSchema', () => {
    it('should validate a spec with sections and blocks', () => {
      const spec = {
        name: 'user-auth',
        sections: {
          'Behavior': {
            blocks: [
              { name: 'Login', text: 'Users can log in with email and password' },
            ],
          },
        },
      };
      const result = SpecSchema.safeParse(spec);
      expect(result.success).toBe(true);
    });

    it('should validate a spec with multiple sections', () => {
      const spec = {
        name: 'user-auth',
        sections: {
          'Behavior': {
            blocks: [
              { name: 'Login', text: 'Users can log in' },
              { name: 'Logout', text: 'Users can log out' },
            ],
          },
          'Data Model': {
            blocks: [
              { name: 'Sessions', text: 'Session tracking' },
            ],
          },
        },
      };
      const result = SpecSchema.safeParse(spec);
      expect(result.success).toBe(true);
    });

    it('should accept spec with sections that have no blocks', () => {
      const spec = {
        name: 'user-auth',
        sections: {
          'Overview': { blocks: [] },
          'Behavior': {
            blocks: [{ name: 'Login', text: 'Users log in' }],
          },
        },
      };
      const result = SpecSchema.safeParse(spec);
      expect(result.success).toBe(true);
    });
  });

  describe('ChangeSchema', () => {
    it('should accept a change with all proposal sections and empty deltas', () => {
      const change = {
        name: 'add-user-auth',
        problem: 'Need authentication',
        constraints: 'Must use OAuth',
        successCriteria: 'Users can log in',
        nonGoals: 'Not doing SSO',
        deltas: [],
      };
      const result = ChangeSchema.safeParse(change);
      expect(result.success).toBe(true);
    });

    it('should accept a change with deltas', () => {
      const change = {
        name: 'add-user-auth',
        problem: 'Need auth',
        constraints: 'OAuth only',
        successCriteria: 'Login works',
        nonGoals: 'No SSO',
        deltas: [
          {
            spec: 'user-auth',
            operation: 'ADDED',
            description: 'Add new user authentication spec',
          },
        ],
      };
      const result = ChangeSchema.safeParse(change);
      expect(result.success).toBe(true);
    });

    it('should reject change with too many deltas', () => {
      const deltas = Array.from({ length: 11 }, (_, i) => ({
        spec: `spec-${i}`,
        operation: 'ADDED' as const,
        description: `Add spec ${i}`,
      }));
      const change = {
        name: 'massive-change',
        problem: 'Big problem',
        constraints: 'None',
        successCriteria: 'Everything works',
        nonGoals: 'Nothing',
        deltas,
      };
      const result = ChangeSchema.safeParse(change);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Consider splitting changes with more than 10 deltas');
      }
    });

    it('should reject change missing required proposal fields', () => {
      const change = {
        name: 'add-user-auth',
        deltas: [],
      };
      const result = ChangeSchema.safeParse(change);
      expect(result.success).toBe(false);
    });
  });
});

describe('Validator', () => {
  const testDir = path.join(process.cwd(), 'test-validation-tmp');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('validateSpec', () => {
    it('should validate a spec with prose blocks in any ## section', async () => {
      const specContent = `# User Authentication Spec

## Behavior

### Login with email
Users can log in using their email address and password.

### Password reset
Users can request a password reset link via email.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const validator = new Validator();
      const report = await validator.validateSpec(specPath);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it('should validate a spec with multiple ## sections', async () => {
      const specContent = `# Full Spec

## Behavior

### Login
Users can log in.

## Data Model

### Sessions
Session tracking info.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const validator = new Validator();
      const report = await validator.validateSpec(specPath);

      expect(report.valid).toBe(true);
    });

    it('should reject a spec with no ## sections', async () => {
      const specContent = `# Just a Title

Some content without sections.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const validator = new Validator();
      const report = await validator.validateSpec(specPath);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('at least one ## section'))).toBe(true);
    });

    it('should detect duplicate ## section names', async () => {
      const specContent = `# Test Spec

## Behavior

### Login
Users can log in.

## Behavior

### Logout
Users can log out.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const validator = new Validator();
      const report = await validator.validateSpec(specPath);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Duplicate ## section name'))).toBe(true);
    });

    it('should detect duplicate ### block names within a section', async () => {
      const specContent = `# Test Spec

## Behavior

### Login
Users can log in with email.

### Login
Users can also log in with SSO.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const validator = new Validator();
      const report = await validator.validateSpec(specPath);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Duplicate ### block name'))).toBe(true);
    });
  });

  describe('validateChange with proposal sections', () => {
    it('should validate a change with all four proposal sections', async () => {
      const changeContent = `# Add User Authentication

## Problem
We need user authentication to secure the application and protect user data from unauthorized access.

## Constraints
Must integrate with the existing session management system. Cannot change the database schema.

## Success Criteria
Users can log in with email and password. Invalid credentials show a clear error message.

## Non-goals
We are not implementing social login or multi-factor authentication in this change.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      // Filter to only proposal-related issues
      const proposalIssues = report.issues.filter(i => i.path === 'proposal');
      expect(proposalIssues.filter(i => i.level === 'ERROR')).toHaveLength(0);
    });

    it('should reject a change missing required proposal sections', async () => {
      const changeContent = `# Add User Authentication

## Problem
We need user authentication to secure the application and protect user data from unauthorized access.

## Constraints
Must integrate with the existing session management system.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const missing = report.issues.filter(i => i.message.includes('Missing required proposal section'));
      expect(missing.length).toBe(2); // Success Criteria and Non-goals
    });

    it('should reject extra top-level sections', async () => {
      const changeContent = `# Add User Auth

## Problem
We need auth to secure the app and protect data from unauthorized access by malicious users.

## Constraints
Must integrate with sessions.

## Success Criteria
Users can log in with email and password. Invalid credentials show clear error messages.

## Non-goals
Not implementing social login.

## Notes
Some additional notes here.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const extra = report.issues.filter(i => i.message.includes('Unexpected top-level'));
      expect(extra.length).toBe(1);
    });

    it('should reject sections out of canonical order', async () => {
      const changeContent = `# Add User Auth

## Constraints
Must integrate with sessions.

## Problem
We need auth to secure the app and protect data from unauthorized access by malicious users.

## Success Criteria
Users can log in with email and password. Invalid credentials show clear error messages.

## Non-goals
Not implementing social login.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const orderIssue = report.issues.filter(i => i.message.includes('canonical order'));
      expect(orderIssue.length).toBe(1);
    });

    it('should reject empty or comment-only proposal sections', async () => {
      const changeContent = `# Add User Auth

## Problem
We need auth to secure the app and protect data from unauthorized access by malicious users.

## Constraints
<!-- TODO: fill this in -->

## Success Criteria
Users can log in with email and password. Invalid credentials show clear error messages.

## Non-goals
Not implementing social login.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const empty = report.issues.filter(i => i.message.includes('empty or contains only comments'));
      expect(empty.length).toBe(1);
      expect(empty[0].message).toContain('Constraints');
    });

    it('should reject duplicate proposal sections', async () => {
      const changeContent = `# Add User Auth

## Problem
We need auth to secure the app and protect data from unauthorized access by malicious users.

## Constraints
Must integrate with sessions.

## Problem
Actually the real problem is different.

## Success Criteria
Users can log in with email and password. Invalid credentials show clear error messages.

## Non-goals
Not implementing social login.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const dup = report.issues.filter(i => i.message.includes('Duplicate proposal section'));
      expect(dup.length).toBe(1);
    });

    it('should enforce minimum length for Problem section', async () => {
      const changeContent = `# Add User Auth

## Problem
Need auth.

## Constraints
Must integrate with sessions.

## Success Criteria
Users can log in with email and password. Invalid credentials show clear error messages.

## Non-goals
Not implementing social login.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const short = report.issues.filter(i => i.message.includes('Problem section must be at least'));
      expect(short.length).toBe(1);
    });

    it('should enforce minimum length for Success Criteria section', async () => {
      const changeContent = `# Add User Auth

## Problem
We need auth to secure the app and protect data from unauthorized access by malicious users.

## Constraints
Must integrate with sessions.

## Success Criteria
Users can log in.

## Non-goals
Not implementing social login.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const validator = new Validator();
      const report = await validator.validateChange(changePath);

      const short = report.issues.filter(i => i.message.includes('Success Criteria section must be at least'));
      expect(short.length).toBe(1);
    });
  });

  describe('validateChangeDeltaSpecs', () => {
    it('should accept a delta spec with prose blocks (no SHALL/MUST, no scenarios)', async () => {
      const changeDir = path.join(testDir, 'test-change');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### User Login
Users can log in with their email address and password.
The system validates credentials against the user database.

### Password Reset
Users can request a password reset link via email.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it('should reject legacy ### Requirement: headers', async () => {
      const changeDir = path.join(testDir, 'test-change-legacy');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### Requirement: User Login
Users can log in with their email address and password.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Legacy marker detected: "### Requirement:"'))).toBe(true);
    });

    it('should reject legacy #### Scenario: headers', async () => {
      const changeDir = path.join(testDir, 'test-change-scenario');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### User Login
Users can log in with their email.

#### Scenario: Successful login
Given a user with valid credentials
When they submit the login form
Then they are authenticated`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Legacy marker detected: "#### Scenario:"'))).toBe(true);
    });

    it('should reject legacy rename body format', async () => {
      const changeDir = path.join(testDir, 'test-change-rename');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## RENAMED Behavior

FROM: ### Requirement: Old Name
TO: ### Requirement: New Name`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Legacy marker detected: rename entries must use'))).toBe(true);
    });

    it('should reject blocks with no content after ### heading', async () => {
      const changeDir = path.join(testDir, 'test-change-empty');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### Empty Block

### Has Content
This block has content.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('missing block content'))).toBe(true);
    });

    it('should detect duplicate ### headers within a section', async () => {
      const changeDir = path.join(testDir, 'test-change-dup');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### Login
Users can log in.

### Login
A duplicate login block.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Duplicate block in ADDED'))).toBe(true);
    });

    it('should detect conflicting operations on same block within target section', async () => {
      const changeDir = path.join(testDir, 'test-change-conflict');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### Login
Users can log in with email.

## MODIFIED Behavior

### Login
Updated login behavior.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(false);
      expect(report.issues.some(i => i.message.includes('Block present in both MODIFIED and ADDED'))).toBe(true);
    });

    it('should accept empty deltas when no specs directory exists', async () => {
      const changeDir = path.join(testDir, 'test-change-no-specs');
      await fs.mkdir(changeDir, { recursive: true });

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      // No error about missing deltas when specs dir doesn't exist
      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });

    it('should validate multi-section deltas independently', async () => {
      const changeDir = path.join(testDir, 'test-change-multi');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## ADDED Behavior

### Login
Users can log in.

## ADDED Data Model

### Login
Login data model description.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      // Same block name in different sections is valid
      expect(report.valid).toBe(true);
    });

    it('should validate delta spec with mixed case headers', async () => {
      const changeDir = path.join(testDir, 'test-change-mixed-case');
      const specsDir = path.join(changeDir, 'specs', 'test-spec');
      await fs.mkdir(specsDir, { recursive: true });

      const deltaSpec = `# Test Spec

## Added Behavior

### Mixed Case Handling
The system supports mixed case delta headers.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

      const validator = new Validator(true);
      const report = await validator.validateChangeDeltaSpecs(changeDir);

      expect(report.valid).toBe(true);
      expect(report.summary.errors).toBe(0);
    });
  });

  describe('validateProposalSections (unit)', () => {
    const validator = new Validator();

    it('should pass with all four required sections in order', () => {
      const content = `# Change Name

## Problem
We need to fix a significant issue in the authentication system that causes security concerns.

## Constraints
Must not break existing sessions.

## Success Criteria
Users can log in securely. All existing sessions remain valid during the transition.

## Non-goals
Not implementing social login.`;

      const issues = validator.validateProposalSections(content);
      const errors = issues.filter(i => i.level === 'ERROR');
      expect(errors).toHaveLength(0);
    });

    it('should reject missing sections', () => {
      const content = `# Change Name

## Problem
We need to fix something in the system that is causing significant issues for users.`;

      const issues = validator.validateProposalSections(content);
      const missing = issues.filter(i => i.message.includes('Missing required'));
      expect(missing.length).toBe(3); // Constraints, Success Criteria, Non-goals
    });

    it('should reject all comment-only sections', () => {
      const content = `# Change Name

## Problem
<!-- placeholder -->

## Constraints
<!-- placeholder -->

## Success Criteria
<!-- placeholder -->

## Non-goals
<!-- placeholder -->`;

      const issues = validator.validateProposalSections(content);
      const empty = issues.filter(i => i.message.includes('empty or contains only comments'));
      expect(empty.length).toBe(4);
    });
  });
});
