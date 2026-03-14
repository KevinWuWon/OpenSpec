export interface Block {
  headerLine: string; // e.g., '### Something'
  name: string; // e.g., 'Something'
  raw: string; // full block including headerLine and following content
}

export interface SectionParts {
  before: string;
  headerLine: string; // the '## SectionName' line
  preamble: string; // content between headerLine and first block
  bodyBlocks: Block[]; // parsed blocks in order
  after: string;
}

export function normalizeBlockName(name: string): string {
  return name.trim();
}

export const BLOCK_HEADER_REGEX = /^###\s+(.+)\s*$/;

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

/**
 * Extracts a named ## section from content and parses ### blocks within it.
 */
export function extractSection(content: string, sectionName: string): SectionParts {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');
  const sectionPattern = new RegExp(`^##\\s+${escapeRegExp(sectionName)}\\s*$`, 'i');
  const reqHeaderIndex = lines.findIndex(l => sectionPattern.test(l));

  if (reqHeaderIndex === -1) {
    // Section not found; create empty parts
    const before = content.trimEnd();
    const headerLine = `## ${sectionName}`;
    return {
      before: before ? before + '\n\n' : '',
      headerLine,
      preamble: '',
      bodyBlocks: [],
      after: '\n',
    };
  }

  // Find end of this section: next line that starts with '## ' at same or higher level
  let endIndex = lines.length;
  for (let i = reqHeaderIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const before = lines.slice(0, reqHeaderIndex).join('\n');
  const headerLine = lines[reqHeaderIndex];
  const sectionBodyLines = lines.slice(reqHeaderIndex + 1, endIndex);

  // Parse blocks within section body
  const blocks: Block[] = [];
  let cursor = 0;
  const preambleLines: string[] = [];

  // Collect preamble lines until first ### header
  while (cursor < sectionBodyLines.length && !BLOCK_HEADER_REGEX.test(sectionBodyLines[cursor])) {
    preambleLines.push(sectionBodyLines[cursor]);
    cursor++;
  }

  while (cursor < sectionBodyLines.length) {
    const headerLineCandidate = sectionBodyLines[cursor];
    const headerMatch = headerLineCandidate.match(BLOCK_HEADER_REGEX);
    if (!headerMatch) {
      // Not a block header; skip line defensively
      cursor++;
      continue;
    }
    const name = normalizeBlockName(headerMatch[1]);
    cursor++;
    // Gather lines until next ### header or end of section
    const bodyLines: string[] = [headerLineCandidate];
    while (cursor < sectionBodyLines.length && !BLOCK_HEADER_REGEX.test(sectionBodyLines[cursor]) && !/^##\s+/.test(sectionBodyLines[cursor])) {
      bodyLines.push(sectionBodyLines[cursor]);
      cursor++;
    }
    const raw = bodyLines.join('\n').trimEnd();
    blocks.push({ headerLine: headerLineCandidate, name, raw });
  }

  const after = lines.slice(endIndex).join('\n');
  const preamble = preambleLines.join('\n').trimEnd();

  return {
    before: before.trimEnd() ? before + '\n' : before,
    headerLine,
    preamble,
    bodyBlocks: blocks,
    after: after.startsWith('\n') ? after : '\n' + after,
  };
}

/**
 * Extracts all ## sections from content and returns a map of section name → SectionParts.
 */
export function extractAllSections(content: string): Record<string, SectionParts> {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');
  const result: Record<string, SectionParts> = {};

  // Find all ## section headers
  const sectionIndices: Array<{ name: string; index: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (m) {
      sectionIndices.push({ name: m[1], index: i });
    }
  }

  for (let s = 0; s < sectionIndices.length; s++) {
    const { name, index: startIndex } = sectionIndices[s];
    const endIndex = s + 1 < sectionIndices.length ? sectionIndices[s + 1].index : lines.length;

    const headerLine = lines[startIndex];
    const sectionBodyLines = lines.slice(startIndex + 1, endIndex);

    const blocks: Block[] = [];
    let cursor = 0;
    const preambleLines: string[] = [];

    while (cursor < sectionBodyLines.length && !BLOCK_HEADER_REGEX.test(sectionBodyLines[cursor])) {
      preambleLines.push(sectionBodyLines[cursor]);
      cursor++;
    }

    while (cursor < sectionBodyLines.length) {
      const headerLineCandidate = sectionBodyLines[cursor];
      const headerMatch = headerLineCandidate.match(BLOCK_HEADER_REGEX);
      if (!headerMatch) {
        cursor++;
        continue;
      }
      const blockName = normalizeBlockName(headerMatch[1]);
      cursor++;
      const bodyLines: string[] = [headerLineCandidate];
      while (cursor < sectionBodyLines.length && !BLOCK_HEADER_REGEX.test(sectionBodyLines[cursor]) && !/^##\s+/.test(sectionBodyLines[cursor])) {
        bodyLines.push(sectionBodyLines[cursor]);
        cursor++;
      }
      const raw = bodyLines.join('\n').trimEnd();
      blocks.push({ headerLine: headerLineCandidate, name: blockName, raw });
    }

    const before = lines.slice(0, startIndex).join('\n');
    const after = lines.slice(endIndex).join('\n');
    const preamble = preambleLines.join('\n').trimEnd();

    result[name] = {
      before: before.trimEnd() ? before + '\n' : before,
      headerLine,
      preamble,
      bodyBlocks: blocks,
      after: after.startsWith('\n') ? after : '\n' + after,
    };
  }

  return result;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Delta spec parsing (kept working for Task 2 to generalize further)
// ---------------------------------------------------------------------------

export interface SectionDeltaPlan {
  targetSection: string;
  added: Block[];
  modified: Block[];
  removed: string[];
  renamed: Array<{ from: string; to: string }>;
}

export interface DeltaPlan {
  sections: Record<string, SectionDeltaPlan>;
}

const DELTA_HEADER_REGEX = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+(.+?)\s*$/i;

/**
 * Parse a delta-formatted spec change file content into a DeltaPlan with raw blocks.
 * Matches `## OPERATION SectionName` headers and groups by target section.
 * Repeated headers targeting the same section are aggregated.
 */
export function parseDeltaSpec(content: string): DeltaPlan {
  const normalized = normalizeLineEndings(content);
  const lines = normalized.split('\n');
  const sections: Record<string, SectionDeltaPlan> = {};

  // Find all ## delta headers and their body ranges
  const headerEntries: Array<{ operation: string; targetSection: string; startLine: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DELTA_HEADER_REGEX);
    if (m) {
      headerEntries.push({
        operation: m[1].toUpperCase(),
        targetSection: m[2].trim(),
        startLine: i,
      });
    }
  }

  for (let h = 0; h < headerEntries.length; h++) {
    const entry = headerEntries[h];
    const bodyStart = entry.startLine + 1;
    const bodyEnd = h + 1 < headerEntries.length ? headerEntries[h + 1].startLine : lines.length;
    const body = lines.slice(bodyStart, bodyEnd).join('\n');
    const key = entry.targetSection;

    // Ensure section plan exists
    if (!sections[key]) {
      sections[key] = {
        targetSection: key,
        added: [],
        modified: [],
        removed: [],
        renamed: [],
      };
    }
    const plan = sections[key];

    switch (entry.operation) {
      case 'ADDED':
        plan.added.push(...parseBlocksFromSection(body));
        break;
      case 'MODIFIED':
        plan.modified.push(...parseBlocksFromSection(body));
        break;
      case 'REMOVED':
        plan.removed.push(...parseRemovedNames(body));
        break;
      case 'RENAMED':
        plan.renamed.push(...parseRenamedPairs(body));
        break;
    }
  }

  return { sections };
}


function parseBlocksFromSection(sectionBody: string): Block[] {
  if (!sectionBody) return [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    // Seek next block header
    while (i < lines.length && !BLOCK_HEADER_REGEX.test(lines[i])) i++;
    if (i >= lines.length) break;
    const headerLine = lines[i];
    const m = headerLine.match(BLOCK_HEADER_REGEX);
    if (!m) { i++; continue; }
    const name = normalizeBlockName(m[1]);
    const buf: string[] = [headerLine];
    i++;
    while (i < lines.length && !BLOCK_HEADER_REGEX.test(lines[i]) && !/^##\s+/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ headerLine, name, raw: buf.join('\n').trimEnd() });
  }
  return blocks;
}

export function parseRemovedNames(sectionBody: string): string[] {
  if (!sectionBody) return [];
  const names: string[] = [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  for (const line of lines) {
    const m = line.match(BLOCK_HEADER_REGEX);
    if (m) {
      names.push(normalizeBlockName(m[1]));
      continue;
    }
    // Also support bullet list of headers
    const bullet = line.match(/^\s*-\s*`?###\s+(.+?)`?\s*$/);
    if (bullet) {
      names.push(normalizeBlockName(bullet[1]));
    }
  }
  return names;
}

export function parseRenamedPairs(sectionBody: string): Array<{ from: string; to: string }> {
  if (!sectionBody) return [];
  const pairs: Array<{ from: string; to: string }> = [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  let current: { from?: string; to?: string } = {};
  for (const line of lines) {
    const fromMatch = line.match(/^\s*-?\s*FROM:\s*`?###\s+(.+?)`?\s*$/);
    const toMatch = line.match(/^\s*-?\s*TO:\s*`?###\s+(.+?)`?\s*$/);
    if (fromMatch) {
      current.from = normalizeBlockName(fromMatch[1]);
    } else if (toMatch) {
      current.to = normalizeBlockName(toMatch[1]);
      if (current.from && current.to) {
        pairs.push({ from: current.from, to: current.to });
        current = {};
      }
    }
  }
  return pairs;
}
