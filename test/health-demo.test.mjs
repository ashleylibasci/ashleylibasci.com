// Health Dashboard Demo: the exam-night rule, one test per matrix row, plus the
// labels, the tab keys, the import boundary and the default answer in the markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_EXAM,
  DEFAULT_MODE,
  DEFAULT_SCREEN,
  EXAMS,
  MODES,
  SCREENS,
  clock,
  nextTab,
  plan,
} from '../src/islands/health-demo/demo-core.ts';

const island = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'islands', 'health-demo');
const read = (/** @type {string} */ file) => readFileSync(join(island, file), 'utf8');

/** "7:30 a.m." for a number of minutes. */
const words = (/** @type {number} */ minutes) => {
  const { time, period } = clock(minutes);
  return `${time} ${period}`;
};

const ROWS = /** @type {const} */ ([
  [480, 'easy', '6:30 a.m.', '10:15 p.m.'],
  [480, 'most', '7:00 a.m.', '10:45 p.m.'],
  [540, 'easy', '7:30 a.m.', '11:15 p.m.'],
  [540, 'most', '8:00 a.m.', '11:45 p.m.'],
  [600, 'easy', '8:30 a.m.', '12:15 a.m.'],
  [600, 'most', '9:00 a.m.', '12:45 a.m.'],
]);

for (const [exam, mode, wake, bed] of ROWS) {
  test(`exam at ${words(exam)}, ${mode}: wake up ${wake}, bed by ${bed}`, () => {
    const answer = plan(exam, mode);
    assert.equal(words(answer.wake), wake);
    assert.equal(words(answer.bed), bed);
  });
}

test('the rule: wake 90 min before the exam, 30 min later for Most sleep; bed 8 h 15 min before waking', () => {
  assert.deepEqual(plan(540, 'easy'), { wake: 450, bed: -45 });
  assert.deepEqual(plan(540, 'most'), { wake: 480, bed: -15 });
});

test('clock across midnight and noon', () => {
  assert.deepEqual(clock(0), { time: '12:00', period: 'a.m.' });
  assert.deepEqual(clock(5), { time: '12:05', period: 'a.m.' });
  assert.deepEqual(clock(-1), { time: '11:59', period: 'p.m.' });
  assert.deepEqual(clock(-45), { time: '11:15', period: 'p.m.' });
  assert.deepEqual(clock(1440), { time: '12:00', period: 'a.m.' });
  assert.deepEqual(clock(1455), { time: '12:15', period: 'a.m.' });
  assert.deepEqual(clock(719), { time: '11:59', period: 'a.m.' });
  assert.deepEqual(clock(720), { time: '12:00', period: 'p.m.' });
  assert.deepEqual(clock(780), { time: '1:00', period: 'p.m.' });
  assert.deepEqual(clock(450), { time: '7:30', period: 'a.m.' });
});

test('tab keys: Right and Left wrap, Home and End jump, other keys are ignored', () => {
  assert.equal(nextTab('ArrowRight', 0, 2), 1);
  assert.equal(nextTab('ArrowRight', 1, 2), 0);
  assert.equal(nextTab('ArrowLeft', 0, 2), 1);
  assert.equal(nextTab('ArrowLeft', 1, 2), 0);
  assert.equal(nextTab('Home', 1, 2), 0);
  assert.equal(nextTab('End', 0, 2), 1);
  assert.equal(nextTab('End', 0, 3), 2);
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Tab', 'a']) assert.equal(nextTab(key, 0, 2), null);
  assert.equal(nextTab('ArrowRight', 0, 0), null);
});

test('labels and captions', () => {
  assert.deepEqual(EXAMS, [
    { value: 480, label: '8:00' },
    { value: 540, label: '9:00' },
    { value: 600, label: '10:00 a.m.' },
  ]);
  assert.deepEqual(MODES, [
    { value: 'easy', label: 'Easier wake-up' },
    { value: 'most', label: 'Most sleep' },
  ]);
  assert.deepEqual(SCREENS, [
    {
      value: 'sleep',
      label: 'Sleep',
      caption: "Last night measured against an 8-hour need, and tonight's bed-by time.",
    },
    {
      value: 'fit',
      label: 'Fitness',
      caption: 'A lighter session when recovery is low, timed to finish early before an exam.',
    },
  ]);
  assert.deepEqual([DEFAULT_EXAM, DEFAULT_MODE, DEFAULT_SCREEN], [540, 'easy', 'sleep']);
});

test('the client script imports nothing outside its own folder', () => {
  const component = read('HealthDemo.astro');
  const scripts = [...component.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
  assert.equal(scripts.length, 1);
  const sources = { 'demo-core.ts': read('demo-core.ts'), 'health-demo.ts': read('health-demo.ts'), script: scripts[0] ?? '' };
  let seen = 0;
  for (const [file, source] of Object.entries(sources)) {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
      seen += 1;
    }
  }
  assert.ok(seen >= 2, 'the script and the leaf each import from the folder');
});

test('no JavaScript: the markup is the default answer, worked out from the core', () => {
  const component = read('HealthDemo.astro');
  assert.match(component, /const answer = plan\(DEFAULT_EXAM, DEFAULT_MODE\);/);
  assert.match(component, /checked=\{exam\.value === DEFAULT_EXAM\}/);
  assert.match(component, /checked=\{mode\.value === DEFAULT_MODE\}/);
  assert.match(component, /checked=\{screen\.value === DEFAULT_SCREEN\}/);
  const answer = plan(DEFAULT_EXAM, DEFAULT_MODE);
  assert.equal(words(answer.wake), '7:30 a.m.');
  assert.equal(words(answer.bed), '11:15 p.m.');
});

test('the heartbeat line: the SVG stays hidden, its wrapper is the one focus stop', () => {
  const component = read('HealthDemo.astro');
  const svg = component.match(/<svg[^>]*>/)?.[0] ?? '';
  assert.match(svg, /aria-hidden="true"/);
  assert.doesNotMatch(svg, /tabindex/);
  const hit = component.match(/<div class="beat-hit"[^>]*>/)?.[0] ?? '';
  assert.match(hit, /tabindex="0"/);
  assert.match(hit, /role="img"/);
  assert.match(hit, /aria-label="Heartbeat line"/);
  assert.match(hit, /aria-describedby="hd-beat-f"/);
  assert.match(component, /<div class="beat-hit"[^>]*>\s*<svg class="beat"/);
});

test('hidden math: the formula sits with the rule and reads as EXPERIENCE.md', () => {
  const component = read('HealthDemo.astro');
  const formula = component.match(/<p class="beat-f" id="hd-beat-f">(.*?)<\/p>/)?.[1] ?? '';
  assert.equal(
    formula,
    '<i>f</i>(<i>t</i>) = 12 for <i>t</i> ≤ 186 and for <i>t</i> ≥ 290; between, straight lines through (208, 7), (238, 29) and (268, 2). Here <i>f</i> = 32 − <i>y</i>.',
  );
  assert.equal(
    formula.replace(/<\/?i>/g, ''),
    'f(t) = 12 for t ≤ 186 and for t ≥ 290; between, straight lines through (208, 7), (238, 29) and (268, 2). Here f = 32 − y.',
  );
  assert.match(component, /<div class="rule-wrap">\s*<p class="rule">[^<]*<\/p>\s*<p class="beat-f"/);
  assert.equal([...component.matchAll(/id="hd-beat-f"/g)].length, 1);
});

test('hidden math: the formula\'s numbers are 32 − y of the trace path', () => {
  const component = read('HealthDemo.astro');
  const d = component.match(/<path class="trace"[^>]* d="([^"]+)"/)?.[1] ?? '';
  assert.equal(d, 'M2 20 H186 L208 25 L238 3 L268 30 L290 20 H478');
  /** @type {Map<number, number>} */
  const vertices = new Map();
  let y = 0;
  for (const [, cmd, args] of d.matchAll(/([MHL])\s*([\d.\s]+)/g)) {
    const nums = (args ?? '').trim().split(/\s+/).map(Number);
    if (cmd === 'H') vertices.set(nums[0] ?? 0, y);
    else {
      y = nums[1] ?? 0;
      vertices.set(nums[0] ?? 0, y);
    }
  }
  const f = (/** @type {number} */ t) => 32 - (vertices.get(t) ?? Number.NaN);
  assert.equal(f(186), 12);
  assert.equal(f(290), 12);
  assert.equal(f(2), 12);
  assert.equal(f(478), 12);
  const formula = component.match(/<p class="beat-f"[^>]*>(.*?)<\/p>/)?.[1] ?? '';
  const points = [...formula.matchAll(/\((\d+), (\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(points, [
    [208, 7],
    [238, 29],
    [268, 2],
  ]);
  for (const [t, value] of points) assert.equal(f(t ?? 0), value, `t = ${t}`);
  assert.match(formula, /= 12 for <i>t<\/i> ≤ 186 and for <i>t<\/i> ≥ 290;/);
});

test('hidden math styles: one grid cell, a --t fade on hover or focus, no script', () => {
  const component = read('HealthDemo.astro');
  assert.match(component, /\.rule-wrap \{\s*display: grid;/);
  assert.match(component, /\.rule-wrap > \* \{\s*grid-area: 1 \/ 1;[^}]*opacity var\(--t\) ease-out,\s*visibility var\(--t\) ease-out;/);
  assert.match(component, /\.beat-hit:hover ~ \.rule-wrap \.beat-f,\s*\.beat-hit:focus ~ \.rule-wrap \.beat-f \{\s*opacity: 1;\s*visibility: visible;/);
  assert.match(component, /\.beat-hit:hover ~ \.rule-wrap \.rule,\s*\.beat-hit:focus ~ \.rule-wrap \.rule \{\s*opacity: 0;\s*visibility: hidden;/);
  assert.match(component, /\.beat-hit:focus-visible \{\s*outline-offset: 2px;/);
  assert.match(component, /\.beat \{\s*display: block;/);
  assert.equal(/beat-f|rule-wrap|beat-hit/.test(read('health-demo.ts')), false, 'the swap needs no script');
});

test('the title and the Placard link are links only when the page exists', () => {
  const page = readFileSync(join(island, '..', '..', 'pages', 'index.astro'), 'utf8');
  assert.match(page, /const healthHref = routeExists\(health\.data\.href\) \? health\.data\.href : null;/);
  assert.match(page, /\{healthHref \? <a href=\{healthHref\}>\{health\.data\.title\}<\/a> : health\.data\.title\}/);
  assert.match(page, /\{healthHref && <>\{' '\}<a href=\{healthHref\}>How I'm building it<\/a><\/>\}/);
  assert.equal([...page.matchAll(/href=\{healthHref\}/g)].length, 2);
});
