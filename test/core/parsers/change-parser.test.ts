import { describe, it, expect } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { ChangeParser } from '../../../src/core/parsers/change-parser.js';

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-change-parser-'));
  try {
    await run(dir);
  } finally {
    try { await fs.rm(dir, { recursive: true, force: true }); } catch {}
  }
}

function makeProposal(overrides: Partial<Record<'problem' | 'constraints' | 'successCriteria' | 'nonGoals', string>> = {}): string {
  return `# Test Change

## Problem
${overrides.problem ?? 'Something is broken and needs to be fixed for our users.'}

## Constraints
${overrides.constraints ?? 'Must not break existing functionality.'}

## Success Criteria
${overrides.successCriteria ?? 'The thing works correctly after the fix is applied.'}

## Non-goals
${overrides.nonGoals ?? 'Not doing extra work beyond the fix.'}`;
}

describe('ChangeParser', () => {
  it('parses a proposal with all four required sections', async () => {
    const content = makeProposal();
    const parser = new ChangeParser(content, process.cwd());
    const change = await parser.parseChangeWithDeltas('test-change');

    expect(change.name).toBe('test-change');
    expect(change.problem).toContain('broken');
    expect(change.constraints).toContain('existing functionality');
    expect(change.successCriteria).toContain('works correctly');
    expect(change.nonGoals).toContain('extra work');
    expect(change.deltas).toHaveLength(0);
  });

  it('throws when Problem section is missing', async () => {
    const content = `# Test Change

## Constraints
Something

## Success Criteria
Something

## Non-goals
Something`;

    const parser = new ChangeParser(content, process.cwd());
    await expect(parser.parseChangeWithDeltas('test')).rejects.toThrow('must have a Problem section');
  });

  it('throws when Constraints section is missing', async () => {
    const content = `# Test Change

## Problem
Something is broken.

## Success Criteria
Something

## Non-goals
Something`;

    const parser = new ChangeParser(content, process.cwd());
    await expect(parser.parseChangeWithDeltas('test')).rejects.toThrow('must have a Constraints section');
  });

  it('throws when Success Criteria section is missing', async () => {
    const content = `# Test Change

## Problem
Something is broken.

## Constraints
Cannot break things.

## Non-goals
Not doing X.`;

    const parser = new ChangeParser(content, process.cwd());
    await expect(parser.parseChangeWithDeltas('test')).rejects.toThrow('must have a Success Criteria section');
  });

  it('throws when Non-goals section is missing', async () => {
    const content = `# Test Change

## Problem
Something is broken.

## Constraints
Cannot break things.

## Success Criteria
Things work.`;

    const parser = new ChangeParser(content, process.cwd());
    await expect(parser.parseChangeWithDeltas('test')).rejects.toThrow('must have a Non-goals section');
  });

  it('parses delta specs from specs directory using new prose format', async () => {
    await withTempDir(async (dir) => {
      const specsDir = path.join(dir, 'specs', 'foo');
      await fs.mkdir(specsDir, { recursive: true });

      const content = makeProposal();
      const deltaSpec = `# Delta for Foo

## ADDED Behavior

### Two-Factor Auth
Users can enable two-factor authentication for additional security.

### Password Reset
Users can reset their password via email verification.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec, 'utf8');

      const parser = new ChangeParser(content, dir);
      const change = await parser.parseChangeWithDeltas('test-change');

      expect(change.deltas.length).toBe(2);
      expect(change.deltas[0].spec).toBe('foo');
      expect(change.deltas[0].operation).toBe('ADDED');
      expect(change.deltas[0].description).toContain('Two-Factor Auth');
      expect(change.deltas[1].description).toContain('Password Reset');
    });
  });

  it('parses renamed blocks using new FROM: ### / TO: ### format', async () => {
    await withTempDir(async (dir) => {
      const specsDir = path.join(dir, 'specs', 'foo');
      await fs.mkdir(specsDir, { recursive: true });

      const content = makeProposal();
      const deltaSpec = `# Delta for Foo

## RENAMED Behavior

FROM: ### Old Login
TO: ### New Login`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec, 'utf8');

      const parser = new ChangeParser(content, dir);
      const change = await parser.parseChangeWithDeltas('test-change');

      expect(change.deltas.length).toBe(1);
      expect(change.deltas[0].operation).toBe('RENAMED');
      expect(change.deltas[0].rename).toEqual({ from: 'Old Login', to: 'New Login' });
    });
  });

  it('returns empty deltas when no specs directory exists', async () => {
    await withTempDir(async (dir) => {
      const content = makeProposal();
      const parser = new ChangeParser(content, dir);
      const change = await parser.parseChangeWithDeltas('test-change');

      expect(change.deltas).toHaveLength(0);
    });
  });

  it('handles multi-section delta specs', async () => {
    await withTempDir(async (dir) => {
      const specsDir = path.join(dir, 'specs', 'foo');
      await fs.mkdir(specsDir, { recursive: true });

      const content = makeProposal();
      const deltaSpec = `# Delta

## ADDED Behavior

### Login
Users can log in.

## MODIFIED Data Model

### Sessions
Updated session tracking.`;

      await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec, 'utf8');

      const parser = new ChangeParser(content, dir);
      const change = await parser.parseChangeWithDeltas('test-change');

      expect(change.deltas.length).toBe(2);
      expect(change.deltas[0].operation).toBe('ADDED');
      expect(change.deltas[1].operation).toBe('MODIFIED');
    });
  });
});
