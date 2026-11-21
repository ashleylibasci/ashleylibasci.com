// Selected work contact sheet: the image sizes of a square crop, the four prints as the
// content files give them, and the rules the two components keep in their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillTemplate } from '../src/lib/format.ts';
import { printImage } from '../src/lib/print-image.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const sheet = read('components', 'ContactSheet.astro');
const print = read('components', 'ContactPrint.astro');

/** One frontmatter value by key, at the given indent, without its quotes. */
const field = (/** @type {string} */ text, /** @type {string} */ key, indent = '') => {
  const match = text.match(new RegExp(`^${indent}${key}:[ \\t]*(.*)$`, 'm'));
  if (!match) return undefined;
  return match[1].trim().replace(/^'(.*)'$/, '$1');
};

/** The facts of every project entry that a print reads, sorted by `order`. */
const projects = readdirSync(join(src, 'content', 'projects'))
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const text = read('content', 'projects', file).split(/^---$/m)[1];
    const date = (/** @type {string} */ key) => {
      const value = field(text, key);
      return value ? new Date(value) : undefined;
    };
    return {
      id: file.replace(/\.md$/, ''),
      title: field(text, 'title'),
      printName: field(text, 'printName'),
      order: Number(field(text, 'order')),
      status: field(text, 'status'),
      start: date('start'),
      end: date('end'),
      stack: [...text.matchAll(/^  - (.+)$/gm)].map((match) => match[1]),
      meta: field(text, 'meta', '  '),
      label: field(text, 'label', '  '),
      note: field(text, 'note', '  '),
    };
  })
  .sort((a, b) => a.order - b.order);

const fill = (/** @type {string | undefined} */ template, /** @type {any} */ facts) =>
  fillTemplate(/** @type {string} */ (template), facts);

test('a 1200x630 original in a square: sizes is the square width times 1200/630', () => {
  const { sizes } = printImage(1200, 630);
  assert.equal(
    sizes,
    '(max-width: 760px) calc((50vw - 65px) * 1200 / 630), ' +
      '(max-width: 1060px) calc((25vw - 67px) * 1200 / 630), ' +
      '(max-width: 1271px) calc((25vw - 90px) * 1200 / 630), ' +
      '434px',
  );
});

test('a tall original is drawn at the square width', () => {
  const { sizes } = printImage(506, 1100);
  assert.equal(sizes, '(max-width: 760px) calc(50vw - 65px), (max-width: 1060px) calc(25vw - 67px), (max-width: 1271px) calc(25vw - 90px), 228px');
});

for (const [width, height] of [
  [1200, 630],
  [1440, 900],
  [506, 1100],
  [300, 300],
]) {
  test(`${width}x${height}: widths rise, repeat nothing and never pass the original`, () => {
    const { widths } = printImage(width, height);
    assert.ok(widths.length > 0);
    assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b));
    assert.ok(widths.every((w) => Number.isInteger(w) && w > 0 && w <= width), widths.join(' '));
  });
}

test('widths reach 3x of the widest square when the original allows, else stop at the original', () => {
  // 315px square, 1440x900: drawn 504px wide, 1512px at 3x, above the 1440px original.
  assert.equal(printImage(1440, 900).widths.at(-1), 1440);
  assert.equal(printImage(1200, 630).widths.at(-1), 1200);
  assert.equal(printImage(506, 1100).widths.at(-1), 506);
});

test('a size that is not an image size throws', () => {
  assert.throws(() => printImage(0, 630), /print-image/);
  assert.throws(() => printImage(1200, Number.NaN), /print-image/);
});

test('four prints in order, named by printName', () => {
  assert.deepEqual(
    projects.map((project) => project.order),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    projects.map((project) => project.printName),
    ['Health Dashboard', 'Career Star', 'Illinois Mathematics Lab', 'Security internship'],
  );
});

test('the meta lines fill from each entry', () => {
  assert.deepEqual(
    projects.map((project) => fill(project.meta, project)),
    ['Building now · Swift', 'Since May 2026 · live app', 'Research · since August 2026', 'Summer 2026'],
  );
});

test('the labels fill from each entry', () => {
  assert.deepEqual(
    projects.map((project) => fill(project.label, project)),
    [
      'Health Dashboard, building now, iPhone and Apple Watch',
      'Career Star, since May 2026, live app',
      'Illinois Mathematics Lab research, since August 2026',
      'Security internship at Baxter Credit Union, summer 2026',
    ],
  );
});

test('every entry has a picture mapped by id or a print.note', () => {
  for (const project of projects) {
    const mapped = new RegExp(`^  (?:'${project.id}'|${project.id}): \\{ image:`, 'm').test(sheet);
    assert.ok(mapped || project.note, `${project.id} has neither`);
  }
});

test('the components name no project', () => {
  for (const source of [sheet, print]) {
    for (const project of projects) {
      for (const words of [project.title, project.printName, project.note]) {
        if (words) assert.equal(source.includes(words), false, `a component holds "${words}"`);
      }
    }
  }
});

test('the sheet takes every word of a print from the collection', () => {
  assert.match(sheet, /getCollection\('projects'\)/);
  assert.match(sheet, /sort\(\(a, b\) => a\.data\.order - b\.data\.order\)/);
  assert.match(sheet, /number: index \+ 1/);
  assert.match(sheet, /name: data\.printName/);
  assert.match(sheet, /meta: fillTemplate\(data\.print\.meta, data\)/);
  assert.match(sheet, /label: fillTemplate\(data\.print\.label, data\)/);
  assert.match(sheet, /source: picture \? undefined : data\.title/);
});

test('a print links only when its page exists; "All work" waits for /work', () => {
  assert.match(sheet, /href: routeExists\(data\.href\) \? data\.href : null/);
  assert.match(sheet, /const WORK_HREF = '\/work';/);
  assert.match(sheet, /\{showAllWork && <a href=\{WORK_HREF\}>All work<\/a>\}/);
  assert.match(sheet, /const showAllWork = routeExists\(WORK_HREF\)/);
  // Without an href: no link and no aria-label, so the caption is read.
  assert.match(print, /const Wrap = href \? 'a' : 'div';/);
  assert.match(print, /href \? \{ href, 'aria-label': `Frame \$\{number\}: \$\{label\}` \} : \{\}/);
  assert.equal(print.match(/aria-label/g)?.length, 1);
});

test('an entry with neither a picture nor a note fails the build, naming the entry', () => {
  assert.match(sheet, /if \(!picture && !note\) \{\s*throw new Error\(`ContactSheet: the project entry "\$\{id\}"/);
});

test('the mockup words of the heading row', () => {
  assert.match(sheet, /<h2 id="h-sel">Selected work<\/h2>/);
  assert.match(sheet, /<p>What I'm building right now, and what I built before it\.<\/p>/);
  assert.match(sheet, /<section class="sel wrap" aria-labelledby="h-sel">/);
  // Not "sheet": the menu sheet's styles own that class.
  assert.match(sheet, /<div class="contact-sheet">/);
});

test('pictures are decorative, lazy and cropped to the square through FramedImage', () => {
  assert.match(print, /<FramedImage[^>]*alt=""/s);
  assert.equal(/\beager\b/.test(print), false);
  assert.match(print, /aspect-ratio: 1 \/ 1/);
  assert.equal(/<img\b/.test(print) || /<img\b/.test(sheet), false);
});

test('the typeset print keeps fixed colors and is hidden inside a link', () => {
  assert.match(print, /background: var\(--color-typeset-print\)/);
  assert.match(print, /color: var\(--color-typeset-ink\)/);
  assert.match(print, /color: var\(--color-typeset-source\)/);
  assert.match(print, /background: var\(--color-typeset-rule\)/);
  assert.match(print, /aria-hidden=\{href \? 'true' : undefined\}/);
  const tokens = read('styles', 'tokens.css');
  const [light, dark] = tokens.split('\n:root[data-theme="dark"] {');
  for (const name of ['print', 'ink', 'source', 'rule']) {
    assert.match(light, new RegExp(`--color-typeset-${name}: #`));
    assert.equal(dark.includes(`--color-typeset-${name}`), false);
  }
});

test('no hover lift and no border change on hover', () => {
  for (const source of [sheet, print]) {
    assert.equal(/transform/.test(source), false);
    assert.equal(/:hover[^{]*\{[^}]*border/.test(source), false);
  }
});

test('four across from 761px, two across at 760px and below', () => {
  assert.match(sheet, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  const phone = sheet.slice(sheet.indexOf('@media (max-width: 760px)'));
  assert.match(phone, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
