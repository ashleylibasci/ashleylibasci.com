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

test('the heartbeat line is decoration: hidden from assistive technology, never focusable', () => {
  const component = read('HealthDemo.astro');
  const svg = component.match(/<svg[^>]*>/)?.[0] ?? '';
  assert.match(svg, /aria-hidden="true"/);
  assert.doesNotMatch(svg, /tabindex/);
});

test('the title and the Placard link are links only when the page exists', () => {
  const page = readFileSync(join(island, '..', '..', 'pages', 'index.astro'), 'utf8');
  assert.match(page, /const healthHref = routeExists\(health\.data\.href\) \? health\.data\.href : null;/);
  assert.match(page, /\{healthHref \? <a href=\{healthHref\}>\{health\.data\.title\}<\/a> : health\.data\.title\}/);
  assert.match(page, /\{healthHref && <>\{' '\}<a href=\{healthHref\}>How I'm building it<\/a><\/>\}/);
  assert.equal([...page.matchAll(/href=\{healthHref\}/g)].length, 2);
});
