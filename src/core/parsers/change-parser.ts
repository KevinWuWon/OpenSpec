import { MarkdownParser } from './markdown-parser.js';
import { Change, Delta, DeltaOperation } from '../schemas/index.js';
import { parseDeltaSpec } from './block-parser.js';
import path from 'path';
import { promises as fs } from 'fs';

export class ChangeParser extends MarkdownParser {
  private changeDir: string;

  constructor(content: string, changeDir: string) {
    super(content);
    this.changeDir = changeDir;
  }

  async parseChangeWithDeltas(name: string): Promise<Change> {
    const sections = this.parseSections();
    const problem = this.findSection(sections, 'Problem')?.content || '';
    const constraints = this.findSection(sections, 'Constraints')?.content || '';
    const successCriteria = this.findSection(sections, 'Success Criteria')?.content || '';
    const nonGoals = this.findSection(sections, 'Non-goals')?.content || '';

    if (!problem.trim()) {
      throw new Error('Change must have a Problem section');
    }
    if (!constraints.trim()) {
      throw new Error('Change must have a Constraints section');
    }
    if (!successCriteria.trim()) {
      throw new Error('Change must have a Success Criteria section');
    }
    if (!nonGoals.trim()) {
      throw new Error('Change must have a Non-goals section');
    }

    // Check if there are spec files with delta format
    const specsDir = path.join(this.changeDir, 'specs');
    const deltas = await this.parseDeltaSpecs(specsDir);

    return {
      name,
      problem: problem.trim(),
      constraints: constraints.trim(),
      successCriteria: successCriteria.trim(),
      nonGoals: nonGoals.trim(),
      deltas,
      metadata: {
        version: '1.0.0',
        format: 'openspec-change',
      },
    };
  }

  private async parseDeltaSpecs(specsDir: string): Promise<Delta[]> {
    const deltas: Delta[] = [];

    try {
      const specDirs = await fs.readdir(specsDir, { withFileTypes: true });

      for (const dir of specDirs) {
        if (!dir.isDirectory()) continue;

        const specName = dir.name;
        const specFile = path.join(specsDir, specName, 'spec.md');

        try {
          const content = await fs.readFile(specFile, 'utf-8');
          const specDeltas = this.parseSpecDeltas(specName, content);
          deltas.push(...specDeltas);
        } catch (error) {
          // Spec file might not exist, which is okay
          continue;
        }
      }
    } catch (error) {
      // Specs directory might not exist, which is okay
      return [];
    }

    return deltas;
  }

  private parseSpecDeltas(specName: string, content: string): Delta[] {
    const plan = parseDeltaSpec(content);
    const deltas: Delta[] = [];

    for (const sectionPlan of Object.values(plan.sections)) {
      for (const block of sectionPlan.added) {
        deltas.push({
          spec: specName,
          operation: 'ADDED' as DeltaOperation,
          description: `Add block: ${block.name}`,
          requirement: { text: block.name },
          requirements: [{ text: block.name }],
        });
      }

      for (const block of sectionPlan.modified) {
        deltas.push({
          spec: specName,
          operation: 'MODIFIED' as DeltaOperation,
          description: `Modify block: ${block.name}`,
          requirement: { text: block.name },
          requirements: [{ text: block.name }],
        });
      }

      for (const name of sectionPlan.removed) {
        deltas.push({
          spec: specName,
          operation: 'REMOVED' as DeltaOperation,
          description: `Remove block: ${name}`,
          requirement: { text: name },
          requirements: [{ text: name }],
        });
      }

      for (const rename of sectionPlan.renamed) {
        deltas.push({
          spec: specName,
          operation: 'RENAMED' as DeltaOperation,
          description: `Rename block from "${rename.from}" to "${rename.to}"`,
          rename,
        });
      }
    }

    return deltas;
  }
}
