// Rules for dated entries (experience and timeline), kept pure and type-erasable so the
// schemas in src/content.config.ts and the tests share them. No imports.

export interface Dated {
  start?: Date;
  end?: Date;
}

export interface EntryFields extends Dated {
  title?: string;
  project?: unknown;
  linkLabel?: string;
}

export interface Issue {
  path: string;
  message: string;
}

/** An end needs a start, and cannot come before it. */
export function datedIssues(data: Dated): Issue[] {
  const issues: Issue[] = [];
  if (data.end && !data.start) issues.push({ path: 'end', message: 'An end needs a start' });
  if (data.start && data.end && data.end < data.start) {
    issues.push({ path: 'end', message: 'The end is before the start' });
  }
  return issues;
}

/**
 * An entry that names a project takes its dates and link target from it, so it has no
 * dates of its own. `needsStart`: without a project the entry must give a start.
 * `needsTitle`: the title is required even with a project.
 */
export function entryIssues(data: EntryFields, rules: { needsStart: boolean; needsTitle: boolean }): Issue[] {
  const issues = datedIssues(data);
  if (data.project && (data.start || data.end)) {
    issues.push({ path: 'project', message: 'Dates come from the project; remove start and end' });
  }
  if (!data.title && (rules.needsTitle || !data.project)) {
    issues.push({ path: 'title', message: 'A title is needed' });
  }
  if (!data.project && data.linkLabel) {
    issues.push({ path: 'linkLabel', message: 'A link label needs a project to link to' });
  }
  if (rules.needsStart && !data.project && !data.start) {
    issues.push({ path: 'start', message: 'Give a start, or name a project' });
  }
  return issues;
}

/** The dates and link target of an entry: the project's when it names one, else its own. */
export function entryFacts(entry: Dated, project?: Dated & { href: string }): Dated & { href?: string } {
  if (project) return { start: project.start, end: project.end, href: project.href };
  return { start: entry.start, end: entry.end };
}
