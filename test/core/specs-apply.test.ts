import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { buildUpdatedSpec, buildSpecSkeleton, type SpecUpdate } from '../../src/core/specs-apply.js';

describe('specs-apply', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-specs-apply-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    // Suppress console.log/warn during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // Helper to create file and return path
  async function writeFile(relativePath: string, content: string): Promise<string> {
    const fullPath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  function makeUpdate(sourcePath: string, targetPath: string, exists: boolean): SpecUpdate {
    return { source: sourcePath, target: targetPath, exists };
  }

  // ---------------------------------------------------------------------------
  // buildSpecSkeleton
  // ---------------------------------------------------------------------------

  describe('buildSpecSkeleton', () => {
    it('seeds only ADDED section targets (not hardcoded ## Requirements)', () => {
      const skeleton = buildSpecSkeleton('my-cap', 'my-change', ['Behavior', 'Data Model']);
      expect(skeleton).toContain('# my-cap Specification');
      expect(skeleton).toContain('## Purpose');
      expect(skeleton).toContain('## Behavior');
      expect(skeleton).toContain('## Data Model');
      expect(skeleton).not.toContain('## Requirements');
    });

    it('includes change name in Purpose section', () => {
      const skeleton = buildSpecSkeleton('cap', 'change-x', ['Behavior']);
      expect(skeleton).toContain('created by archiving change change-x');
    });

    it('handles a single section', () => {
      const skeleton = buildSpecSkeleton('cap', 'ch', ['Behavior']);
      expect(skeleton).toContain('## Behavior');
      // Only one ## section besides Purpose
      const sectionHeaders = skeleton.match(/^## /gm);
      expect(sectionHeaders).toHaveLength(2); // Purpose + Behavior
    });

    it('preserves section order', () => {
      const skeleton = buildSpecSkeleton('cap', 'ch', ['Data Model', 'Behavior', 'Admin']);
      const idx1 = skeleton.indexOf('## Data Model');
      const idx2 = skeleton.indexOf('## Behavior');
      const idx3 = skeleton.indexOf('## Admin');
      expect(idx1).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx3);
    });
  });

  // ---------------------------------------------------------------------------
  // buildUpdatedSpec — multi-section deltas
  // ---------------------------------------------------------------------------

  describe('buildUpdatedSpec - multi-section deltas', () => {
    it('applies deltas targeting ## Behavior to the correct section', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Users log in with email.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/my-change/specs/auth/spec.md', [
        '## ADDED Behavior',
        '',
        '### Two-Factor Auth',
        'Users can enable 2FA.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      const { rebuilt, counts } = await buildUpdatedSpec(update, 'my-change');

      expect(rebuilt).toContain('### Login');
      expect(rebuilt).toContain('### Two-Factor Auth');
      expect(rebuilt).toContain('Users can enable 2FA.');
      expect(counts.added).toBe(1);
    });

    it('applies deltas targeting multiple sections', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login content.',
        '',
        '## Data Model',
        '',
        '### Sessions',
        'Session data.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## ADDED Behavior',
        '',
        '### Logout',
        'Logout content.',
        '',
        '## MODIFIED Data Model',
        '',
        '### Sessions',
        'Updated session data.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      const { rebuilt, counts } = await buildUpdatedSpec(update, 'ch');

      expect(rebuilt).toContain('### Login');
      expect(rebuilt).toContain('### Logout');
      expect(rebuilt).toContain('Updated session data.');
      expect(rebuilt).not.toContain('Session data.');
      expect(counts.added).toBe(1);
      expect(counts.modified).toBe(1);
    });

    it('new spec gets skeleton sections matching only ADDED targets', async () => {
      const targetPath = path.join(tempDir, 'specs/new-cap/spec.md');
      const sourcePath = await writeFile('changes/ch/specs/new-cap/spec.md', [
        '## ADDED Behavior',
        '',
        '### Login',
        'Login content.',
        '',
        '## ADDED Data Model',
        '',
        '### Users',
        'User table.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, false);
      const { rebuilt } = await buildUpdatedSpec(update, 'ch');

      expect(rebuilt).toContain('## Purpose');
      expect(rebuilt).toContain('## Behavior');
      expect(rebuilt).toContain('## Data Model');
      expect(rebuilt).not.toContain('## Requirements');
      expect(rebuilt).toContain('### Login');
      expect(rebuilt).toContain('### Users');
    });

    it('ADDED creates missing target sections in existing specs', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login content.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## ADDED Data Model',
        '',
        '### Sessions',
        'Session data.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      const { rebuilt } = await buildUpdatedSpec(update, 'ch');

      expect(rebuilt).toContain('## Behavior');
      expect(rebuilt).toContain('### Login');
      expect(rebuilt).toContain('## Data Model');
      expect(rebuilt).toContain('### Sessions');
    });

    it('MODIFIED fails when target section is missing', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login content.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## MODIFIED Data Model',
        '',
        '### Sessions',
        'Updated sessions.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /section "## Data Model" not found/
      );
    });

    it('REMOVED fails when target section is missing', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login content.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## REMOVED Data Model',
        '',
        '### Sessions',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /section "## Data Model" not found/
      );
    });

    it('RENAMED fails when target section is missing', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Auth purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login content.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## RENAMED Data Model',
        '',
        'FROM: ### Sessions',
        'TO: ### Session Store',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /section "## Data Model" not found/
      );
    });

    it('for missing target specs, MODIFIED/RENAMED fail', async () => {
      const targetPath = path.join(tempDir, 'specs/new-cap/spec.md');
      const sourcePath = await writeFile('changes/ch/specs/new-cap/spec.md', [
        '## ADDED Behavior',
        '',
        '### Login',
        'Login content.',
        '',
        '## MODIFIED Data Model',
        '',
        '### Sessions',
        'Updated.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, false);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /target spec does not exist.*only ADDED/
      );
    });

    it('for missing target specs, REMOVED fails', async () => {
      const targetPath = path.join(tempDir, 'specs/new-cap/spec.md');
      const sourcePath = await writeFile('changes/ch/specs/new-cap/spec.md', [
        '## ADDED Behavior',
        '',
        '### Login',
        'Login content.',
        '',
        '## REMOVED Data Model',
        '',
        '### Sessions',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, false);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /target spec does not exist.*only ADDED/
      );
    });

    it('newly created sections are appended after existing sections in delta order', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## ADDED Admin Operations',
        '',
        '### Reset Password',
        'Admin resets password.',
        '',
        '## ADDED Data Model',
        '',
        '### Users',
        'User table.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      const { rebuilt } = await buildUpdatedSpec(update, 'ch');

      // Existing ## Behavior should come first
      const behaviorIdx = rebuilt.indexOf('## Behavior');
      const adminIdx = rebuilt.indexOf('## Admin Operations');
      const dataIdx = rebuilt.indexOf('## Data Model');

      expect(behaviorIdx).toBeGreaterThan(-1);
      expect(adminIdx).toBeGreaterThan(-1);
      expect(dataIdx).toBeGreaterThan(-1);
      // Existing section before new sections
      expect(behaviorIdx).toBeLessThan(adminIdx);
      // New sections in delta first-appearance order
      expect(adminIdx).toBeLessThan(dataIdx);
    });

    it('error messages reference ### Name not ### Requirement: Name', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login.',
      ].join('\n'));

      // Try to add a duplicate block
      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## ADDED Behavior',
        '',
        '### Login',
        'Duplicate login.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /ADDED failed for header "### Login"/
      );
    });

    it('validation error messages say "duplicate block" not "duplicate requirement"', async () => {
      const targetPath = await writeFile('specs/auth/spec.md', [
        '# auth Specification',
        '',
        '## Purpose',
        'Purpose.',
        '',
        '## Behavior',
        '',
        '### Login',
        'Login.',
      ].join('\n'));

      // Delta with duplicate in ADDED
      const sourcePath = await writeFile('changes/ch/specs/auth/spec.md', [
        '## ADDED Behavior',
        '',
        '### New Block',
        'Content 1.',
        '',
        '### New Block',
        'Content 2.',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      await expect(buildUpdatedSpec(update, 'ch')).rejects.toThrow(
        /duplicate.*ADDED.*"### New Block"/
      );
    });

    it('archive of a change with multi-section deltas produces correct merged spec', async () => {
      const targetPath = await writeFile('specs/payments/spec.md', [
        '# payments Specification',
        '',
        '## Purpose',
        'Payment processing.',
        '',
        '## Behavior',
        '',
        '### Charge',
        'Process charges.',
        '',
        '### Refund',
        'Process refunds.',
        '',
        '## Data Model',
        '',
        '### Transactions',
        'Transaction records.',
        '',
        '### Accounts',
        'Account records.',
      ].join('\n'));

      const sourcePath = await writeFile('changes/ch/specs/payments/spec.md', [
        '## ADDED Behavior',
        '',
        '### Subscription',
        'Recurring billing.',
        '',
        '## MODIFIED Data Model',
        '',
        '### Transactions',
        'Updated transaction records with subscription support.',
        '',
        '## REMOVED Behavior',
        '',
        '### Refund',
        '',
        '## RENAMED Data Model',
        '',
        'FROM: ### Accounts',
        'TO: ### Billing Accounts',
      ].join('\n'));

      const update = makeUpdate(sourcePath, targetPath, true);
      const { rebuilt, counts } = await buildUpdatedSpec(update, 'ch');

      // Behavior: Charge kept, Refund removed, Subscription added
      expect(rebuilt).toContain('### Charge');
      expect(rebuilt).not.toContain('### Refund');
      expect(rebuilt).toContain('### Subscription');
      // Data Model: Transactions modified, Accounts renamed to Billing Accounts
      expect(rebuilt).toContain('Updated transaction records with subscription support.');
      expect(rebuilt).not.toContain('### Accounts');
      expect(rebuilt).toContain('### Billing Accounts');
      // Purpose preserved
      expect(rebuilt).toContain('## Purpose');
      expect(rebuilt).toContain('Payment processing.');

      expect(counts.added).toBe(1);
      expect(counts.modified).toBe(1);
      expect(counts.removed).toBe(1);
      expect(counts.renamed).toBe(1);
    });
  });
});
