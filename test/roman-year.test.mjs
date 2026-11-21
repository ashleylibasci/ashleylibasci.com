// The footer year in Roman numerals: the pure core, one test per matrix row,
// plus the markup, the footer mount and the leaf rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { romanFromText, toRoman } from '../src/islands/roman-year/roman-core.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const island = join(src, 'islands', 'roman-year');
const read = (/** @type {string} */ file) => readFileSync(join(island, file), 'utf8');

test('hover year: 2026 becomes MMXXVI', () => {
  assert.equal(toRoman(2026), 'MMXXVI');
  assert.equal(romanFromText('2026'), 'MMXXVI');
  assert.equal(romanFromText(' 2026\n'), 'MMXXVI');
});

test('other years: the standard subtractive form', () => {
  assert.equal(toRoman(1999), 'MCMXCIX');
  assert.equal(toRoman(2027), 'MMXXVII');
  assert.equal(toRoman(2030), 'MMXXX');
  assert.equal(toRoman(3999), 'MMMCMXCIX');
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(944), 'CMXLIV');
});

test('bad year: null, so hover leaves the text as it is', () => {
  for (const value of [0, -1, 4000, 2026.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(toRoman(value), null, String(value));
  }
  for (const text of ['', 'abc', '20 26', '2026a', '-5', '0', '4000', '1e3', '2026.0']) {
    assert.equal(romanFromText(text), null, JSON.stringify(text));
  }
});

test('markup: the year is its own element, not focusable, with a default cursor', () => {
  const component = read('RomanYear.astro');
  assert.match(component, /<span class="cy" data-roman-year>\{year\}<\/span>/);
  assert.doesNotMatch(component, /tabindex/);
  assert.match(component, /\.cy \{\s*cursor: default;\s*\}/);
  assert.doesNotMatch(component, /animation|transition/);
  assert.match(component, /<script>\s*import '\.\/roman-year\.ts';\s*<\/script>/);
});

test('the footer mounts the year island with the build-time year, beside the dog', () => {
  const footer = readFileSync(join(src, 'layouts', 'Footer.astro'), 'utf8');
  assert.match(footer, /<span>© <RomanYear year=\{COPYRIGHT_YEAR\} \/> \{SITE_NAME\}<\/span><span data-slot="footer-drawing">/);
  assert.equal(/MMXXVI/.test(footer), false);
});

test('the Roman text is computed, never hard-coded', () => {
  for (const file of ['roman-core.ts', 'roman-year.ts', 'RomanYear.astro']) {
    assert.equal(/MMXXVI/.test(read(file)), false, file);
  }
});

test('the island scripts import nothing outside their own folder', () => {
  for (const file of ['roman-core.ts', 'roman-year.ts', 'RomanYear.astro']) {
    const source = read(file);
    for (const match of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
    }
  }
});

test('the script: mouseenter and mouseleave on the year only, no window or document listener', () => {
  const script = read('roman-year.ts');
  assert.equal(/(?:window|document|documentElement|body)\s*\.\s*addEventListener/.test(script), false);
  const listeners = [...script.matchAll(/(\w+)\.addEventListener\('(\w+)'/g)].map((match) => `${match[1]}:${match[2]}`);
  assert.deepEqual(listeners, ['year:mouseenter', 'year:mouseleave']);
  assert.equal(/preventDefault|\.focus\(/.test(script), false);
  assert.equal(/\bdocument\.|\bwindow\./.test(read('roman-core.ts')), false, 'the core has no DOM');
});
