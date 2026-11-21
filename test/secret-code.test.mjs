// Secret code: the pure core with plain key objects and a seeded random, one
// test per matrix row the core decides, then checks on the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUBBLE_COUNT,
  CODE,
  RISE_CLEAR_MS,
  STILL_CLEAR_MS,
  bubbles,
  clearAfter,
  createMatcher,
  isTextField,
} from '../src/islands/secret-code/code-core.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const island = join(src, 'islands', 'secret-code');
/** @param {...string} parts */
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

const KEYS = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const BODY = { tagName: 'BODY' };

/**
 * Feeds keys to a matcher; returns the index of each key that completed the code.
 * @param {ReturnType<typeof createMatcher>} step
 * @param {Array<string | object>} keys
 */
function feed(step, keys) {
  /** @type {number[]} */
  const hits = [];
  keys.forEach((key, i) => {
    const event = typeof key === 'string' ? { key, target: BODY } : { target: BODY, ...key };
    if (step(event)) hits.push(i);
  });
  return hits;
}

/** A small seeded random (mulberry32). @param {number} seed */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('the code is up up down down left right left right B A', () => {
  assert.deepEqual([...CODE], KEYS.map((key) => key.toLowerCase()));
});

test('full code: triggers on the last key, with focus on body or a link', () => {
  assert.deepEqual(feed(createMatcher(), KEYS), [9]);
  const link = { tagName: 'A' };
  assert.deepEqual(feed(createMatcher(), KEYS.map((key) => ({ key, target: link }))), [9]);
});

test('three ups first: still triggers', () => {
  assert.deepEqual(feed(createMatcher(), ['ArrowUp', ...KEYS]), [10]);
  assert.deepEqual(feed(createMatcher(), ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', ...KEYS.slice(2)]), [11]);
});

test('an up arrow midway restarts at step 1', () => {
  // up up down up -> step 1, so one more up then the rest triggers.
  assert.deepEqual(feed(createMatcher(), ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowUp', 'ArrowUp', ...KEYS.slice(2)]), [12]);
});

test('wrong key midway: resets and the rest does not trigger', () => {
  assert.deepEqual(feed(createMatcher(), ['ArrowUp', 'ArrowUp', 'ArrowDown', 'x', ...KEYS.slice(3)]), []);
  // After the reset a full code still works.
  assert.deepEqual(feed(createMatcher(), ['ArrowUp', 'ArrowUp', 'ArrowDown', 'x', ...KEYS]), [13]);
});

test('capital B and A: Shift+B, Shift+A at the end triggers, bare Shift ignored', () => {
  const keys = [...KEYS.slice(0, 8), { key: 'Shift', shiftKey: true }, 'B', { key: 'Shift' }, 'A'];
  assert.deepEqual(feed(createMatcher(), keys), [11]);
});

test('Ctrl, Alt or Meta held: ignored, the sequence still waits for A', () => {
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
    const keys = [...KEYS.slice(0, 9), { key: 'a', [mod]: true }, 'a'];
    assert.deepEqual(feed(createMatcher(), keys), [10], mod);
  }
  for (const key of ['Control', 'Alt', 'Meta']) {
    assert.deepEqual(feed(createMatcher(), [...KEYS.slice(0, 9), key, 'a']), [10], key);
  }
});

test('key repeats and IME composition neither advance nor reset', () => {
  const repeat = [...KEYS.slice(0, 3), { key: 'ArrowDown', repeat: true }, ...KEYS.slice(3)];
  assert.deepEqual(feed(createMatcher(), repeat), [10]);
  const ime = [...KEYS.slice(0, 5), { key: 'x', isComposing: true }, { key: 'Process' }, ...KEYS.slice(5)];
  assert.deepEqual(feed(createMatcher(), ime), [11]);
});

test('text field: nothing typed there is counted', () => {
  const fields = [
    { tagName: 'INPUT', type: 'text' },
    { tagName: 'INPUT', type: 'email' },
    { tagName: 'INPUT' },
    { tagName: 'TEXTAREA' },
    { tagName: 'SELECT' },
    { tagName: 'DIV', isContentEditable: true },
  ];
  for (const target of fields) {
    assert.equal(isTextField(target), true, JSON.stringify(target));
    assert.deepEqual(feed(createMatcher(), KEYS.map((key) => ({ key, target }))), [], JSON.stringify(target));
  }
  // Keys in a field do not reset progress made outside it.
  const field = { tagName: 'INPUT', type: 'text' };
  assert.deepEqual(feed(createMatcher(), [...KEYS.slice(0, 5), { key: 'x', target: field }, ...KEYS.slice(5)]), [10]);
});

test('checkbox focused, and the other non-typing inputs: triggers', () => {
  for (const type of ['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'CHECKBOX']) {
    const target = { tagName: 'INPUT', type };
    assert.equal(isTextField(target), false, type);
    assert.deepEqual(feed(createMatcher(), KEYS.map((key) => ({ key, target }))), [9], type);
  }
  for (const target of [null, undefined, {}, { tagName: 'BUTTON' }, BODY, 'body']) {
    assert.equal(isTextField(target), false);
  }
});

test('again while showing: a second full code triggers again', () => {
  assert.deepEqual(feed(createMatcher(), [...KEYS, ...KEYS]), [9, 19]);
});

test('no key: treated as a wrong key', () => {
  assert.deepEqual(feed(createMatcher(), [...KEYS.slice(0, 4), {}, ...KEYS.slice(4)]), []);
  assert.deepEqual(feed(createMatcher(), [...KEYS.slice(0, 4), { key: undefined }, ...KEYS]), [14]);
});

/** @param {string} value @param {string} unit */
const num = (value, unit) => {
  assert.ok(value.endsWith(unit), `${value} ends with ${unit}`);
  return Number.parseFloat(value);
};

test('moving bubbles: 30, 4-14px, left 2-98%, rise 2.6-3.5s after 0-0.6s, drift within 30px', () => {
  for (const random of [seeded(1), seeded(42), () => 0, () => 0.999999]) {
    const set = bubbles(random, false);
    assert.equal(set.length, 30);
    assert.equal(BUBBLE_COUNT, 30);
    for (const spec of set) {
      const size = num(spec.size, 'px');
      assert.ok(size >= 4 && size <= 14, spec.size);
      const left = num(spec.left, '%');
      assert.ok(left >= 2 && left <= 98, spec.left);
      assert.equal(spec.top, undefined);
      assert.ok(spec.vars);
      const d = num(spec.vars['--d'], 's');
      assert.ok(d >= 2.6 && d <= 3.5, spec.vars['--d']);
      const w = num(spec.vars['--w'], 's');
      assert.ok(w >= 0 && w <= 0.6, spec.vars['--w']);
      const dx = num(spec.vars['--dx'], 'px');
      assert.ok(Math.abs(dx) <= 30, spec.vars['--dx']);
    }
  }
  // A seeded random spreads them out.
  const lefts = new Set(bubbles(seeded(7), false).map((spec) => spec.left));
  assert.ok(lefts.size > 20);
});

test('reduced motion: 30 still bubbles scattered at top 12-88%, no rise properties', () => {
  for (const random of [seeded(3), () => 0, () => 0.999999]) {
    const set = bubbles(random, true);
    assert.equal(set.length, 30);
    for (const spec of set) {
      const size = num(spec.size, 'px');
      assert.ok(size >= 4 && size <= 14);
      const left = num(spec.left, '%');
      assert.ok(left >= 2 && left <= 98);
      assert.ok(spec.top);
      const top = num(spec.top, '%');
      assert.ok(top >= 12 && top <= 88, spec.top);
      assert.equal(spec.vars, undefined);
    }
  }
});

test('the layer clears 4.3s after a rise and 2.4s after still bubbles', () => {
  assert.equal(clearAfter(false), 4300);
  assert.equal(clearAfter(true), 2400);
  assert.equal(RISE_CLEAR_MS, 4300);
  assert.equal(STILL_CLEAR_MS, 2400);
});

// ---- The source.

test('markup: one hidden layer and the script; styles on tokens with the still look', () => {
  const source = read('islands', 'secret-code', 'SecretCode.astro');
  assert.equal([...source.matchAll(/<div /g)].length, 1);
  assert.match(source, /<div class="code-rise" data-secret-code aria-hidden="true"><\/div>/);
  assert.match(source, /<script>\s*import '\.\/secret-code\.ts';\s*<\/script>/);
  assert.match(source, /\.code-rise \{\s*position: fixed;\s*inset: 0;\s*z-index: 58;\s*pointer-events: none;\s*overflow: hidden;/);
  assert.match(source, /\.code-rise :global\(i\) \{[^}]*border: 1px solid var\(--color-egg-teal\);[^}]*animation: code-rise /);
  assert.match(source, /\.code-rise\.still :global\(i\) \{\s*bottom: auto;\s*animation: none;\s*opacity: 0\.5;/);
  assert.match(source, /@keyframes code-rise \{/);
  assert.equal(/rise-up/.test(source), false);
});

test('Base mounts the code once, after page-focus, and keeps one inline script', () => {
  const base = read('layouts', 'Base.astro');
  assert.match(base, /import SecretCode from '\.\.\/islands\/secret-code\/SecretCode\.astro';/);
  assert.equal([...base.matchAll(/<SecretCode \/>/g)].length, 1);
  assert.match(base, /<PageFocus \/>\s*<SecretCode \/>\s*<\/body>/);
  assert.equal([...base.matchAll(/<script/g)].length, 1);
});

test('the client script imports nothing outside its own folder', () => {
  const component = read('islands', 'secret-code', 'SecretCode.astro');
  const scripts = [...component.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
  assert.equal(scripts.length, 1);
  const sources = {
    'code-core.ts': readFileSync(join(island, 'code-core.ts'), 'utf8'),
    'secret-code.ts': readFileSync(join(island, 'secret-code.ts'), 'utf8'),
    script: scripts[0] ?? '',
  };
  let seen = 0;
  for (const [file, source] of Object.entries(sources)) {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
      seen += 1;
    }
  }
  assert.ok(seen >= 2, 'the script and the leaf each import from the folder');
  assert.equal(/\bdocument\.|\bwindow\.|getComputedStyle\(/.test(sources['code-core.ts']), false, 'the core has no DOM');
});

test('no colour outside the tokens', () => {
  for (const file of ['SecretCode.astro', 'secret-code.ts', 'code-core.ts']) {
    const source = read('islands', 'secret-code', file);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(source), false, file);
  }
});

test('one passive window keydown listener that never cancels, stops or moves element focus', () => {
  for (const file of ['secret-code.ts', 'code-core.ts', 'SecretCode.astro']) {
    const source = read('islands', 'secret-code', file);
    assert.equal(/preventDefault|stopPropagation|stopImmediatePropagation|capture|document\.addEventListener/.test(source), false, file);
    assert.equal(/\.blur\(/.test(source), false, file);
    for (const match of source.matchAll(/(\w*)\.focus\(/g)) assert.equal(match[1], 'window', `${file}: ${match[0]}`);
    assert.equal(/beacon|analytics|gtag|track\(/i.test(source), false, file);
  }
  const script = read('islands', 'secret-code', 'secret-code.ts');
  const listeners = [...script.matchAll(/(\w+)\.addEventListener\(\s*'(\w+)'/g)].map((match) => `${match[1]}:${match[2]}`);
  assert.deepEqual(listeners, ['window:keydown', 'window:load']);
  assert.match(script, /\{ passive: true \}/);
  // window.focus() only when nothing has focus, inside try/catch, at start and on load.
  assert.match(script, /try \{\s*const active = document\.activeElement;\s*if \(!active \|\| active === document\.body\) window\.focus\(\);\s*\} catch/);
  assert.match(script, /\ngrab\(\);\nwindow\.addEventListener\('load', grab\);/);
  // The one layer is emptied and refilled, never a second one.
  assert.equal(/createElement\('div'\)|appendChild|\.remove\(\)/.test(script), false);
  assert.match(script, /window\.clearTimeout\(timer\);/);
});
