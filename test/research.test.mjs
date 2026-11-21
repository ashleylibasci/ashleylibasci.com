// Research page: the write-up as the content file gives it, the Lean example and its caption,
// the unlinked screenshot, the nav item, and the rules the page and its components keep in
// their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFigures, splitArticle } from '../src/lib/article.ts';
import { formatRange } from '../src/lib/format.ts';
import { NAV } from '../src/lib/nav.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const page = read('pages', 'research.astro');
const head = read('components', 'PageHead.astro');
const crop = read('components', 'CropFrame.astro');
const section = read('components', 'ArticleSection.astro');
const all = [page, head, crop, section];

const file = read('content', 'projects', 'research.md');
const [, frontmatter, ...rest] = file.split(/^---$/m);
const body = rest.join('---');

test('the write-up: a standfirst, four sections, one code block, one screenshot, one facts list', () => {
  const lead = body.split(/^## /m)[0].trim().split(/\n\n+/);
  assert.equal(lead.length, 1);
  assert.match(lead[0], /^I was selected for Future of Math Research, .* communicate the results with generative AI\.$/);
  assert.deepEqual(
    [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    ['The question', 'My role', 'The Proof of History', 'Project'],
  );
  assert.deepEqual(
    [...body.matchAll(/^\[\[figure:([a-z-]+)\]\]/gm)].map((match) => match[1]),
    ['opening'],
  );
  assert.equal(body.match(/<div class="code">/g)?.length, 1);
  assert.equal(body.match(/<dl class="facts">/g)?.length, 1);
  assert.deepEqual(
    [...body.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]),
    ['Program', 'Course', 'Term', 'Team', 'Tools'],
  );
  assert.match(body, /faculty mentor Jacob Beckey\. It runs as MATH 492, about ten hours a week\./);
});

test('the Term line is the entry start in words', () => {
  const start = frontmatter.match(/^start: (\d{4}-\d{2}-\d{2})$/m)?.[1];
  assert.ok(start);
  assert.equal(body.match(/<dt>Term<\/dt><dd>([^<]+)<\/dd>/)?.[1], formatRange(new Date(start)));
});

test('the Code block: the file name, the Lean example, and a caption that says it is illustrative', () => {
  const block = body.match(/<div class="code">\n<div class="fn">SumOdd\.lean<\/div>\n\n<pre tabindex="0" role="region" aria-label="SumOdd\.lean">([\s\S]*?)<\/pre>\n<\/div>\n<p class="cap">([^<]+)<\/p>/);
  assert.ok(block);
  assert.equal(block[2], 'An illustrative example in Lean 4 with Mathlib, not one of our results.');
  assert.deepEqual(block[1].replace(/<[^>]+>/g, '').split('\n'), [
    'open Finset',
    '',
    '-- 1 + 3 + 5 + ... + (2n - 1) = n²',
    'theorem sum_odd (n : ℕ) :',
    '    ∑ i ∈ range n, (2 * i + 1) = n ^ 2 := by',
    '  induction n with',
    '  | zero => simp',
    '  | succ k ih => rw [sum_range_succ, ih]; ring',
  ]);
  assert.deepEqual(
    [...block[1].matchAll(/<span class="k">([^<]+)<\/span>/g)].map((match) => match[1]),
    ['open', 'theorem', 'by', 'induction', 'with'],
  );
  assert.equal(block[1].match(/<span class="c">/g)?.length, 1);
});

test('the Code block scrolls inside itself and takes its colors from the tokens', () => {
  assert.match(section, /\.art \.code \{[^}]*max-width: 42em;[^}]*background: var\(--color-code\);[^}]*border-radius: var\(--radius-md\);/);
  assert.match(section, /\.art \.code pre \{[^}]*overflow-x: auto;[^}]*font: var\(--type-code\);/);
  assert.match(section, /\.art \.code \.c \{\s*color: var\(--color-ink-3\);/);
  assert.match(section, /\.art \.code \.k \{\s*color: var\(--color-link\);/);
  assert.match(section, /\.art \.col > \.cap \{[^}]*font: var\(--type-meta\);[^}]*color: var\(--color-ink-3\);/);
});

test('the page splits the write-up as the article rules say', () => {
  // The write-up's own structure, through the same functions the page calls.
  const sample = '<p>Lead.</p><h2>A</h2><p>Text.</p><p>[[figure:opening]] Cap.</p>';
  const article = splitArticle(sample);
  assert.deepEqual(article.leadParts, [{ kind: 'html', html: '<p>Lead.</p>' }]);
  assert.deepEqual(article.sections[0].parts[1], { kind: 'figure', name: 'opening', caption: 'Cap.' });
  assert.doesNotThrow(() => checkFigures(article, ['opening'], 'research'));
  // An unknown figure and an unused one both fail.
  assert.throws(() => checkFigures(article, [], 'research'), /unknown figure "opening"/);
  assert.throws(() => checkFigures(splitArticle('<p>Lead.</p>'), ['opening'], 'research'), /never uses the figure "opening"/);
  assert.match(page, /checkFigures\(article, Object\.keys\(CROPS\), ID\);/);
  // A lead that is not one paragraph fails the build.
  assert.match(page, /const \[first, \.\.\.more\] = article\.leadParts;/);
  assert.match(page, /if \(!standfirst \|\| more\.length > 0\) \{\s*throw new Error\(/);
});

test('the page takes the title and the write-up from the entry', () => {
  assert.match(page, /getEntry\('projects', ID\)/);
  assert.match(page, /<PageHead title=\{entry\.data\.title\} current=\{page\.label\} crumbs=\{\[\{ label: home\.label, href: home\.href \}\]\}>/);
  assert.match(page, /<Fragment slot="standfirst" set:html=\{standfirst\} \/>/);
  assert.match(page, /<ArticleSection id=\{section\.id\} heading=\{section\.heading\}>/);
  assert.match(frontmatter, /^title: Future of Math Research$/m);
  // No sentence of the write-up is repeated in the page or a component.
  for (const sentence of ['I was selected', 'proof assistant', 'Jacob Beckey', 'illustrative', 'Work in progress', 'sum_odd']) {
    for (const text of all) assert.equal(text.includes(sentence), false, sentence);
  }
});

test('Research is a tab between Work and Experience, and the page marks it current', () => {
  assert.deepEqual(
    NAV.slice(1, 4).map((item) => item.key),
    ['work', 'research', 'experience'],
  );
  assert.deepEqual(NAV[2], { key: 'research', label: 'Research', href: '/research', tab: true });
  assert.match(page, /const page = navItem\('research'\);/);
  assert.match(page, /<Base title=\{page\.label\} section=\{page\.key\}>/);
  assert.match(head, /const \{ title, standfirst, crumbs = \[\], current = title \} = Astro\.props;/);
  assert.match(head, /\}<span>\{current\}<\/span>/);
  assert.match(head, /<h1 id="page-heading" tabindex="-1">\{title\}<\/h1>/);
});

test('the Crop frame: FramedImage, lazy, the alt text, never a link', () => {
  for (const text of all) assert.equal(/<img\b/.test(text), false);
  assert.match(crop, /<FramedImage src=\{src\} alt=\{alt\} widths=\{widths\} sizes=\{SIZES\} class="shot" \/>/);
  assert.equal(/\beager\b/.test(crop), false);
  assert.equal(/<a\b|href/.test(crop), false);
  assert.match(page, /alt: 'The Proof of History home page: a dark green page with the headline How Mathematicians Shared and Tested Their Work\.'/);
  assert.match(crop, /\.crop \{\s*margin-top: var\(--space-5\);\s*max-width: 620px;/);
  assert.match(crop, /\.frame \{[^}]*aspect-ratio: 16 \/ 9\.2;\s*overflow: hidden;\s*background: var\(--color-field\);\s*border-radius: var\(--radius-lg\);/);
  assert.match(crop, /\.plate \{\s*position: absolute;\s*inset: 28px 28px -1px;/);
  assert.match(crop, /@media \(max-width: 760px\) \{\s*\.plate \{\s*inset: 16px 16px -1px;/);
});

test('no outbound link: no address in the page, its components or the write-up', () => {
  for (const text of [body, ...all]) assert.equal(/https?:\/\/|www\./.test(text), false);
  assert.equal(/<a\b|\]\(/.test(body), false);
  assert.equal(/<a\b/.test(page), false);
});

test('none of the cut lines and no phone number', () => {
  // Matched by fragments, so no cut line is written out here.
  for (const text of [body, ...all]) {
    assert.equal(/is encouraged|gets written at|my own bedtime/i.test(text), false);
    assert.equal(/\d{3}[\s.-]\d{3}[\s.-]\d{4}/.test(text), false);
  }
});

test('no client script, no hover motion and no color value outside the tokens', () => {
  for (const text of [body, ...all]) {
    assert.equal(/<script/.test(text), false);
    assert.equal(/transform|transition|animation/.test(text), false);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text), false);
  }
});
