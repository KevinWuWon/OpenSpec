import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('spec command', () => {
  const projectRoot = process.cwd();
  const testDir = path.join(projectRoot, 'test-spec-command-tmp');
  const specsDir = path.join(testDir, 'openspec', 'specs');
  const openspecBin = path.join(projectRoot, 'bin', 'openspec.js');

  beforeEach(async () => {
    await fs.mkdir(specsDir, { recursive: true });

    // Create test spec files using new prose format
    const testSpec = `## Behavior

### User Authentication
The system provides secure user authentication via email and password.

### Password Reset
The system allows users to reset their password via a verified email link.`;

    await fs.mkdir(path.join(specsDir, 'auth'), { recursive: true });
    await fs.writeFile(path.join(specsDir, 'auth', 'spec.md'), testSpec);

    const testSpec2 = `## Payments

### Process Payments
The system processes credit card payments securely via Stripe integration.`;

    await fs.mkdir(path.join(specsDir, 'payment'), { recursive: true });
    await fs.writeFile(path.join(specsDir, 'payment', 'spec.md'), testSpec2);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('spec show', () => {
    it('should display spec in text format', async () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec show auth`, {
          encoding: 'utf-8'
        });

        // Raw passthrough should match spec.md content
        const raw = await fs.readFile(path.join(specsDir, 'auth', 'spec.md'), 'utf-8');
        expect(output.trim()).toBe(raw.trim());
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should output spec as JSON with --json flag', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec show auth --json`, {
          encoding: 'utf-8'
        });

        const json = JSON.parse(output);
        expect(json.id).toBe('auth');
        expect(json.title).toBe('auth');
        expect(json.sections).toBeDefined();
        expect(json.sections['Behavior']).toBeDefined();
        expect(json.blockCount).toBe(2);
        expect(json.metadata.format).toBe('openspec');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('spec list', () => {
    it('should list all available specs (IDs only by default)', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec list`, {
          encoding: 'utf-8'
        });

        expect(output).toContain('auth');
        expect(output).toContain('payment');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should output spec list as JSON with --json flag', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec list --json`, {
          encoding: 'utf-8'
        });

        const json = JSON.parse(output);
        expect(json).toHaveLength(2);
        expect(json.find((s: any) => s.id === 'auth')).toBeDefined();
        expect(json.find((s: any) => s.id === 'payment')).toBeDefined();
        expect(json[0].blockCount).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('spec validate', () => {
    it('should validate a valid spec', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec validate auth`, {
          encoding: 'utf-8'
        });

        expect(output).toContain("Specification 'auth' is valid");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should output validation report as JSON with --json flag', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec validate auth --json`, {
          encoding: 'utf-8'
        });

        const json = JSON.parse(output);
        expect(json.valid).toBeDefined();
        expect(json.issues).toBeDefined();
        expect(json.summary).toBeDefined();
        expect(json.summary.errors).toBeDefined();
        expect(json.summary.warnings).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should validate with strict mode', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec validate auth --strict --json`, {
          encoding: 'utf-8'
        });

        const json = JSON.parse(output);
        expect(json.valid).toBeDefined();
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should detect spec with no ## sections', async () => {
      const invalidSpec = `Just some text without any sections`;

      await fs.mkdir(path.join(specsDir, 'invalid'), { recursive: true });
      await fs.writeFile(path.join(specsDir, 'invalid', 'spec.md'), invalidSpec);

      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);

        let exitCode = 0;
        try {
          execSync(`node ${openspecBin} spec validate invalid`, {
            encoding: 'utf-8'
          });
        } catch (error: any) {
          exitCode = error.status;
        }

        expect(exitCode).not.toBe(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('error handling', () => {
    it('should handle non-existent spec gracefully', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);

        let error: any;
        try {
          execSync(`node ${openspecBin} spec show nonexistent`, {
            encoding: 'utf-8'
          });
        } catch (e) {
          error = e;
        }

        expect(error).toBeDefined();
        expect(error.status).not.toBe(0);
        expect(error.stderr.toString()).toContain('not found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should handle missing specs directory gracefully', async () => {
      await fs.rm(specsDir, { recursive: true, force: true });
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} spec list`, { encoding: 'utf-8' });
        expect(output.trim()).toBe('No items found');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should honor --no-color (no ANSI escapes)', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDir);
        const output = execSync(`node ${openspecBin} --no-color spec list --long`, { encoding: 'utf-8' });
        // Basic ANSI escape pattern
        const hasAnsi = /\u001b\[[0-9;]*m/.test(output);
        expect(hasAnsi).toBe(false);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });
});
