// Health Dashboard case study: the write-up as the content file gives it, the figures'
// sample-data wording, and the rules the page and its components keep in their source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV } from '../src/lib/nav.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const page = read('pages', 'health-dashboard.astro');
const hero = read('components', 'CaseHero.astro');
const device = read('components', 'DeviceFrame.astro');
const section = read('components', 'ArticleSection.astro');
const figure = read('components', 'Figure.astro');
const nights = read('components', 'figures', 'NightsChart.astro');
const plan = read('components', 'figures', 'PlanBackwardChart.astro');
const all = [page, hero, device, section, figure, nights, plan];

const file = read('content', 'projects', 'health-dashboard.md');
const body = file.split(/^---$/m).slice(2).join('---');

test('the write-up: a lead, six sections, three subheads, two lists and two figures', () => {
  assert.match(body, /^\s*A sleep and recovery app for iPhone and Apple Watch that plans around my exams, written in Swift\.\n/);
  assert.deepEqual(
    [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    ['The problem', "What I'm building", 'Key decisions', 'Where it is now', 'Where it started', 'Details'],
  );
  assert.deepEqual(
    [...body.matchAll(/^### (.+)$/gm)].map((match) => match[1]),
    ['Keep the data on the device', 'Plan backward from the exam', 'Make the Watch alarm first-class'],
  );
  const lead = body.split(/^## /m)[0];
  assert.deepEqual([...lead.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]), ['Status', 'Code']);
  assert.equal(body.match(/<dl class="feat">/g)?.length, 1);
  assert.equal(body.match(/<dl class="facts">/g)?.length, 1);
  assert.equal(body.match(/<dt>/g)?.length, 2 + 5 + 6);
  assert.deepEqual(
    [...body.matchAll(/^\[\[figure:([a-z-]+)\]\]/gm)].map((match) => match[1]),
    ['nights', 'plan-backward'],
  );
});

test('both figures say they are not real data, in the caption', () => {
  assert.match(body, /^\[\[figure:nights\]\] \*\*Figure 1\. Sample data\.\*\* .*Made up for illustration, not my readings\.$/m);
  assert.match(body, /^\[\[figure:plan-backward\]\] \*\*Figure 2\.\*\* Example values, not my schedule\. /m);
});

test('Figure 1 says sample data in its label and inside the chart, from the generator', () => {
  assert.match(nights, /import \{ EXAM_WEEK, sampleNights \} from '\.\.\/\.\.\/lib\/sample-nights';/);
  assert.match(nights, /`Sample data for \$\{nights\.length\} nights: /);
  assert.match(nights, /\$\{Math\.min\(\.\.\.sleep\)\} and `/);
  assert.match(nights, /\$\{Math\.max\(\.\.\.sleep\)\} hours/);
  assert.match(nights, /\$\{Math\.min\(\.\.\.hrv\)\} and \$\{Math\.max\(\.\.\.hrv\)\}\./);
  assert.match(nights, /role="img" aria-label=\{label\}/);
  assert.match(nights, />Sample data · an exam week on nights \{EXAM_WEEK\.first\} to \{EXAM_WEEK\.last\}: less sleep, lower HRV</);
});

test('Figure 2 says example in its label', () => {
  assert.match(plan, /role="img"\s+aria-label="Example: for a 9 a\.m\. exam the wake-up is 7:30 a\.m\.;/);
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
  assert.match(page, /const html = entry\.rendered\?\.html;/);
  assert.match(page, /const article = splitArticle\(html\);/);
  assert.match(page, /checkFigures\(article, Object\.keys\(FIGURES\), ID\);/);
  assert.match(page, /<Base title=\{entry\.data\.title\} section=\{work\.key\}>/);
  assert.match(page, /<CaseHero\s+title=\{entry\.data\.title\}/);
  assert.match(page, /<Fragment set:html=\{article\.lead\} \/>/);
  assert.match(page, /<ArticleSection id=\{section\.id\} heading=\{section\.heading\}>/);
  assert.match(page, /nights: \{ chart: NightsChart, wide: true \},\s*'plan-backward': \{ chart: PlanBackwardChart, maxWidth: 620 \},/);
  // No sentence of the write-up is repeated in the page or a component.
  for (const sentence of ['plans around my exams', 'No app fit my schedule', 'Made up for illustration']) {
    for (const text of all) assert.equal(text.includes(sentence), false, sentence);
  }
});

test('the Work tab is current and no nav item is added', () => {
  assert.match(page, /const work = navItem\('work'\);/);
  assert.equal(
    NAV.some((item) => item.href === '/health-dashboard'),
    false,
  );
});

test('the hero: every breadcrumb step links to its page; the h1 is the focus target', () => {
  assert.match(page, /\{ label: home\.label, href: home\.href \},\s*\{ label: work\.label, href: work\.href \},/);
  assert.match(hero, /<a href=\{step\.href\}>\{step\.label\}<\/a>\s*\{' \/ '\}/);
  assert.match(hero, /<h1 id="page-heading" tabindex="-1">\{title\}<\/h1>/);
  assert.match(hero, /background: var\(--color-field\);\s*border-bottom: 1px solid var\(--color-hair\);/);
});

test('screenshots: FramedImage, lazy, the alt text, in a labeled group; the icon keeps its alt', () => {
  for (const text of all) assert.equal(/<img\b/.test(text), false);
  assert.match(device, /<FramedImage src=\{src\} alt=\{alt\} widths=\{widths\} sizes=\{SIZES\} position="top" class="screen" \/>/);
  assert.equal(/\beager\b/.test(device), false);
  assert.match(hero, /<div class="shots" role="group" aria-label=\{shotsLabel\}>/);
  assert.match(page, /const SHOTS_LABEL = 'App screenshots';/);
  assert.match(page, /alt: 'The app icon, redesigned November 1: a sunburst with a heartbeat line'/);
  assert.match(page, /alt: "Health Dashboard Sleep tab: 7 hours 21 minutes last night, /);
  assert.match(page, /alt: "Health Dashboard Fitness tab: 'Keep it easy' with a recovery of 68, /);
  assert.match(page, /built-in example data\./);
});

test('the device frame: the bezel token, a phone shape, 38vw on a phone', () => {
  assert.match(device, /width: clamp\(150px, 13vw, 188px\);\s*aspect-ratio: 9 \/ 19\.5;\s*border: 6px solid var\(--color-device-bezel\);/);
  assert.match(device, /@media \(max-width: 760px\) \{\s*\.dev \{\s*width: 38vw;\s*border-width: 5px;/);
});

test('shots right of the intro, under it and left-aligned at 1060px and below', () => {
  assert.match(hero, /\.intro \{\s*grid-column: 1 \/ 7;/);
  assert.match(hero, /\.shots-wrap \{\s*grid-column: 7 \/ 13;/);
  assert.match(
    hero,
    /@media \(max-width: 1060px\) \{\s*\.intro \{\s*grid-column: 1 \/ -1;[^}]*\}\s*\.shots-wrap \{\s*grid-column: 1 \/ -1;\s*align-items: flex-start;/,
  );
});

test('both lists are one column at 760px and below', () => {
  assert.match(section, /\.art dl\.feat \{[^}]*grid-template-columns: 190px minmax\(0, 1fr\);/);
  assert.match(section, /\.art dl\.facts \{[^}]*grid-template-columns: 170px minmax\(0, 1fr\);/);
  assert.match(
    section,
    /@media \(max-width: 760px\) \{\s*\.art dl\.feat,\s*\.art dl\.facts \{\s*grid-template-columns: minmax\(0, 1fr\);/,
  );
});

test('the figure: a slab when wide, the chart tokens, near-white words on the sleep bar', () => {
  assert.match(figure, /\{wide \? <div class="slab"><slot \/><\/div> : <slot \/>\}/);
  assert.match(figure, /<figcaption class="cap"><slot name="caption" \/><\/figcaption>/);
  assert.match(figure, /\.fig \.ln \{[^}]*stroke: var\(--color-chart-line\);/);
  assert.match(figure, /\.fig \.sleep \{\s*fill: var\(--color-chart-sleep\);/);
  assert.match(figure, /\.fig text\.on \{\s*fill: var\(--color-print\);/);
});

test('no client script, no hover motion and no color value outside the tokens', () => {
  for (const text of all) {
    assert.equal(/<script/.test(text), false);
    assert.equal(/transform|transition|animation/.test(text), false);
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text), false);
  }
});

test('a figure in the lead fails the build', () => {
  assert.match(page, /if \(article\.leadParts\.some\(\(part\) => part\.kind === 'figure'\)\) throw new Error\(/);
});
