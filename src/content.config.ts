// Typed schemas for the four collections (AD-4). Facts live in src/content only.
// Dates are ISO days (YYYY-MM-DD) with day 01, since only the month and year are known;
// they and the status become words only in src/lib/format.ts.
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { datedIssues, entryIssues, type Issue } from './lib/content-rules';
import { STATUSES, fillTemplate, type TemplateFacts } from './lib/format';

const text = z.string().trim().min(1);

// YAML reads a bare 2026-05-01 as a date and a quoted one as text; both are accepted.
const isoDate = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date, YYYY-MM-DD')])
  .refine(
    (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      // "2026-02-31" would roll over into March.
      return typeof value !== 'string' || date.toISOString().slice(0, 10) === value;
    },
    { message: 'Not a real date' },
  )
  .transform((value) => new Date(value));

const report = (issues: readonly Issue[], ctx: z.RefinementCtx) => {
  for (const issue of issues) ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
};

// Every template line must fill from the entry's own facts, so a bad token fails the build here.
const fills = (template: string, facts: TemplateFacts, path: (string | number)[], ctx: z.RefinementCtx) => {
  try {
    fillTemplate(template, facts);
  } catch (error) {
    ctx.addIssue({ code: 'custom', path, message: error instanceof Error ? error.message : String(error) });
  }
};

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z
    .strictObject({
      /** Work entry and page title. */
      title: text,
      /** Contact print name. */
      printName: text,
      /** Timeline name. */
      timelineName: text,
      start: isoDate.optional(),
      end: isoDate.optional(),
      status: z.enum(STATUSES),
      /** The in-site page for this project. */
      href: z.string().regex(/^\/[a-z0-9-]*$/, 'Use an in-site path such as /career-star'),
      summary: text,
      stack: z.array(text),
      order: z.number().int(),
      liveUrl: z.url().optional(),
      // Lines below are templates for fillTemplate: {range} {since} {season} {term} {status} {stack}.
      print: z.strictObject({
        meta: text,
        /** Accessible name of the print, after "Frame n:". */
        label: text,
        /** The line typeset on a print that has no picture. */
        note: text.optional(),
      }),
      work: z.strictObject({
        tag: text,
        linkLabel: text,
        /** Accessible name of the visual link. */
        visualLabel: text.optional(),
        /** A typeset plate in place of a picture. */
        plate: z.strictObject({ source: text, text }).optional(),
      }),
    })
    .superRefine((data, ctx) => {
      report(datedIssues(data), ctx);
      fills(data.print.meta, data, ['print', 'meta'], ctx);
      fills(data.print.label, data, ['print', 'label'], ctx);
      fills(data.work.tag, data, ['work', 'tag'], ctx);
      if (data.work.plate) fills(data.work.plate.source, data, ['work', 'plate', 'source'], ctx);
    }),
});

// A dated row. An entry that names a project takes its dates and link target from it;
// its org may use the template tokens, filled from the project.
const entryShape = {
  title: text.optional(),
  org: text,
  description: text,
  start: isoDate.optional(),
  end: isoDate.optional(),
  project: reference('projects').optional(),
  /** Words of the link to the project page, shown after the description. */
  linkLabel: text.optional(),
};

const experience = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/experience' }),
  schema: z
    .discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('experience'), ...entryShape }),
      z.strictObject({
        kind: z.literal('education'),
        school: text,
        degree: text,
        minor: text,
        start: isoDate,
        end: isoDate,
        gpa: z.number().positive(),
        gpaScale: z.number().positive(),
        coursework: z.array(text).min(1),
      }),
    ])
    .superRefine((data, ctx) => {
      if (data.kind === 'education') return report(datedIssues(data), ctx);
      // Exactly one of an own start or a project; the Experience name is always written out.
      report(entryIssues(data, { needsStart: true, needsTitle: true }), ctx);
    }),
});

// The experience shape, where no start and no project means "Now" in the build year,
// and an entry that names a project may leave its title to the project's timelineName.
const timeline = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/timeline' }),
  schema: z
    .strictObject({
      ...entryShape,
      /** Words added after the date, such as a place. */
      whenNote: text.optional(),
      /** The Work page's sentence on a smaller project: a template filled from this entry's own dates. */
      workNote: text.optional(),
    })
    .superRefine((data, ctx) => {
      report(entryIssues(data, { needsStart: false, needsTitle: false }), ctx);
      if (data.workNote) fills(data.workNote, data, ['workNote'], ctx);
    }),
});

const skills = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/skills' }),
  schema: z.strictObject({
    label: text,
    items: z.array(text).min(1),
    order: z.number().int(),
  }),
});

export const collections = { projects, timeline, experience, skills };
