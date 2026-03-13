/**
 * Status Command
 *
 * Displays artifact completion status for a change.
 */

import ora from 'ora';
import chalk from 'chalk';
import * as fs from 'fs';
import path from 'path';
import {
  loadChangeContext,
  formatChangeStatus,
  resolveSchema,
  type ChangeStatus,
} from '../../core/artifact-graph/index.js';
import {
  validateChangeExists,
  validateSchemaExists,
  getAvailableChanges,
  getStatusIndicator,
  getStatusColor,
  parseTaskItems,
  type TaskItem,
} from './shared.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface StatusOptions {
  change?: string;
  schema?: string;
  json?: boolean;
}

// -----------------------------------------------------------------------------
// Command Implementation
// -----------------------------------------------------------------------------

export async function statusCommand(options: StatusOptions): Promise<void> {
  const spinner = ora('Loading change status...').start();

  try {
    const projectRoot = process.cwd();

    // Handle no-changes case gracefully — status is informational,
    // so "no changes" is a valid state, not an error.
    if (!options.change) {
      const available = await getAvailableChanges(projectRoot);
      if (available.length === 0) {
        spinner.stop();
        if (options.json) {
          console.log(JSON.stringify({ changes: [], message: 'No active changes.' }, null, 2));
          return;
        }
        console.log('No active changes. Create one with: openspec new change <name>');
        return;
      }
      // Changes exist but --change not provided
      spinner.stop();
      throw new Error(
        `Missing required option --change. Available changes:\n  ${available.join('\n  ')}`
      );
    }

    const changeName = await validateChangeExists(options.change, projectRoot);

    // Validate schema if explicitly provided
    if (options.schema) {
      validateSchemaExists(options.schema, projectRoot);
    }

    // loadChangeContext will auto-detect schema from metadata if not provided
    const context = loadChangeContext(projectRoot, changeName, options.schema);
    const status = formatChangeStatus(context);

    // Load task progress from heading-based tracking if schema has a tracks file
    const schema = resolveSchema(context.schemaName, projectRoot);
    const tracksFile = schema.apply?.tracks ?? null;
    let tasks: TaskItem[] = [];
    if (tracksFile) {
      const tracksPath = path.join(context.changeDir, tracksFile);
      if (fs.existsSync(tracksPath)) {
        const content = fs.readFileSync(tracksPath, 'utf-8');
        tasks = parseTaskItems(content);
      }
    }

    spinner.stop();

    if (options.json) {
      const total = tasks.length;
      const complete = tasks.filter(t => t.done).length;
      console.log(JSON.stringify({
        ...status,
        taskProgress: total > 0 ? { total, complete, remaining: total - complete } : undefined,
        tasks: tasks.length > 0 ? tasks : undefined,
      }, null, 2));
      return;
    }

    printStatusText(status, tasks);
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

export function printStatusText(status: ChangeStatus, tasks: TaskItem[] = []): void {
  const doneCount = status.artifacts.filter((a) => a.status === 'done').length;
  const total = status.artifacts.length;

  console.log(`Change: ${status.changeName}`);
  console.log(`Schema: ${status.schemaName}`);
  console.log(`Progress: ${doneCount}/${total} artifacts complete`);
  console.log();

  for (const artifact of status.artifacts) {
    const indicator = getStatusIndicator(artifact.status);
    const color = getStatusColor(artifact.status);
    let line = `${indicator} ${artifact.id}`;

    if (artifact.status === 'blocked' && artifact.missingDeps && artifact.missingDeps.length > 0) {
      line += color(` (blocked by: ${artifact.missingDeps.join(', ')})`);
    }

    console.log(line);
  }

  if (status.isComplete) {
    console.log();
    console.log(chalk.green('All artifacts complete!'));
  }

  // Task progress from heading-based tracking
  if (tasks.length > 0) {
    const tasksDone = tasks.filter(t => t.done).length;
    console.log();
    console.log(`Tasks: ${tasksDone}/${tasks.length} complete`);
    for (const task of tasks) {
      const mark = task.done ? '[x]' : '[ ]';
      console.log(`  ${mark} Task ${task.id}: ${task.description}`);
    }
  }
}
