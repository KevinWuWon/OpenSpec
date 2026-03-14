import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { JsonConverter } from '../../../src/core/converters/json-converter.js';

describe('JsonConverter', () => {
  const testDir = path.join(process.cwd(), 'test-json-converter-tmp');
  const converter = new JsonConverter();

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('convertSpecToJson', () => {
    it('should convert a spec to JSON format', async () => {
      const specContent = `# User Authentication Spec

## Behavior

### Login
Users need to be able to log in securely with email and password.

### Password Reset
Users can request a password reset via email.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const json = converter.convertSpecToJson(specPath);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('spec');
      expect(parsed.sections).toBeDefined();
      expect(parsed.sections['Behavior']).toBeDefined();
      expect(parsed.sections['Behavior'].blocks).toHaveLength(2);
      expect(parsed.sections['Behavior'].blocks[0].name).toBe('Login');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.format).toBe('openspec');
      expect(parsed.metadata.sourcePath).toBe(specPath);
    });

    it('should extract spec name from directory structure', async () => {
      const specsDir = path.join(testDir, 'specs', 'user-auth');
      await fs.mkdir(specsDir, { recursive: true });

      const specContent = `# User Auth

## Behavior

### Login
Users authenticate with credentials.`;

      const specPath = path.join(specsDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const json = converter.convertSpecToJson(specPath);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('user-auth');
    });
  });

  describe('convertChangeToJson', () => {
    it('should convert a change to JSON format', async () => {
      const changeContent = `# Add User Authentication

## Problem
We need to implement user authentication to secure the application and protect user data from unauthorized access.

## Constraints
Must use existing OAuth infrastructure. Cannot modify database schema.

## Success Criteria
Users can log in with email and password. Invalid credentials produce clear error messages.

## Non-goals
Not implementing social login or SSO in this change.`;

      const changePath = path.join(testDir, 'change.md');
      await fs.writeFile(changePath, changeContent);

      const json = await converter.convertChangeToJson(changePath);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('change');
      expect(parsed.problem).toContain('secure the application');
      expect(parsed.constraints).toContain('OAuth');
      expect(parsed.successCriteria).toContain('email and password');
      expect(parsed.nonGoals).toContain('social login');
      expect(parsed.deltas).toHaveLength(0);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.format).toBe('openspec-change');
      expect(parsed.metadata.sourcePath).toBe(changePath);
    });

    it('should extract change name from directory structure', async () => {
      const changesDir = path.join(testDir, 'changes', 'add-auth');
      await fs.mkdir(changesDir, { recursive: true });

      const changeContent = `# Add Auth

## Problem
We need authentication for security reasons and to protect user data properly.

## Constraints
Must use existing infrastructure.

## Success Criteria
Authentication works end to end for all users in the production environment.

## Non-goals
Not building admin tools.`;

      const changePath = path.join(changesDir, 'proposal.md');
      await fs.writeFile(changePath, changeContent);

      const json = await converter.convertChangeToJson(changePath);
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('add-auth');
    });
  });

  describe('JSON formatting', () => {
    it('should produce properly formatted JSON with indentation', async () => {
      const specContent = `# Test

## Behavior

### Login
Users log in with credentials.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const json = converter.convertSpecToJson(specPath);

      // Check for proper indentation (2 spaces)
      expect(json).toContain('  "name"');
      expect(json).toContain('  "sections"');

      // Check it's valid JSON
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should handle special characters in content', async () => {
      const specContent = `# Test

## Behavior

### Special "characters"
This has "quotes" and \\ backslashes and
newlines in the content.`;

      const specPath = path.join(testDir, 'spec.md');
      await fs.writeFile(specPath, specContent);

      const json = converter.convertSpecToJson(specPath);
      const parsed = JSON.parse(json);

      expect(parsed.sections['Behavior'].blocks[0].text).toContain('"quotes"');
      expect(parsed.sections['Behavior'].blocks[0].text).toContain('\\');
    });
  });
});
