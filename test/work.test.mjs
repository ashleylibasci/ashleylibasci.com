// Work page: the image sizes on a visual, the four entries as the content files give them,
// the smaller-project note, and the rules the page and its two components keep in their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillTemplate, templateParts } from '../src/lib/format.ts';
import { NAV } from '../src/lib/nav.ts';
import { PLATE_SHARE, plateImage } from '../src/lib/work-image.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const page = read('pages', 'work.astro');
const entry = read('components', 'WorkEntry.astro');
const visual = read('components', 'WorkVisual.astro');

/** One YAML value by key, at the given indent, without its quotes. */
const field = (/** @type {string} */ text, /** @type {string} */ key, indent = '') => {
  const match = text.match(new RegExp(`^${indent}${key}:[ \\t]*(.*)$`, 'm'));
  if (!match) return undefined;
  return match[1].trim().replace(/^'(.*)'$/, '$1');
};

const date = (/** @type {string} */ text, /** @type {string} */ key) => {
  const value = field(text, key);
  return value ? new Date(value) : undefined;
};

/** The facts of every project entry that a Work entry reads, sorted by `order`. */
const projects = readdirSync(join(src, 'content', 'projects'))
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const text = read('content', 'projects', file).split(/^---$/m)[1];
    return {
      id: file.replace(/\.md$/, ''),
      title: field(text, 'title'),
      order: Number(field(text, 'order')),
      status: field(text, 'status'),
      start: date(text, 'start'),
      end: date(text, 'end'),
      stack: [...text.matchAll(/^  - (.+)$/gm)].map((match) => match[1]),
      tag: field(text, 'tag', '  '),
      linkLabel: field(text, 'linkLabel', '  '),
      visualLabel: field(text, 'visualLabel', '  '),
      plateSource: field(text, 'source', '    '),
      plateText: field(text, 'text', '    '),
      summary: field(text, 'summary'),
    };
  })
  .sort((a, b) => a.order - b.order);

const fill = (/** @type {string | undefined} */ template, /** @type {any} */ facts) =>
  fillTemplate(/** @type {string} */ (template), facts);

test('four entries in order, with the tags the content files give', () => {
  assert.deepEqual(
    projects.map((project) => project.title),
    ['Health Dashboard', 'Career Star', 'Future of Math Research', 'Baxter Credit Union'],
  );
  assert.deepEqual(
    projects.map((project) => fill(project.tag, project)),
    [
      'Building now · Swift · iPhone and Apple Watch',
      'May 2026 to now · live · Next.js, TypeScript, AWS Amplify',
      'August 2026 to now · Illinois Mathematics Lab · MATH 492',
      'June to August 2026 · Cybersecurity intern · Vernon Hills',
    ],
  );
});

test('only the entry being built has a status part to color', () => {
  const building = projects.filter((project) => project.status === 'building');
  assert.deepEqual(
    building.map((project) => project.id),
    ['health-dashboard'],
  );
  const parts = templateParts(/** @type {string} */ (building[0].tag), /** @type {any} */ (building[0]));
  assert.deepEqual(parts[0], { text: 'Building now', token: 'status' });
  assert.match(entry, /part\.token === 'status' && status === 'building'/);
  assert.match(entry, /current\(part\) \? <span class="cur">\{part\.text\}<\/span> : part\.text/);
  assert.match(entry, /\.cur \{\s*color: var\(--color-teal-text\);/);
});

test('the Baxter visual is named and typeset from the entry', () => {
  const baxter = projects[3];
  assert.equal(baxter.linkLabel, 'See my experience');
  assert.equal(baxter.visualLabel, 'My experience at Baxter Credit Union');
  assert.equal(fill(baxter.plateSource, baxter), 'Baxter Credit Union · Cybersecurity intern, summer 2026');
  assert.equal(
    baxter.plateText,
    'Audited 300+ vendors and partners against third-party security standards during a merger.',
  );
});

test('the smaller-project note fills from its timeline entry', () => {
  const notes = readdirSync(join(src, 'content', 'timeline')).flatMap((file) => {
    const text = read('content', 'timeline', file);
    const workNote = field(text, 'workNote');
    return workNote ? [fillTemplate(workNote, { start: date(text, 'start'), end: date(text, 'end') })] : [];
  });
  assert.deepEqual(notes, [
    'an AI stock recommendation engine for Intro to CS I Honors (fall 2025), a Next.js app that recommends stocks from a risk profile, back-tested.',
  ]);
  assert.match(read('content', 'timeline', 'stock-recommendation-engine.yaml'), /\(\{term\}\)/);
  assert.match(page, /data\.workNote \? \[fillTemplate\(data\.workNote, data\)\] : \[\]/);
  assert.match(page, /<p class="small-p"><b>A smaller project:<\/b> \{note\}<\/p>/);
  assert.match(page, /\.small-p \{[^}]*border-top: 1px solid var\(--color-line\)/);
});

test('the schema validates a workNote with the entry own dates', () => {
  const config = read('content.config.ts');
  assert.match(config, /workNote: text\.optional\(\)/);
  assert.match(config, /if \(data\.workNote\) fills\(data\.workNote, data, \['workNote'\], ctx\)/);
});

test('plateImage: sizes follow the visual width at each layout', () => {
  assert.equal(
    plateImage(1200).sizes,
    '(max-width: 760px) calc(100vw - 40px), (max-width: 1060px) calc(50vw - 44px), (max-width: 1271px) calc(50vw - 76px), 560px',
  );
  assert.equal(
    plateImage(506, 0.254).sizes,
    '(max-width: 760px) calc((100vw - 40px) * 0.254), (max-width: 1060px) calc((50vw - 44px) * 0.254), ' +
      '(max-width: 1271px) calc((50vw - 76px) * 0.254), 142px',
  );
});

for (const [width, scale] of [
  [1200, PLATE_SHARE],
  [1440, 1.038],
  [506, 0.254],
  [512, 0.136],
  [200, 1],
]) {
  test(`plateImage ${width} at ${scale}: widths rise, repeat nothing and never pass the original`, () => {
    const { widths } = plateImage(width, scale);
    assert.ok(widths.length > 0);
    assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b));
    assert.ok(widths.every((w) => Number.isInteger(w) && w > 0 && w <= width), widths.join(' '));
  });
}

test('plateImage: widths reach 3x of the widest visual when the original allows', () => {
  assert.equal(plateImage(1200, PLATE_SHARE).widths.at(-1), 1200);
  assert.equal(plateImage(4000).widths.at(-1), 2160);
  assert.equal(plateImage(506, 0.254).widths.at(-1), 506);
  assert.equal(plateImage(200).widths.join(), '200');
});

test('plateImage: a bad width or scale throws', () => {
  assert.throws(() => plateImage(0), /work-image/);
  assert.throws(() => plateImage(Number.NaN), /work-image/);
  assert.throws(() => plateImage(1200, 0), /work-image/);
});

test('every entry has a picture mapped by id or a work.plate; neither fails the build, naming the entry', () => {
  for (const project of projects) {
    const mapped = new RegExp(`^  (?:'${project.id}'|${project.id}): \\{$`, 'm').test(page);
    assert.ok(mapped || (project.plateSource && project.plateText), `${project.id} has neither`);
  }
  assert.match(page, /if \(!picture\) \{\s*throw new Error\(`work: the project entry "\$\{id\}" has neither/);
});

test('the page takes every word of an entry from the collection, in order', () => {
  assert.match(page, /getCollection\('projects'\)\)\.sort\(\(a, b\) => a\.data\.order - b\.data\.order\)/);
  assert.match(page, /title: data\.title/);
  assert.match(page, /tag: templateParts\(data\.work\.tag, data\)/);
  assert.match(page, /summary: data\.summary/);
  assert.match(page, /label: data\.work\.linkLabel/);
  assert.match(page, /label: data\.work\.visualLabel/);
  assert.match(page, /source: fillTemplate\(plate\.source, data\), text: plate\.text/);
  for (const source of [entry, visual]) {
    for (const project of projects) {
      assert.equal(source.includes(/** @type {string} */ (project.title)), false, `a component names ${project.title}`);
    }
  }
  for (const project of projects) {
    assert.equal(page.includes(/** @type {string} */ (project.summary)), false);
  }
});

test('title, link label and visual link only when the page exists; the live app link always shows', () => {
  assert.match(page, /const href = routeExists\(data\.href\) \? data\.href : null;/);
  assert.match(page, /\.\.\.\(href \? \[\{ href, label: data\.work\.linkLabel \}\] : \[\]\)/);
  assert.match(page, /\.\.\.\(data\.liveUrl \? \[\{ href: data\.liveUrl, label: LIVE_LABEL \}\] : \[\]\)/);
  assert.match(page, /const LIVE_LABEL = 'Open the live app';/);
  assert.match(entry, /<h2>\{href \? <a href=\{href\}>\{title\}<\/a> : title\}<\/h2>/);
  assert.match(entry, /\{links\.length > 0 && <p class="meta">/);
  assert.match(visual, /const Wrap = href \? 'a' : 'div';/);
  assert.match(visual, /href \? \{ href, 'aria-label': label \} : \{\}/);
  assert.equal(visual.match(/aria-label/g)?.length, 1);
});

test('a typeset plate inside a link is hidden; the heartbeat always is', () => {
  // Hidden only when the link has its own name; otherwise the words name it.
  assert.match(visual, /<span class="plate" aria-hidden=\{href && label \? 'true' : undefined\}>/);
  assert.match(visual, /<svg class="beat" viewBox="0 0 480 84" aria-hidden="true"/);
  assert.match(visual, /d="M2 52 H186 L208 64 L238 10 L268 76 L290 52 H478"/);
  assert.match(visual, /stroke: var\(--color-trace\);\s*stroke-width: 1\.6;/);
});

test('images go through FramedImage, lazy, with alt text', () => {
  for (const source of [page, entry, visual]) assert.equal(/<img\b/.test(source), false);
  assert.equal(/\beager\b/.test(visual) || /\beager\b/.test(page), false);
  assert.equal(visual.match(/<FramedImage/g)?.length, 3);
  assert.equal(visual.match(/alt=\{/g)?.length, 3);
  assert.equal(page.match(/alt: '[^']+'/g)?.length, 5);
});

test('no hover lift, no border change on hover and no client script', () => {
  for (const source of [page, entry, visual]) {
    assert.equal(/transform|transition/.test(source), false);
    assert.equal(/:hover[^{]*\{[^}]*border/.test(source), false);
    assert.equal(/<script/.test(source), false);
  }
  assert.match(entry, /h2 a:hover \{[^}]*text-decoration-color: var\(--color-aqua\)/);
});

test('the visual is a size container and its frame grows with typeset words', () => {
  assert.match(visual, /container-type: inline-size/);
  assert.match(visual, /\.wv::before \{[^}]*padding-top: 52\.5%/);
  assert.match(visual, /background: var\(--color-field\);\s*border: 1px solid var\(--color-line\);\s*border-radius: var\(--radius-lg\)/);
  assert.match(visual, /\.k-plate \.plate \{[^}]*background: var\(--color-photo-placeholder\)/);
});

test('text in columns 1 to 5, the visual in 7 to 12; base.css stacks them at 760px and below', () => {
  assert.match(entry, /<article class="g12">/);
  assert.match(entry, /\.wt \{\s*grid-column: 1 \/ 6;/);
  assert.match(entry, /\.visual \{\s*grid-column: 7 \/ 13;/);
  assert.match(read('styles', 'base.css'), /@media \(max-width: 760px\) \{\s*\.g12 \{[^}]*\}\s*\.g12 > \* \{\s*grid-column: 1 \/ -1 !important;/);
});

test('the page head and the Work tab', () => {
  assert.match(page, /standfirst="What I'm building right now, and what I built before it\."/);
  assert.match(page, /crumbs=\{\[\{ label: home\.label, href: home\.href \}\]\}/);
  assert.match(page, /<Base title=\{page\.label\} section=\{page\.key\}>/);
  const tabs = NAV.filter((item) => item.tab);
  assert.deepEqual(tabs[0], { key: 'work', label: 'Work', href: '/work', tab: true });
  assert.deepEqual(
    NAV.map((item) => item.key),
    ['home', 'work', 'research', 'experience'],
  );
});
