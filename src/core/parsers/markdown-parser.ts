import { Spec, Change } from '../schemas/index.js';

export interface Section {
  level: number;
  title: string;
  content: string;
  children: Section[];
}

export class MarkdownParser {
  private lines: string[];
  private currentLine: number;

  constructor(content: string) {
    const normalized = MarkdownParser.normalizeContent(content);
    this.lines = normalized.split('\n');
    this.currentLine = 0;
  }

  protected static normalizeContent(content: string): string {
    return content.replace(/\r\n?/g, '\n');
  }

  parseSpec(name: string): Spec {
    const allSections = this.parseSections();
    const level2Sections = this.collectSectionsAtLevel(allSections, 2);

    if (level2Sections.length === 0) {
      throw new Error('Spec must have at least one ## section');
    }

    const sections: Record<string, { blocks: Array<{ name: string; text: string }> }> = {};

    for (const section of level2Sections) {
      const blocks: Array<{ name: string; text: string }> = [];
      for (const child of section.children) {
        if (child.level === 3) {
          blocks.push({
            name: child.title,
            text: this.extractBlockText(child),
          });
        }
      }
      sections[section.title] = { blocks };
    }

    return {
      name,
      sections,
      metadata: {
        version: '1.0.0',
        format: 'openspec',
      },
    };
  }

  parseChange(name: string): Change {
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

    return {
      name,
      problem: problem.trim(),
      constraints: constraints.trim(),
      successCriteria: successCriteria.trim(),
      nonGoals: nonGoals.trim(),
      deltas: [],
      metadata: {
        version: '1.0.0',
        format: 'openspec-change',
      },
    };
  }

  protected parseSections(): Section[] {
    const sections: Section[] = [];
    const stack: Section[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const content = this.getContentUntilNextHeader(i + 1, level);

        const section: Section = {
          level,
          title,
          content,
          children: [],
        };

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        if (stack.length === 0) {
          sections.push(section);
        } else {
          stack[stack.length - 1].children.push(section);
        }

        stack.push(section);
      }
    }

    return sections;
  }

  protected getContentUntilNextHeader(startLine: number, currentLevel: number): string {
    const contentLines: string[] = [];

    for (let i = startLine; i < this.lines.length; i++) {
      const line = this.lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+/);

      if (headerMatch && headerMatch[1].length <= currentLevel) {
        break;
      }

      contentLines.push(line);
    }

    return contentLines.join('\n').trim();
  }

  protected findSection(sections: Section[], title: string): Section | undefined {
    for (const section of sections) {
      if (section.title.toLowerCase() === title.toLowerCase()) {
        return section;
      }
      const child = this.findSection(section.children, title);
      if (child) {
        return child;
      }
    }
    return undefined;
  }

  private collectSectionsAtLevel(sections: Section[], level: number): Section[] {
    const result: Section[] = [];
    for (const section of sections) {
      if (section.level === level) {
        result.push(section);
      }
      result.push(...this.collectSectionsAtLevel(section.children, level));
    }
    return result;
  }

  private extractBlockText(section: Section): string {
    // Get content before any child sections
    const lines = section.content.split('\n');
    const contentBeforeChildren: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('#')) {
        break;
      }
      contentBeforeChildren.push(line);
    }

    return contentBeforeChildren.join('\n').trim();
  }
}
