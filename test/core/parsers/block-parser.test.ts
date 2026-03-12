import { describe, it, expect } from 'vitest';
import {
  normalizeBlockName,
  extractSection,
  extractAllSections,
  parseDeltaSpec,
  parseRemovedNames,
  parseRenamedPairs,
  BLOCK_HEADER_REGEX,
  type Block,
  type SectionParts,
  type DeltaPlan,
} from '../../../src/core/parsers/block-parser.js';

describe('BLOCK_HEADER_REGEX', () => {
  it('matches ### Any Heading and captures the name', () => {
    const match = '### Login Flow'.match(BLOCK_HEADER_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Login Flow');
  });

  it('matches headings with extra whitespace', () => {
    const match = '###   Spaced Heading  '.match(BLOCK_HEADER_REGEX);
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('Spaced Heading');
  });

  it('does not match ## or #### headings', () => {
    expect('## Section'.match(BLOCK_HEADER_REGEX)).toBeNull();
    expect('#### Sub'.match(BLOCK_HEADER_REGEX)).toBeNull();
  });

  it('does not match lines without the ### prefix', () => {
    expect('Some text'.match(BLOCK_HEADER_REGEX)).toBeNull();
  });

  it('does not require Requirement: prefix', () => {
    const match = '### Simple Name'.match(BLOCK_HEADER_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('Simple Name');
  });
});

describe('normalizeBlockName', () => {
  it('trims whitespace', () => {
    expect(normalizeBlockName('  hello  ')).toBe('hello');
  });

  it('returns trimmed value for normal strings', () => {
    expect(normalizeBlockName('Login Flow')).toBe('Login Flow');
  });
});

describe('extractSection', () => {
  it('extracts a named section and parses its ### blocks', () => {
    const content = [
      '# Title',
      '',
      '## Behavior',
      '',
      'Some preamble text.',
      '',
      '### Login',
      'Users can log in with email.',
      '',
      '### Logout',
      'Users can log out.',
      '',
      '## Data Model',
      '',
      '### Sessions',
      'Session data...',
    ].join('\n');

    const result = extractSection(content, 'Behavior');
    expect(result.headerLine).toBe('## Behavior');
    expect(result.bodyBlocks).toHaveLength(2);
    expect(result.bodyBlocks[0].name).toBe('Login');
    expect(result.bodyBlocks[0].raw).toContain('### Login');
    expect(result.bodyBlocks[0].raw).toContain('Users can log in with email.');
    expect(result.bodyBlocks[1].name).toBe('Logout');
    expect(result.preamble).toContain('Some preamble text.');
  });

  it('returns empty parts when section is not found', () => {
    const content = '## Other\n\n### Block\nContent';
    const result = extractSection(content, 'Behavior');
    expect(result.bodyBlocks).toHaveLength(0);
    expect(result.headerLine).toBe('## Behavior');
  });

  it('handles section at the end of file', () => {
    const content = [
      '## Intro',
      'intro text',
      '## Behavior',
      '### Login',
      'Login content',
    ].join('\n');

    const result = extractSection(content, 'Behavior');
    expect(result.bodyBlocks).toHaveLength(1);
    expect(result.bodyBlocks[0].name).toBe('Login');
  });

  it('is case-insensitive for section name matching', () => {
    const content = '## behavior\n\n### Block\nContent';
    const result = extractSection(content, 'Behavior');
    expect(result.bodyBlocks).toHaveLength(1);
    expect(result.bodyBlocks[0].name).toBe('Block');
  });

  it('preserves before and after content', () => {
    const content = [
      '# Title',
      '',
      '## Behavior',
      '### Login',
      'Content',
      '',
      '## Other',
      'Other content',
    ].join('\n');

    const result = extractSection(content, 'Behavior');
    expect(result.before).toContain('# Title');
    expect(result.after).toContain('## Other');
  });
});

describe('extractAllSections', () => {
  it('returns all ## sections with their ### blocks', () => {
    const content = [
      '# Title',
      '',
      '## Behavior',
      '### Login',
      'Login content',
      '',
      '### Logout',
      'Logout content',
      '',
      '## Data Model',
      '### Sessions',
      'Session data',
    ].join('\n');

    const sections = extractAllSections(content);
    expect(Object.keys(sections)).toHaveLength(2);
    expect(sections['Behavior']).toBeDefined();
    expect(sections['Behavior'].bodyBlocks).toHaveLength(2);
    expect(sections['Data Model']).toBeDefined();
    expect(sections['Data Model'].bodyBlocks).toHaveLength(1);
    expect(sections['Data Model'].bodyBlocks[0].name).toBe('Sessions');
  });

  it('returns empty map for content with no ## sections', () => {
    const content = '# Just a title\n\nSome text';
    const sections = extractAllSections(content);
    expect(Object.keys(sections)).toHaveLength(0);
  });

  it('handles sections with no ### blocks', () => {
    const content = '## Overview\n\nJust some text, no blocks.\n\n## Behavior\n### Login\nContent';
    const sections = extractAllSections(content);
    expect(sections['Overview'].bodyBlocks).toHaveLength(0);
    expect(sections['Behavior'].bodyBlocks).toHaveLength(1);
  });
});

describe('parseDeltaSpec', () => {
  it('parses added, modified, removed, and renamed sections', () => {
    const content = [
      '## ADDED Requirements',
      '',
      '### New Feature',
      'New feature content',
      '',
      '## MODIFIED Requirements',
      '',
      '### Existing Feature',
      'Updated content',
      '',
      '## REMOVED Requirements',
      '',
      '### Old Feature',
      '',
      '## RENAMED Requirements',
      '',
      'FROM: ### Old Name',
      'TO: ### New Name',
    ].join('\n');

    const plan = parseDeltaSpec(content);
    expect(plan.added).toHaveLength(1);
    expect(plan.added[0].name).toBe('New Feature');
    expect(plan.modified).toHaveLength(1);
    expect(plan.modified[0].name).toBe('Existing Feature');
    expect(plan.removed).toHaveLength(1);
    expect(plan.removed[0]).toBe('Old Feature');
    expect(plan.renamed).toHaveLength(1);
    expect(plan.renamed[0]).toEqual({ from: 'Old Name', to: 'New Name' });
  });

  it('returns empty arrays when sections are missing', () => {
    const content = '## ADDED Requirements\n\n### Something\nContent';
    const plan = parseDeltaSpec(content);
    expect(plan.added).toHaveLength(1);
    expect(plan.modified).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
    expect(plan.renamed).toHaveLength(0);
  });

  it('tracks section presence', () => {
    const content = '## ADDED Requirements\n\n### Block\nContent';
    const plan = parseDeltaSpec(content);
    expect(plan.sectionPresence.added).toBe(true);
    expect(plan.sectionPresence.modified).toBe(false);
    expect(plan.sectionPresence.removed).toBe(false);
    expect(plan.sectionPresence.renamed).toBe(false);
  });
});

describe('parseRemovedNames', () => {
  it('parses ### headings as removed names', () => {
    const body = '### First\n\n### Second\n';
    // Exported for testing; called internally by parseDeltaSpec
    const names = parseRemovedNames(body);
    expect(names).toEqual(['First', 'Second']);
  });

  it('supports bullet list format', () => {
    const body = '- `### First`\n- `### Second`\n';
    const names = parseRemovedNames(body);
    expect(names).toEqual(['First', 'Second']);
  });
});

describe('parseRenamedPairs', () => {
  it('parses FROM/TO pairs', () => {
    const body = 'FROM: ### Old\nTO: ### New\n';
    const pairs = parseRenamedPairs(body);
    expect(pairs).toEqual([{ from: 'Old', to: 'New' }]);
  });

  it('handles multiple pairs', () => {
    const body = 'FROM: ### A\nTO: ### B\n\nFROM: ### C\nTO: ### D\n';
    const pairs = parseRenamedPairs(body);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ from: 'A', to: 'B' });
    expect(pairs[1]).toEqual({ from: 'C', to: 'D' });
  });
});
