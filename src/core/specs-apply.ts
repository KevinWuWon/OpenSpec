/**
 * Spec Application Logic
 *
 * Extracted from ArchiveCommand to enable standalone spec application.
 * Applies delta specs from a change to main specs without archiving.
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import {
  extractSection,
  parseDeltaSpec,
  normalizeBlockName,
  type Block,
  type SectionDeltaPlan,
} from './parsers/block-parser.js';
import { Validator } from './validation/validator.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SpecUpdate {
  source: string;
  target: string;
  exists: boolean;
}

export interface ApplyResult {
  capability: string;
  added: number;
  modified: number;
  removed: number;
  renamed: number;
}

export interface SpecsApplyOutput {
  changeName: string;
  capabilities: ApplyResult[];
  totals: {
    added: number;
    modified: number;
    removed: number;
    renamed: number;
  };
  noChanges: boolean;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Find all delta spec files that need to be applied from a change.
 */
export async function findSpecUpdates(changeDir: string, mainSpecsDir: string): Promise<SpecUpdate[]> {
  const updates: SpecUpdate[] = [];
  const changeSpecsDir = path.join(changeDir, 'specs');

  try {
    const entries = await fs.readdir(changeSpecsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const specFile = path.join(changeSpecsDir, entry.name, 'spec.md');
        const targetFile = path.join(mainSpecsDir, entry.name, 'spec.md');

        try {
          await fs.access(specFile);

          // Check if target exists
          let exists = false;
          try {
            await fs.access(targetFile);
            exists = true;
          } catch {
            exists = false;
          }

          updates.push({
            source: specFile,
            target: targetFile,
            exists,
          });
        } catch {
          // Source spec doesn't exist, skip
        }
      }
    }
  } catch {
    // No specs directory in change
  }

  return updates;
}

/**
 * Build an updated spec by applying delta operations.
 * Returns the rebuilt content and counts of operations.
 */
export async function buildUpdatedSpec(
  update: SpecUpdate,
  changeName: string
): Promise<{ rebuilt: string; counts: { added: number; modified: number; removed: number; renamed: number } }> {
  // Read change spec content (delta-format expected)
  const changeContent = await fs.readFile(update.source, 'utf-8');

  // Parse deltas from the change spec file
  const plan = parseDeltaSpec(changeContent);
  const specName = path.basename(path.dirname(update.target));
  const sectionPlans = Object.values(plan.sections);

  // Pre-validate duplicates and cross-operation conflicts within each target section
  for (const sp of sectionPlans) {
    validateSectionDeltaPlan(specName, sp);
  }

  // Check that there are any deltas at all
  const hasAnyDelta = sectionPlans.some(
    sp => sp.added.length + sp.modified.length + sp.removed.length + sp.renamed.length > 0
  );
  if (!hasAnyDelta) {
    throw new Error(
      `Delta parsing found no operations for ${path.basename(path.dirname(update.source))}. ` +
        `Provide ADDED/MODIFIED/REMOVED/RENAMED sections in change spec.`
    );
  }

  // Compute totals across all sections
  const counts = { added: 0, modified: 0, removed: 0, renamed: 0 };
  for (const sp of sectionPlans) {
    counts.added += sp.added.length;
    counts.modified += sp.modified.length;
    counts.removed += sp.removed.length;
    counts.renamed += sp.renamed.length;
  }

  // Load or create base target content
  let targetContent: string;
  let isNewSpec = false;
  try {
    targetContent = await fs.readFile(update.target, 'utf-8');
  } catch {
    // Target spec does not exist; only ADDED operations are allowed for new specs
    const hasNonAdded = sectionPlans.some(
      sp => sp.modified.length > 0 || sp.removed.length > 0 || sp.renamed.length > 0
    );
    if (hasNonAdded) {
      throw new Error(
        `${specName}: target spec does not exist; only ADDED blocks are allowed for new specs. MODIFIED, REMOVED, and RENAMED operations require an existing spec.`
      );
    }
    isNewSpec = true;
    // Seed skeleton with only ADDED section targets, in first-appearance order
    const addedSectionNames = Object.keys(plan.sections);
    targetContent = buildSpecSkeleton(specName, changeName, addedSectionNames);
  }

  // Apply deltas per target section
  let rebuilt = targetContent;
  for (const sp of sectionPlans) {
    rebuilt = applySectionDelta(rebuilt, sp, specName, isNewSpec);
  }

  // Clean up excessive newlines
  rebuilt = rebuilt.replace(/\n{3,}/g, '\n\n');

  return { rebuilt, counts };
}

/**
 * Write an updated spec to disk.
 */
export async function writeUpdatedSpec(
  update: SpecUpdate,
  rebuilt: string,
  counts: { added: number; modified: number; removed: number; renamed: number }
): Promise<void> {
  // Create target directory if needed
  const targetDir = path.dirname(update.target);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(update.target, rebuilt);

  const specName = path.basename(path.dirname(update.target));
  console.log(`Applying changes to openspec/specs/${specName}/spec.md:`);
  if (counts.added) console.log(`  + ${counts.added} added`);
  if (counts.modified) console.log(`  ~ ${counts.modified} modified`);
  if (counts.removed) console.log(`  - ${counts.removed} removed`);
  if (counts.renamed) console.log(`  → ${counts.renamed} renamed`);
}

/**
 * Build a skeleton spec for new capabilities.
 * Seeds only the given section names (from ADDED targets) instead of hardcoding ## Requirements.
 */
export function buildSpecSkeleton(specFolderName: string, changeName: string, sectionNames: string[] = []): string {
  let content = `# ${specFolderName} Specification\n\n## Purpose\nTBD - created by archiving change ${changeName}. Update Purpose after archive.\n`;
  for (const name of sectionNames) {
    content += `\n## ${name}\n`;
  }
  return content;
}

/**
 * Apply all delta specs from a change to main specs.
 *
 * @param projectRoot - The project root directory
 * @param changeName - The name of the change to apply
 * @param options - Options for the operation
 * @returns Result of the operation with counts
 */
export async function applySpecs(
  projectRoot: string,
  changeName: string,
  options: {
    dryRun?: boolean;
    skipValidation?: boolean;
    silent?: boolean;
  } = {}
): Promise<SpecsApplyOutput> {
  const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
  const mainSpecsDir = path.join(projectRoot, 'openspec', 'specs');

  // Verify change exists
  try {
    const stat = await fs.stat(changeDir);
    if (!stat.isDirectory()) {
      throw new Error(`Change '${changeName}' not found.`);
    }
  } catch {
    throw new Error(`Change '${changeName}' not found.`);
  }

  // Find specs to update
  const specUpdates = await findSpecUpdates(changeDir, mainSpecsDir);

  if (specUpdates.length === 0) {
    return {
      changeName,
      capabilities: [],
      totals: { added: 0, modified: 0, removed: 0, renamed: 0 },
      noChanges: true,
    };
  }

  // Prepare all updates first (validation pass, no writes)
  const prepared: Array<{
    update: SpecUpdate;
    rebuilt: string;
    counts: { added: number; modified: number; removed: number; renamed: number };
  }> = [];

  for (const update of specUpdates) {
    const built = await buildUpdatedSpec(update, changeName);
    prepared.push({ update, rebuilt: built.rebuilt, counts: built.counts });
  }

  // Validate rebuilt specs unless validation is skipped
  if (!options.skipValidation) {
    const validator = new Validator();
    for (const p of prepared) {
      const specName = path.basename(path.dirname(p.update.target));
      const report = await validator.validateSpecContent(specName, p.rebuilt);
      if (!report.valid) {
        const errors = report.issues
          .filter((i) => i.level === 'ERROR')
          .map((i) => `  ✗ ${i.message}`)
          .join('\n');
        throw new Error(`Validation errors in rebuilt spec for ${specName}:\n${errors}`);
      }
    }
  }

  // Build results
  const capabilities: ApplyResult[] = [];
  const totals = { added: 0, modified: 0, removed: 0, renamed: 0 };

  for (const p of prepared) {
    const capability = path.basename(path.dirname(p.update.target));

    if (!options.dryRun) {
      // Write the updated spec
      const targetDir = path.dirname(p.update.target);
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(p.update.target, p.rebuilt);

      if (!options.silent) {
        console.log(`Applying changes to openspec/specs/${capability}/spec.md:`);
        if (p.counts.added) console.log(`  + ${p.counts.added} added`);
        if (p.counts.modified) console.log(`  ~ ${p.counts.modified} modified`);
        if (p.counts.removed) console.log(`  - ${p.counts.removed} removed`);
        if (p.counts.renamed) console.log(`  → ${p.counts.renamed} renamed`);
      }
    } else if (!options.silent) {
      console.log(`Would apply changes to openspec/specs/${capability}/spec.md:`);
      if (p.counts.added) console.log(`  + ${p.counts.added} added`);
      if (p.counts.modified) console.log(`  ~ ${p.counts.modified} modified`);
      if (p.counts.removed) console.log(`  - ${p.counts.removed} removed`);
      if (p.counts.renamed) console.log(`  → ${p.counts.renamed} renamed`);
    }

    capabilities.push({
      capability,
      ...p.counts,
    });

    totals.added += p.counts.added;
    totals.modified += p.counts.modified;
    totals.removed += p.counts.removed;
    totals.renamed += p.counts.renamed;
  }

  return {
    changeName,
    capabilities,
    totals,
    noChanges: false,
  };
}

// ---------------------------------------------------------------------------
// Section-level validation and apply helpers
// ---------------------------------------------------------------------------

function sectionExistsInContent(content: string, sectionName: string): boolean {
  const normalized = content.replace(/\r\n?/g, '\n');
  const target = sectionName.trim().toLowerCase();
  return normalized.split('\n').some(line => {
    const m = line.match(/^##\s+(.+?)\s*$/);
    return m !== null && m[1].trim().toLowerCase() === target;
  });
}

function validateSectionDeltaPlan(specName: string, sp: SectionDeltaPlan): void {
  const addedNames = new Set<string>();
  for (const add of sp.added) {
    const name = normalizeBlockName(add.name);
    if (addedNames.has(name)) {
      throw new Error(
        `${specName} validation failed - duplicate block in ADDED for header "### ${add.name}"`
      );
    }
    addedNames.add(name);
  }
  const modifiedNames = new Set<string>();
  for (const mod of sp.modified) {
    const name = normalizeBlockName(mod.name);
    if (modifiedNames.has(name)) {
      throw new Error(
        `${specName} validation failed - duplicate block in MODIFIED for header "### ${mod.name}"`
      );
    }
    modifiedNames.add(name);
  }
  const removedNamesSet = new Set<string>();
  for (const rem of sp.removed) {
    const name = normalizeBlockName(rem);
    if (removedNamesSet.has(name)) {
      throw new Error(
        `${specName} validation failed - duplicate block in REMOVED for header "### ${rem}"`
      );
    }
    removedNamesSet.add(name);
  }
  const renamedFromSet = new Set<string>();
  const renamedToSet = new Set<string>();
  for (const { from, to } of sp.renamed) {
    const fromNorm = normalizeBlockName(from);
    const toNorm = normalizeBlockName(to);
    if (renamedFromSet.has(fromNorm)) {
      throw new Error(
        `${specName} validation failed - duplicate FROM in RENAMED for header "### ${from}"`
      );
    }
    if (renamedToSet.has(toNorm)) {
      throw new Error(
        `${specName} validation failed - duplicate TO in RENAMED for header "### ${to}"`
      );
    }
    renamedFromSet.add(fromNorm);
    renamedToSet.add(toNorm);
  }

  // Cross-operation conflicts within this target section
  const conflicts: Array<{ name: string; a: string; b: string }> = [];
  for (const n of modifiedNames) {
    if (removedNamesSet.has(n)) conflicts.push({ name: n, a: 'MODIFIED', b: 'REMOVED' });
    if (addedNames.has(n)) conflicts.push({ name: n, a: 'MODIFIED', b: 'ADDED' });
  }
  for (const n of addedNames) {
    if (removedNamesSet.has(n)) conflicts.push({ name: n, a: 'ADDED', b: 'REMOVED' });
  }
  for (const { from, to } of sp.renamed) {
    const fromNorm = normalizeBlockName(from);
    const toNorm = normalizeBlockName(to);
    if (modifiedNames.has(fromNorm)) {
      throw new Error(
        `${specName} validation failed - when a rename exists, MODIFIED must reference the NEW header "### ${to}"`
      );
    }
    if (addedNames.has(toNorm)) {
      throw new Error(
        `${specName} validation failed - RENAMED TO header collides with ADDED for "### ${to}"`
      );
    }
  }
  if (conflicts.length > 0) {
    const c = conflicts[0];
    throw new Error(
      `${specName} validation failed - block present in multiple sections (${c.a} and ${c.b}) for header "### ${c.name}"`
    );
  }
}

function applySectionDelta(
  content: string,
  sp: SectionDeltaPlan,
  specName: string,
  isNewSpec: boolean
): string {
  // Check if section exists in content before extracting
  const sectionFound = sectionExistsInContent(content, sp.targetSection);
  if (!sectionFound) {
    const hasNonAdded = sp.modified.length > 0 || sp.removed.length > 0 || sp.renamed.length > 0;
    if (hasNonAdded) {
      throw new Error(
        `${specName}: section "## ${sp.targetSection}" not found; MODIFIED, REMOVED, and RENAMED require an existing section. Only ADDED can create new sections.`
      );
    }
  }

  const parts = extractSection(content, sp.targetSection);
  const nameToBlock = new Map<string, Block>();
  for (const block of parts.bodyBlocks) {
    nameToBlock.set(normalizeBlockName(block.name), block);
  }

  // Apply operations in order: RENAMED → REMOVED → MODIFIED → ADDED
  for (const r of sp.renamed) {
    const from = normalizeBlockName(r.from);
    const to = normalizeBlockName(r.to);
    if (!nameToBlock.has(from)) {
      throw new Error(`${specName} RENAMED failed for header "### ${r.from}" - source not found`);
    }
    if (nameToBlock.has(to)) {
      throw new Error(`${specName} RENAMED failed for header "### ${r.to}" - target already exists`);
    }
    const block = nameToBlock.get(from)!;
    const newHeader = `### ${to}`;
    const rawLines = block.raw.split('\n');
    rawLines[0] = newHeader;
    const renamedBlock: Block = {
      headerLine: newHeader,
      name: to,
      raw: rawLines.join('\n'),
    };
    nameToBlock.delete(from);
    nameToBlock.set(to, renamedBlock);
  }

  for (const name of sp.removed) {
    const key = normalizeBlockName(name);
    if (!nameToBlock.has(key)) {
      if (!isNewSpec) {
        throw new Error(`${specName} REMOVED failed for header "### ${name}" - not found`);
      }
      continue;
    }
    nameToBlock.delete(key);
  }

  for (const mod of sp.modified) {
    const key = normalizeBlockName(mod.name);
    if (!nameToBlock.has(key)) {
      throw new Error(`${specName} MODIFIED failed for header "### ${mod.name}" - not found`);
    }
    const modHeaderMatch = mod.raw.split('\n')[0].match(/^###\s+(.+)\s*$/);
    if (!modHeaderMatch || normalizeBlockName(modHeaderMatch[1]) !== key) {
      throw new Error(
        `${specName} MODIFIED failed for header "### ${mod.name}" - header mismatch in content`
      );
    }
    nameToBlock.set(key, mod);
  }

  for (const add of sp.added) {
    const key = normalizeBlockName(add.name);
    if (nameToBlock.has(key)) {
      throw new Error(`${specName} ADDED failed for header "### ${add.name}" - already exists`);
    }
    nameToBlock.set(key, add);
  }

  // Recompose section preserving original ordering where possible
  const keptOrder: Block[] = [];
  const seen = new Set<string>();
  for (const block of parts.bodyBlocks) {
    const key = normalizeBlockName(block.name);
    const replacement = nameToBlock.get(key);
    if (replacement) {
      keptOrder.push(replacement);
      seen.add(key);
    }
  }
  for (const [key, block] of nameToBlock.entries()) {
    if (!seen.has(key)) {
      keptOrder.push(block);
    }
  }

  const reqBody = [parts.preamble && parts.preamble.trim() ? parts.preamble.trimEnd() : '']
    .filter(Boolean)
    .concat(keptOrder.map((b) => b.raw))
    .join('\n\n')
    .trimEnd();

  const rebuilt = [parts.before.trimEnd(), parts.headerLine, reqBody, parts.after]
    .filter((s, idx) => !(idx === 0 && s === ''))
    .join('\n');

  return rebuilt;
}
