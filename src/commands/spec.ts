import { program } from 'commander';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { MarkdownParser } from '../core/parsers/markdown-parser.js';
import { Validator } from '../core/validation/validator.js';
import type { Spec } from '../core/schemas/index.js';
import { isInteractive } from '../utils/interactive.js';
import { getSpecIds } from '../utils/item-discovery.js';

const SPECS_DIR = 'openspec/specs';

interface ShowOptions {
  json?: boolean;
  noInteractive?: boolean;
}

function parseSpecFromFile(specPath: string, specId: string): Spec {
  const content = readFileSync(specPath, 'utf-8');
  const parser = new MarkdownParser(content);
  return parser.parseSpec(specId);
}

function totalBlockCount(spec: Spec): number {
  return Object.values(spec.sections).reduce((sum, section) => sum + section.blocks.length, 0);
}

export class SpecCommand {
  private SPECS_DIR = 'openspec/specs';

  async show(specId?: string, options: ShowOptions = {}): Promise<void> {
    if (!specId) {
      const canPrompt = isInteractive(options);
      const specIds = await getSpecIds();
      if (canPrompt && specIds.length > 0) {
        const { select } = await import('@inquirer/prompts');
        specId = await select({
          message: 'Select a spec to show',
          choices: specIds.map(id => ({ name: id, value: id })),
        });
      } else {
        throw new Error('Missing required argument <spec-id>');
      }
    }

    const specPath = join(this.SPECS_DIR, specId, 'spec.md');
    if (!existsSync(specPath)) {
      throw new Error(`Spec '${specId}' not found at openspec/specs/${specId}/spec.md`);
    }

    if (options.json) {
      const parsed = parseSpecFromFile(specPath, specId);
      const output = {
        id: specId,
        title: parsed.name,
        sections: parsed.sections,
        blockCount: totalBlockCount(parsed),
        metadata: parsed.metadata ?? { version: '1.0.0', format: 'openspec' as const },
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    // Raw-first: print markdown content without any formatting
    const content = readFileSync(specPath, 'utf-8');
    console.log(content);
  }
}

export function registerSpecCommand(rootProgram: typeof program) {
  const specCommand = rootProgram
    .command('spec')
    .description('Manage and view OpenSpec specifications');

  // Deprecation notice for noun-based commands
  specCommand.hook('preAction', () => {
    console.error('Warning: The "openspec spec ..." commands are deprecated. Prefer verb-first commands (e.g., "openspec show", "openspec validate --specs").');
  });

  specCommand
    .command('show [spec-id]')
    .description('Display a specific specification')
    .option('--json', 'Output as JSON')
    .option('--no-interactive', 'Disable interactive prompts')
    .action(async (specId: string | undefined, options: ShowOptions & { noInteractive?: boolean }) => {
      try {
        const cmd = new SpecCommand();
        await cmd.show(specId, options as any);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exitCode = 1;
      }
    });

  specCommand
    .command('list')
    .description('List all available specifications')
    .option('--json', 'Output as JSON')
    .option('--long', 'Show id and title with counts')
    .action((options: { json?: boolean; long?: boolean }) => {
      try {
        if (!existsSync(SPECS_DIR)) {
          console.log('No items found');
          return;
        }

        const specs = readdirSync(SPECS_DIR, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => {
            const specPath = join(SPECS_DIR, dirent.name, 'spec.md');
            if (existsSync(specPath)) {
              try {
                const spec = parseSpecFromFile(specPath, dirent.name);

                return {
                  id: dirent.name,
                  title: spec.name,
                  blockCount: totalBlockCount(spec),
                };
              } catch {
                return {
                  id: dirent.name,
                  title: dirent.name,
                  blockCount: 0,
                };
              }
            }
            return null;
          })
          .filter((spec): spec is { id: string; title: string; blockCount: number } => spec !== null)
          .sort((a, b) => a.id.localeCompare(b.id));

        if (options.json) {
          console.log(JSON.stringify(specs, null, 2));
        } else {
          if (specs.length === 0) {
            console.log('No items found');
            return;
          }
          if (!options.long) {
            specs.forEach(spec => console.log(spec.id));
            return;
          }
          specs.forEach(spec => {
            console.log(`${spec.id}: ${spec.title} [blocks ${spec.blockCount}]`);
          });
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exitCode = 1;
      }
    });

  specCommand
    .command('validate [spec-id]')
    .description('Validate a specification structure')
    .option('--strict', 'Enable strict validation mode')
    .option('--json', 'Output validation report as JSON')
    .option('--no-interactive', 'Disable interactive prompts')
    .action(async (specId: string | undefined, options: { strict?: boolean; json?: boolean; noInteractive?: boolean }) => {
      try {
        if (!specId) {
          const canPrompt = isInteractive(options);
          const specIds = await getSpecIds();
          if (canPrompt && specIds.length > 0) {
            const { select } = await import('@inquirer/prompts');
            specId = await select({
              message: 'Select a spec to validate',
              choices: specIds.map(id => ({ name: id, value: id })),
            });
          } else {
            throw new Error('Missing required argument <spec-id>');
          }
        }

        const specPath = join(SPECS_DIR, specId, 'spec.md');

        if (!existsSync(specPath)) {
          throw new Error(`Spec '${specId}' not found at openspec/specs/${specId}/spec.md`);
        }

        const validator = new Validator(options.strict);
        const report = await validator.validateSpec(specPath);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          if (report.valid) {
            console.log(`Specification '${specId}' is valid`);
          } else {
            console.error(`Specification '${specId}' has issues`);
            report.issues.forEach(issue => {
              const label = issue.level === 'ERROR' ? 'ERROR' : issue.level;
              const prefix = issue.level === 'ERROR' ? '✗' : issue.level === 'WARNING' ? '⚠' : 'ℹ';
              console.error(`${prefix} [${label}] ${issue.path}: ${issue.message}`);
            });
          }
        }
        process.exitCode = report.valid ? 0 : 1;
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exitCode = 1;
      }
    });

  return specCommand;
}
