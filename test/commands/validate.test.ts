import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { runCLI } from '../helpers/run-cli.js';

describe('top-level validate command', () => {
  const projectRoot = process.cwd();
  const testDir = path.join(projectRoot, 'test-validate-command-tmp');
  const changesDir = path.join(testDir, 'openspec', 'changes');
  const specsDir = path.join(testDir, 'openspec', 'specs');

  beforeEach(async () => {
    await fs.mkdir(changesDir, { recursive: true });
    await fs.mkdir(specsDir, { recursive: true });

    // Create a valid spec (prose format — no SHALL/MUST or Scenario required)
    const specContent = [
      '## Purpose',
      'This spec ensures the validation harness exercises a deterministic alpha module for automated tests.',
      '',
      '## Requirements',
      '',
      '### Alpha module produces deterministic output',
      'The alpha module produces a deterministic response for validation.',
    ].join('\n');
    await fs.mkdir(path.join(specsDir, 'alpha'), { recursive: true });
    await fs.writeFile(path.join(specsDir, 'alpha', 'spec.md'), specContent, 'utf-8');

    // Create a change with proposal sections
    const changeContent = [
      '# Test Change',
      '',
      '## Problem',
      'The alpha module needs validation support for automated testing in the harness.',
      '',
      '## Constraints',
      'Must work with existing alpha module configuration.',
      '',
      '## Success Criteria',
      'The validation harness exercises a deterministic alpha module for automated tests.',
      '',
      '## Non-goals',
      'Not changing the alpha module behavior itself.',
    ].join('\n');
    await fs.mkdir(path.join(changesDir, 'c1'), { recursive: true });
    await fs.writeFile(path.join(changesDir, 'c1', 'proposal.md'), changeContent, 'utf-8');
    const deltaContent = [
      '## ADDED Requirements',
      '',
      '### Validator supports alpha change deltas',
      'The validator accepts deltas provided by the test harness.',
    ].join('\n');
    const c1DeltaDir = path.join(changesDir, 'c1', 'specs', 'alpha');
    await fs.mkdir(c1DeltaDir, { recursive: true });
    await fs.writeFile(path.join(c1DeltaDir, 'spec.md'), deltaContent, 'utf-8');

    // Duplicate name for ambiguity test
    await fs.mkdir(path.join(changesDir, 'dup'), { recursive: true });
    await fs.writeFile(path.join(changesDir, 'dup', 'proposal.md'), changeContent, 'utf-8');
    const dupDeltaDir = path.join(changesDir, 'dup', 'specs', 'dup');
    await fs.mkdir(dupDeltaDir, { recursive: true });
    await fs.writeFile(path.join(dupDeltaDir, 'spec.md'), deltaContent, 'utf-8');
    await fs.mkdir(path.join(specsDir, 'dup'), { recursive: true });
    await fs.writeFile(path.join(specsDir, 'dup', 'spec.md'), specContent, 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('prints a helpful hint when no args in non-interactive mode', async () => {
    const result = await runCLI(['validate'], { cwd: testDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Nothing to validate. Try one of:');
  });

  it('validates all with --all and outputs JSON summary', async () => {
    const result = await runCLI(['validate', '--all', '--json'], { cwd: testDir });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.trim();
    expect(output).not.toBe('');
    const json = JSON.parse(output);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.summary?.totals?.items).toBeDefined();
    expect(json.version).toBe('1.0');
  });

  it('validates only specs with --specs and respects --concurrency', async () => {
    const result = await runCLI(['validate', '--specs', '--json', '--concurrency', '1'], { cwd: testDir });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.trim();
    expect(output).not.toBe('');
    const json = JSON.parse(output);
    expect(json.items.every((i: any) => i.type === 'spec')).toBe(true);
  });

  it('errors on ambiguous item names and suggests type override', async () => {
    const result = await runCLI(['validate', 'dup'], { cwd: testDir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Ambiguous item');
  });

  it('accepts change proposals saved with CRLF line endings', async () => {
    const changeId = 'crlf-change';
    const toCrlf = (segments: string[]) => segments.join('\n').replace(/\n/g, '\r\n');

    const crlfContent = toCrlf([
      '# CRLF Proposal',
      '',
      '## Problem',
      'This change verifies validation works with Windows line endings for the harness.',
      '',
      '## Constraints',
      'Must handle CRLF without conversion.',
      '',
      '## Success Criteria',
      'Validation passes on CRLF files without needing to manually convert line endings.',
      '',
      '## Non-goals',
      'Not implementing auto-conversion of line endings.',
    ]);

    await fs.mkdir(path.join(changesDir, changeId), { recursive: true });
    await fs.writeFile(path.join(changesDir, changeId, 'proposal.md'), crlfContent, 'utf-8');

    const deltaContent = toCrlf([
      '## ADDED Requirements',
      '',
      '### Parser accepts CRLF change proposals',
      'The parser accepts CRLF change proposals without manual edits.',
    ]);

    const deltaDir = path.join(changesDir, changeId, 'specs', 'alpha');
    await fs.mkdir(deltaDir, { recursive: true });
    await fs.writeFile(path.join(deltaDir, 'spec.md'), deltaContent, 'utf-8');

    const result = await runCLI(['validate', changeId], { cwd: testDir });
    expect(result.exitCode).toBe(0);
  });

  it('respects --no-interactive flag passed via CLI', async () => {
    const result = await runCLI(['validate', '--specs', '--no-interactive'], {
      cwd: testDir,
      env: { ...process.env, OPEN_SPEC_INTERACTIVE: undefined },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain('What would you like to validate?');
  });
});
