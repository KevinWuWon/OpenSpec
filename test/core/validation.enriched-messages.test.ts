import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { Validator } from '../../src/core/validation/validator.js';

describe('Validator enriched messages', () => {
  const testDir = path.join(process.cwd(), 'test-validation-enriched-tmp');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('adds guidance when spec has no ## sections', async () => {
    const specContent = `# Test Spec\n\nJust content with no sections.\n`;
    const specPath = path.join(testDir, 'spec.md');
    await fs.writeFile(specPath, specContent);

    const validator = new Validator();
    const report = await validator.validateSpec(specPath);
    expect(report.valid).toBe(false);
    const msg = report.issues.map(i => i.message).join('\n');
    expect(msg).toContain('Spec must have at least one ## section');
    expect(msg).toContain('A spec must have at least one ## section containing ### blocks with content');
  });

  it('validates spec with prose blocks (no SHALL/MUST, no scenarios)', async () => {
    const specContent = `# Test Spec

## Behavior

### Foo
Description of the foo behavior in plain prose.
`;
    const specPath = path.join(testDir, 'spec.md');
    await fs.writeFile(specPath, specContent);

    const validator = new Validator();
    const report = await validator.validateSpec(specPath);
    // Spec with prose block (no SHALL/MUST, no scenarios) should pass
    expect(report.valid).toBe(true);
    expect(report.summary.errors).toBe(0);
  });

  it('detects legacy markers in delta specs', async () => {
    const changeDir = path.join(testDir, 'test-change');
    const specsDir = path.join(changeDir, 'specs', 'test-spec');
    await fs.mkdir(specsDir, { recursive: true });

    const deltaSpec = `## ADDED Behavior

### Requirement: Legacy Format
The system SHALL do something.

#### Scenario: Legacy scenario
Given a condition
When an action
Then a result`;

    await fs.writeFile(path.join(specsDir, 'spec.md'), deltaSpec);

    const validator = new Validator();
    const report = await validator.validateChangeDeltaSpecs(changeDir);
    expect(report.valid).toBe(false);
    const msg = report.issues.map(i => i.message).join('\n');
    expect(msg).toContain('Legacy marker detected');
  });
});
