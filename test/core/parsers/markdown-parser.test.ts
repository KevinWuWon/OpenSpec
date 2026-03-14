import { describe, it, expect } from 'vitest';
import { MarkdownParser } from '../../../src/core/parsers/markdown-parser.js';

describe('MarkdownParser', () => {
  describe('parseSpec', () => {
    it('parses a spec with ## Behavior / ### Login / prose content', () => {
      const content = `# My Spec

## Behavior

### Login

Users authenticate with email and password. On success, a session token
is issued and stored in an HTTP-only cookie.

### Logout

The session token is revoked and the cookie is cleared.`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('my-spec');

      expect(spec.name).toBe('my-spec');
      expect(spec.sections).toHaveProperty('Behavior');
      expect(spec.sections['Behavior'].blocks).toHaveLength(2);
      expect(spec.sections['Behavior'].blocks[0].name).toBe('Login');
      expect(spec.sections['Behavior'].blocks[0].text).toContain('email and password');
      expect(spec.sections['Behavior'].blocks[1].name).toBe('Logout');
      expect(spec.sections['Behavior'].blocks[1].text).toContain('session token is revoked');
    });

    it('parses multiple ## sections each containing ### blocks', () => {
      const content = `# Full Spec

## Behavior

### Login
Users log in with credentials.

### Registration
New users create accounts.

## Data Model

### Sessions
Sessions track active user connections.

### Users
Users table stores profile information.`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('full-spec');

      expect(Object.keys(spec.sections)).toEqual(['Behavior', 'Data Model']);
      expect(spec.sections['Behavior'].blocks).toHaveLength(2);
      expect(spec.sections['Data Model'].blocks).toHaveLength(2);
      expect(spec.sections['Data Model'].blocks[0].name).toBe('Sessions');
    });

    it('returns a structure with named sections and their blocks', () => {
      const content = `# API Spec

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.

## Error Handling

### 404 Not Found
Returned when resource does not exist.`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('api-spec');

      expect(spec.name).toBe('api-spec');
      expect(spec.metadata).toEqual({ version: '1.0.0', format: 'openspec' });

      // Verify section structure
      const sectionNames = Object.keys(spec.sections);
      expect(sectionNames).toContain('Endpoints');
      expect(sectionNames).toContain('Error Handling');

      // Verify blocks within sections
      const endpoints = spec.sections['Endpoints'];
      expect(endpoints.blocks).toHaveLength(2);
      expect(endpoints.blocks[0]).toEqual({
        name: 'GET /users',
        text: 'Returns a list of users.',
      });
    });

    it('handles ## sections without ### blocks', () => {
      const content = `# Spec

## Overview

This spec describes the system.

## Behavior

### Auth
Login flow.`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('test');

      expect(spec.sections['Overview'].blocks).toHaveLength(0);
      expect(spec.sections['Behavior'].blocks).toHaveLength(1);
    });

    it('throws error when no ## sections exist', () => {
      const content = `# Spec

Just some content without any sections.`;

      const parser = new MarkdownParser(content);
      expect(() => parser.parseSpec('test')).toThrow('at least one ## section');
    });

    it('uses heading text as block name even when block has no content', () => {
      const content = `# Spec

## Rules

### No empty blocks allowed

### Content required`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('test');

      expect(spec.sections['Rules'].blocks[0].name).toBe('No empty blocks allowed');
      expect(spec.sections['Rules'].blocks[0].text).toBe('');
      expect(spec.sections['Rules'].blocks[1].name).toBe('Content required');
    });

    it('extracts block text excluding child sections', () => {
      const content = `# Spec

## Behavior

### Login

Users authenticate with credentials.

#### Implementation Notes
These notes should not appear in block text.`;

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('test');

      expect(spec.sections['Behavior'].blocks[0].text).toBe('Users authenticate with credentials.');
    });

    it('handles CRLF line endings', () => {
      const lines = [
        '# Spec',
        '',
        '## Behavior',
        '',
        '### Login',
        'Users log in.',
      ];
      const content = lines.join('\r\n');

      const parser = new MarkdownParser(content);
      const spec = parser.parseSpec('test');

      expect(spec.sections['Behavior'].blocks[0].name).toBe('Login');
      expect(spec.sections['Behavior'].blocks[0].text).toBe('Users log in.');
    });
  });

  describe('parseChange', () => {
    it('parses a change with all four proposal sections', () => {
      const content = `# Add Authentication

## Problem
We need authentication to secure the application and protect user data from unauthorized access.

## Constraints
Must integrate with existing OAuth providers. Cannot break current session management.

## Success Criteria
Users can log in with email/password. Sessions are tracked securely. Invalid credentials show clear errors.

## Non-goals
We are not implementing social login or SSO in this change.`;

      const parser = new MarkdownParser(content);
      const change = parser.parseChange('add-auth');

      expect(change.name).toBe('add-auth');
      expect(change.problem).toContain('secure the application');
      expect(change.constraints).toContain('OAuth providers');
      expect(change.successCriteria).toContain('email/password');
      expect(change.nonGoals).toContain('social login');
      expect(change.deltas).toHaveLength(0);
    });

    it('throws error for missing Problem section', () => {
      const content = `# Change

## Constraints
Something

## Success Criteria
Something

## Non-goals
Something`;

      const parser = new MarkdownParser(content);
      expect(() => parser.parseChange('test')).toThrow('must have a Problem section');
    });

    it('throws error for missing Constraints section', () => {
      const content = `# Change

## Problem
Something is broken.

## Success Criteria
Something

## Non-goals
Something`;

      const parser = new MarkdownParser(content);
      expect(() => parser.parseChange('test')).toThrow('must have a Constraints section');
    });

    it('throws error for missing Success Criteria section', () => {
      const content = `# Change

## Problem
Something is broken.

## Constraints
Cannot break things.

## Non-goals
Not doing X.`;

      const parser = new MarkdownParser(content);
      expect(() => parser.parseChange('test')).toThrow('must have a Success Criteria section');
    });

    it('throws error for missing Non-goals section', () => {
      const content = `# Change

## Problem
Something is broken.

## Constraints
Cannot break things.

## Success Criteria
Things work.`;

      const parser = new MarkdownParser(content);
      expect(() => parser.parseChange('test')).toThrow('must have a Non-goals section');
    });

    it('handles CRLF line endings', () => {
      const lines = [
        '# CRLF Change',
        '',
        '## Problem',
        'Something is broken and needs to be fixed urgently.',
        '',
        '## Constraints',
        'Must not break existing functionality.',
        '',
        '## Success Criteria',
        'The thing works correctly after the fix.',
        '',
        '## Non-goals',
        'Not doing extra work.',
      ];
      const content = lines.join('\r\n');

      const parser = new MarkdownParser(content);
      const change = parser.parseChange('crlf-change');

      expect(change.problem).toContain('broken');
      expect(change.constraints).toContain('existing functionality');
    });
  });
});
