// Career Star case study: the write-up as the content file gives it, the back-test numbers,
// the Career Star addresses, and the rules the page and its components keep in their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV } from '../src/lib/nav.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const page = read('pages', 'career-star.astro');
const head = read('components', 'PageHead.astro');
const slab = read('components', 'ScreenshotSlab.astro');
const section = read('components', 'ArticleSection.astro');
const figure = read('components', 'Figure.astro');
const chart = read('components', 'figures', 'FlaggedChart.astro');
const all = [page, head, slab, section, figure, chart];

const file = read('content', 'projects', 'career-star.md');
const [, frontmatter, ...rest] = file.split(/^---$/m);
const body = rest.join('---');

test('the write-up: a standfirst, the screenshot, eight sections, one formula, one list, one chart', () => {
  const lead = body.split(/^## /m)[0].trim().split(/\n\n+/);
  assert.equal(lead.length, 2);
  assert.match(lead[0], /^Every U\.S\. occupation gets one 0–100 risk-adjusted score, .* presented it to Capital One in August\.$/);
  assert.match(lead[1], /^\[\[figure:rating\]\] The rating page for one career\. /);
  assert.deepEqual(
    [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    [
      'The problem',
      'My role',
      'How a career is scored',
      'Decisions and trade-offs',
      'Did it work?',
      'What it got wrong',
      "The bug I'm proudest of finding",
      'Stack',
    ],
  );
  assert.deepEqual(
    [...body.matchAll(/^\[\[figure:([a-z-]+)\]\]/gm)].map((match) => match[1]),
    ['rating', 'flagged'],
  );
  assert.deepEqual(
    [...body.matchAll(/^- \*\*(.+?)\*\* /gm)].map((match) => match[1]),
    [
      'The model does the math, the language model only explains.',
      'Free text never reaches the language model.',
      'Publish the misses.',
    ],
  );
  assert.equal(body.match(/<dl class="facts">/g)?.length, 1);
  assert.deepEqual(
    [...body.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]),
    ['App', 'Language', 'Hosting', 'Testing', 'Process', 'Language model', 'Data'],
  );
});

test('the Formula block is a group labeled "Scoring formula" with four formulas', () => {
  const block = body.match(/<div class="math" role="group" aria-label="Scoring formula">\n([\s\S]*?)\n<\/div>/)?.[1];
  assert.ok(block);
  assert.deepEqual(
    block.split('\n').map((line) => line.replace(/<span class="n">.*<\/span>/, '').replace(/<[^>]+>/g, '').trim()),
    [
      'Return = 0.5 · growth + 0.5 · pay',
      'Risk = 0.7 · AI exposure + 0.3 · volatility',
      'RAV = Return · (1 − 0.6 · Risk)',
      'Score = 100 · (0.7 · RAV + 0.3 · Fit)',
    ],
  );
  assert.match(block, /<span class="n">risk-adjusted value<\/span>/);
  assert.match(section, /\.art \.math \{[^}]*background: var\(--color-surface\);[^}]*font: var\(--type-formula\);[^}]*max-width: 32em;/);
});

test('the back-test: 0.39 across 647 occupations, and one Highlight on the lift', () => {
  assert.match(body, /Across 647 occupations the rank correlation was <span class="num">ρ = 0\.39<\/span>/);
  assert.deepEqual(
    [...body.matchAll(/<mark[^>]*>([^<]+)<\/mark>/g)].map((match) => match[1]),
    ['1.45× as often'],
  );
  assert.match(body, /3<sup>6<\/sup> = 729 weightings/);
  assert.match(body, /\(ρ = 0\.41\)/);
  assert.match(section, /\.art mark \{\s*white-space: nowrap;\s*background: var\(--color-mark\);\s*color: var\(--color-mark-ink\);/);
});

test('Figure 1: the caption in the write-up, the chart with its label and both shares', () => {
  assert.match(body, /^\[\[figure:flagged\]\] \*\*Figure 1\.\*\* Of the occupations that really declined between 2014 and 2024, /m);
  assert.match(
    chart,
    /role="img"\s+aria-label="Of the occupations that actually declined from 2014 to 2024, a random pick would flag 33 percent; Career Star flagged 48 percent, 1\.45 times as many\."/,
  );
  assert.match(chart, /<text class="num" x="252" y="20">33%<\/text>/);
  assert.match(chart, /<text class="vb num" x="320" y="44">48%, 1\.45× as often<\/text>/);
  assert.match(chart, /<line class="base" /);
  assert.match(figure, /\.fig \.bar-b \{\s*fill: var\(--color-link\);/);
  assert.match(figure, /\.fig text\.vb \{\s*fill: var\(--color-link\);/);
  assert.match(page, /flagged: \{ chart: FlaggedChart, maxWidth: 560 \},/);
});

test('every Career Star address is the subdomain, built from the entry', () => {
  assert.match(frontmatter, /^liveUrl: https:\/\/careerstar\.ashleylibasci\.com$/m);
  assert.match(page, /const liveUrl = entry\.data\.liveUrl;/);
  assert.match(page, /\{ href: liveUrl, label: LIVE_LABEL \},/);
  assert.match(page, /\{ href: new URL\(WRITE_UP_PATH, liveUrl\)\.href, label: WRITE_UP_LABEL \},/);
  assert.match(page, /\{ href: CONTACTS\.github, label: CODE_LABEL \},/);
  assert.match(page, /const LIVE_LABEL = 'Open the live app';/);
  assert.match(page, /const WRITE_UP_LABEL = 'Full write-up on the site';/);
  assert.match(page, /const CODE_LABEL = 'Code on GitHub';/);
  // No address is written out in the page, a component or the write-up.
  for (const text of [body, ...all]) assert.equal(/https?:\/\//.test(text), false);
});

test('none of the cut lines and no phone number', () => {
  // Matched by fragments, so no cut line is written out here.
  for (const text of [body, ...all]) {
    assert.equal(/is encouraged|gets written at|my own bedtime/i.test(text), false);
    assert.equal(/\d{3}[\s.-]\d{3}[\s.-]\d{4}/.test(text), false);
  }
});

test('the page takes the title and the write-up from the entry and places it by position', () => {
  assert.match(page, /getEntry\('projects', ID\)/);
  assert.match(page, /const article = splitArticle\(html\);/);
  assert.match(page, /checkFigures\(article, \[SHOT_NAME, \.\.\.Object\.keys\(CHARTS\)\], ID\);/);
  assert.match(page, /const \[first, second, \.\.\.more\] = article\.leadParts;/);
  assert.match(page, /if \(!standfirst \|\| second\?\.kind !== 'figure' \|\| second\.name !== SHOT_NAME \|\| more\.length > 0\) \{\s*throw new Error\(/);
  assert.match(page, /<Base title=\{entry\.data\.title\} section=\{work\.key\}>/);
  assert.match(page, /<PageHead\s+title=\{entry\.data\.title\}/);
  assert.match(page, /<Fragment slot="standfirst" set:html=\{standfirst\} \/>/);
  assert.match(page, /<ArticleSection id=\{section\.id\} heading=\{section\.heading\}>/);
  // No sentence of the write-up is repeated in the page or a component.
  for (const sentence of ['risk-adjusted score', 'Most career advice', 'Publish the misses', 'really declined']) {
    for (const text of all) assert.equal(text.includes(sentence), false, sentence);
  }
});

test('the Work tab is current, the crumbs lead home and to Work, and no nav item is added', () => {
  assert.match(page, /const work = navItem\('work'\);/);
  assert.match(page, /\{ label: home\.label, href: home\.href \},\s*\{ label: work\.label, href: work\.href \},/);
  assert.match(head, /<h1 id="page-heading" tabindex="-1">\{title\}<\/h1>/);
  assert.match(head, /<p class="standfirst"><slot name="standfirst">\{standfirst\}<\/slot><\/p>/);
  assert.equal(
    NAV.some((item) => item.href === '/career-star'),
    false,
  );
});

test('the Screenshot slab: FramedImage, lazy, the alt text, a fixed height cropped at the bottom', () => {
  for (const text of all) assert.equal(/<img\b/.test(text), false);
  assert.match(slab, /<FramedImage src=\{src\} alt=\{alt\} widths=\{widths\} sizes=\{SIZES\} class="page" \/>/);
  assert.equal(/\beager\b/.test(slab), false);
  assert.match(page, /alt: 'Career Star rating page for registered nurses: 75 out of 100, top tier, with Return 78, Resilience 69 and Fit 100, and the bull and bear case\.'/);
  assert.match(slab, /\.slab \{\s*height: 520px;\s*padding: var\(--space-7\) var\(--space-7\) 0;\s*overflow: hidden;\s*background: var\(--color-field\);\s*border-radius: var\(--radius-lg\);/);
  assert.match(slab, /\.slab \.page \{\s*width: 100%;\s*max-width: 860px;\s*margin: 0 auto;/);
  assert.match(slab, /@media \(max-width: 760px\) \{\s*\/\*[^*]*\*\/\s*\.slab \{\s*height: auto;\s*max-height: 360px;\s*padding: var\(--space-4\) var\(--space-4\) 0;/);
});

test('no client script, no hover motion and no color value outside the tokens', () => {
  for (const text of all) {
    assert.equal(/<script/.test(text), false);
    assert.equal(/transform|transition|animation/.test(text), false);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text), false);
  }
});
