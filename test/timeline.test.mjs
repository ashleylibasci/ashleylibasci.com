// Home timeline and closing line: the date words, the grouping by year, the nine
// entries as the content files give them, and the rules the two components keep in
// their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupByYear, timelineWhen } from '../src/lib/timeline.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const timeline = read('components', 'Timeline.astro');
const closing = read('components', 'ClosingLine.astro');
const home = read('pages', 'index.astro');

const day = (/** @type {string} */ month) => new Date(`${month}-01`);

/** One top-level value by key, without its quotes. */
const field = (/** @type {string} */ text, /** @type {string} */ key) => {
  const match = text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!match) return undefined;
  return match[1].trim().replace(/^'(.*)'$/, '$1');
};

const date = (/** @type {string} */ text, /** @type {string} */ key) => {
  const value = field(text, key);
  return value ? new Date(value) : undefined;
};

/** The facts of every project entry that the timeline reads. */
const projects = Object.fromEntries(
  readdirSync(join(src, 'content', 'projects'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const text = read('content', 'projects', file).split(/^---$/m)[1];
      return [
        file.replace(/\.md$/, ''),
        {
          title: field(text, 'title'),
          timelineName: field(text, 'timelineName'),
          href: field(text, 'href'),
          start: date(text, 'start'),
          end: date(text, 'end'),
        },
      ];
    }),
);

/** Every timeline entry, with a named project's title and dates resolved as the component does. */
const files = readdirSync(join(src, 'content', 'timeline'));
const entries = files
  .filter((file) => file.endsWith('.yaml'))
  .map((file) => {
    const text = read('content', 'timeline', file);
    const projectId = field(text, 'project');
    const project = projectId ? projects[projectId] : undefined;
    if (projectId) assert.ok(project, `${file} names the unknown project "${projectId}"`);
    return {
      id: file.replace(/\.yaml$/, ''),
      title: field(text, 'title') ?? project?.timelineName,
      org: field(text, 'org'),
      description: field(text, 'description'),
      linkLabel: field(text, 'linkLabel'),
      whenNote: field(text, 'whenNote'),
      projectId,
      ownDates: Boolean(field(text, 'start') || field(text, 'end')),
      start: project ? project.start : date(text, 'start'),
      end: project ? project.end : date(text, 'end'),
    };
  });

test('date words: a note follows the range, one month stands alone, an open end is "to now", no dates is "Now"', () => {
  assert.equal(timelineWhen(day('2024-06'), day('2024-07'), 'remote'), 'June to July, remote');
  assert.equal(timelineWhen(day('2025-08'), day('2025-08')), 'August');
  assert.equal(timelineWhen(day('2026-11')), 'November to now');
  assert.equal(timelineWhen(), 'Now');
  assert.equal(timelineWhen(day('2026-06'), day('2026-08')), 'June to August');
});

test('two entries with the same start: the one that ends first comes first', () => {
  const long = { id: 'long', start: day('2025-08'), end: day('2025-12') };
  const short = { id: 'short', start: day('2025-08'), end: day('2025-08') };
  const open = { id: 'open', start: day('2025-08') };
  const [group] = groupByYear([open, long, short], 2026);
  assert.deepEqual(
    group.entries.map((entry) => entry.id),
    ['short', 'long', 'open'],
  );
  assert.equal(group.year, 2025);
  assert.equal(group.current, false);
});

test('years ascend, and "Now" sits last in the build year', () => {
  const groups = groupByYear(
    [{ id: 'now' }, { id: 'nov', start: day('2026-11') }, { id: 'old', start: day('2023-06'), end: day('2023-07') }],
    '2026',
  );
  assert.deepEqual(
    groups.map((group) => [group.year, group.current, group.entries.map((entry) => entry.id)]),
    [
      [2023, false, ['old']],
      [2026, true, ['nov', 'now']],
    ],
  );
});

test('a build year that is not a year throws', () => {
  assert.throws(() => groupByYear([], 'soon'), /timeline/);
});

test('the nine entries, built in 2026: four years, 2026 current and in the mockup order', () => {
  assert.equal(entries.length, 9);
  const groups = groupByYear(entries, '2026');
  assert.deepEqual(
    groups.map((group) => [group.year, group.entries.length, group.current]),
    [
      [2023, 1, false],
      [2024, 1, false],
      [2025, 2, false],
      [2026, 5, true],
    ],
  );
  assert.deepEqual(
    groups[2].entries.map((entry) => entry.title),
    ['Started at the University of Illinois', 'AI stock recommendation engine'],
  );
  assert.deepEqual(
    groups[3].entries.map((entry) => entry.title),
    ['Built Career Star', 'Cybersecurity intern', 'Undergraduate researcher', 'VP of Scholarship', 'Health Dashboard'],
  );
});

test('the date words of the nine entries', () => {
  const words = groupByYear(entries, '2026').flatMap((group) =>
    group.entries.map((entry) => timelineWhen(entry.start, entry.end, entry.whenNote)),
  );
  assert.deepEqual(words, [
    'June to July',
    'June to July, remote',
    'August',
    'August to December',
    'May to now',
    'June to August',
    'August to now',
    'November to now',
    'Now',
  ]);
});

test('built in 2027: "Now" entries sit under 2027, which is current; 2026 is plain', () => {
  const groups = groupByYear(entries, '2027');
  assert.deepEqual(
    groups.map((group) => [group.year, group.entries.length, group.current]),
    [
      [2023, 1, false],
      [2024, 1, false],
      [2025, 2, false],
      [2026, 4, false],
      [2027, 1, true],
    ],
  );
  assert.deepEqual(
    groups[4].entries.map((entry) => entry.title),
    ['Health Dashboard'],
  );
});

test('project entries: Names-table titles from the project, no dates of their own', () => {
  const named = Object.fromEntries(entries.filter((entry) => entry.projectId).map((entry) => [entry.projectId, entry]));
  assert.deepEqual(Object.keys(named).sort(), ['baxter-credit-union', 'career-star', 'health-dashboard', 'research']);
  assert.equal(named['career-star'].title, 'Built Career Star');
  assert.equal(named.research.title, 'Undergraduate researcher');
  assert.equal(named['baxter-credit-union'].title, 'Cybersecurity intern');
  assert.equal(named['health-dashboard'].title, 'Health Dashboard');
  for (const entry of Object.values(named)) assert.equal(entry.ownDates, false, `${entry.id} has its own dates`);
  assert.equal(named['career-star'].org, 'Personal project, {status}');
  assert.equal(named['career-star'].linkLabel, 'The case study');
  assert.equal(named.research.linkLabel, 'About the research');
  assert.equal(named['health-dashboard'].linkLabel, "How I'm building it");
  assert.equal(named['baxter-credit-union'].org, 'Baxter Credit Union, Vernon Hills');
  assert.equal(named['baxter-credit-union'].linkLabel, undefined);
});

test('a link label is given only beside a project; the placeholder file is gone', () => {
  for (const entry of entries) {
    if (entry.linkLabel) assert.ok(entry.projectId, `${entry.id} has a link label and no project`);
    assert.ok(entry.title && entry.org && entry.description, `${entry.id} lacks a word`);
  }
  assert.equal(files.includes('.gitkeep'), false);
});

test('the components name no project and no entry', () => {
  for (const source of [timeline, closing]) {
    for (const entry of entries) {
      for (const words of [entry.title, entry.org, entry.description, entry.linkLabel]) {
        if (words) assert.equal(source.includes(words), false, `a component holds "${words}"`);
      }
    }
    for (const project of Object.values(projects)) {
      for (const words of [project.title, project.timelineName]) {
        if (words) assert.equal(source.includes(words), false, `a component holds "${words}"`);
      }
    }
  }
});

test('the timeline takes every word from the collections', () => {
  assert.match(timeline, /getCollection\('timeline'\)/);
  assert.match(timeline, /const title = data\.title \?\? project\?\.data\.timelineName;/);
  assert.match(timeline, /org: project \? fillTemplate\(data\.org, project\.data\) : data\.org/);
  assert.match(timeline, /const facts = entryFacts\(data, project\?\.data\);/);
  assert.match(timeline, /when: timelineWhen\(facts\.start, facts\.end, data\.whenNote\)/);
  assert.match(timeline, /groupByYear\(entries, COPYRIGHT_YEAR\)/);
  assert.equal(/\b20\d\d\b/.test(timeline), false, 'a year is written in the component');
});

test('an unknown project fails the build, naming the entry', () => {
  assert.match(
    timeline,
    /if \(data\.project && !project\) throw new Error\(`timeline\/\$\{id\}: no project "\$\{data\.project\.id\}"`\)/,
  );
});

test('an inline link needs a target and a label', () => {
  assert.match(timeline, /facts\.href && data\.linkLabel\s*\? \{ href: facts\.href, label: data\.linkLabel \}\s*: undefined/);
  assert.match(timeline, /\{entry\.link && <Fragment> <a href=\{entry\.link\.href\}>\{entry\.link\.label\}<\/a><\/Fragment>\}/);
  assert.equal(timeline.match(/<a\b/g)?.length, 1);
});

test('the timeline markup: a labelled section, "Timeline" with no subtitle, h3 titles, "This year"', () => {
  assert.match(timeline, /<section class="tl wrap" aria-labelledby="h-tl">/);
  assert.match(timeline, /<div class="tl-head">\s*<h2 id="h-tl">Timeline<\/h2>\s*<\/div>/);
  assert.match(timeline, /<h3>\{entry\.title\}<\/h3>/);
  assert.equal(/<h4\b/.test(timeline), false);
  assert.match(timeline, /\{current && <small>This year<\/small>\}/);
  assert.match(timeline, /class:list=\{\['yb', \{ cur: current \}\]\}/);
});

test('two across from 1061px, one column at 1060px, each year above its entries at 760px', () => {
  const [desktop, rest] = timeline.split('@media (max-width: 1060px)');
  const [tablet, phone] = rest.split('@media (max-width: 760px)');
  assert.match(desktop, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(desktop, /--rx: var\(--space-timeline-rail\);/);
  assert.match(tablet, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(tablet, /--rx: var\(--space-timeline-rail-tablet\);/);
  assert.match(phone, /--rx: var\(--space-timeline-rail-mobile\);/);
  assert.match(phone, /\.ym \{\s*position: static;/);
});

test('no drawing and no hover motion', () => {
  for (const source of [timeline, closing]) {
    assert.equal(/transform|animation|transition|:hover|<svg|<img/.test(source), false);
  }
});

test('the closing line: the mockup words, addresses from CONTACTS, the resume link', () => {
  assert.match(closing, /<section class="end" aria-label="Contact">/);
  assert.match(
    closing,
    /<p class="msg">Hiring interns for summer 2027\? Email is the fastest way to reach me: <a href=\{`mailto:\$\{CONTACTS\.email\}`\}>\{CONTACTS\.email\}<\/a><\/p>/,
  );
  assert.match(
    closing,
    /<p class="alt">Or read my <a href=\{RESUME_HREF\}>resume<\/a>, look through my <a href=\{CONTACTS\.github\}>GitHub<\/a>, or find me on <a href=\{CONTACTS\.linkedin\}>LinkedIn<\/a>\.<\/p>/,
  );
  assert.match(closing, /const RESUME_HREF = '\/about#resume';/);
  assert.match(closing, /border-top: 1px solid var\(--color-line\)/);
  assert.equal(/@|https?:/.test(closing.replace(/@media/g, '')), false, 'an address is written in the component');
});

test('the home page ends Timeline, then the closing line', () => {
  assert.match(home, /<ContactSheet \/>\s*<Timeline \/>\s*<ClosingLine \/>\s*<\/Base>/);
});

test('no color value outside the tokens', () => {
  for (const source of [timeline, closing]) assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(source), false);
});
