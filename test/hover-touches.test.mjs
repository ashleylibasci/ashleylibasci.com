// Hover touches: the 2px lift and darker hairline on the Print frame, the Contact print and
// the Work visual, and the underline sweep on the Resume button, as their source keeps them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

const files = {
  print: read('components', 'PrintFrame.astro'),
  contact: read('components', 'ContactPrint.astro'),
  work: read('components', 'WorkVisual.astro'),
  base: read('styles', 'base.css'),
};
const home = read('pages', 'index.astro');

const escape = (/** @type {string} */ text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The declarations of the first rule whose selector list is exactly `selector`. */
const rule = (/** @type {string} */ css, /** @type {string} */ selector) => {
  const match = css.match(new RegExp(`(?:^|[}\\s])${escape(selector)}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : undefined;
};

/** The body of the reduced-motion media block. */
const reduced = (/** @type {string} */ css) => {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start < 0) return undefined;
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(open + 1, i);
  }
  return undefined;
};

const lifts = [
  { name: 'Print frame', file: 'print', base: '.print-frame', hover: '.print-frame:hover', line: '--color-print-line-hover' },
  { name: 'Contact print', file: 'contact', base: '.pr', hover: 'a.fr:hover .pr', line: '--color-ink-3' },
  { name: 'Work visual', file: 'work', base: '.wv', hover: 'a.wv:hover', line: '--color-line-2' },
];

for (const lift of lifts) {
  const css = files[/** @type {keyof typeof files} */ (lift.file)];

  test(`${lift.name}: lifts 2px on hover with its own hairline token`, () => {
    const hover = rule(css, lift.hover);
    assert.ok(hover, `no ${lift.hover} rule`);
    assert.match(hover, /translate:\s*0 -2px;/);
    assert.match(hover, new RegExp(`border-color:\\s*var\\(${lift.line}\\);`));
    assert.doesNotMatch(hover, /transform:/, 'the lift uses translate, not transform');
  });

  test(`${lift.name}: the lift and hairline move over --t`, () => {
    const base = rule(css, lift.base);
    assert.ok(base, `no ${lift.base} rule`);
    assert.match(base, /translate var\(--t\) var\(--ease\)/);
    assert.match(base, /border-color var\(--t\) ease-out/);
  });

  test(`${lift.name}: no lift under reduced motion`, () => {
    const block = reduced(css);
    assert.ok(block, 'no reduced-motion block');
    const still = rule(block, lift.hover);
    assert.ok(still, `no reduced-motion ${lift.hover} rule`);
    assert.match(still, /translate:\s*none;/);
    assert.doesNotMatch(still, /border-color/, 'the hairline still darkens');
  });
}

test('Resume sweep: --t-sweep sits beside --t in :root', () => {
  const root = rule(files.base, ':root');
  assert.ok(root);
  assert.match(root, /--t:\s*0\.2s;/);
  assert.match(root, /--t-sweep:\s*0\.32s;/);
});

test('Resume sweep: a 1px line inset 26px and 9px, growing from the left', () => {
  assert.match(rule(files.base, '.btn') ?? '', /position:\s*relative;/);
  const line = rule(files.base, '.btn::after');
  assert.ok(line, 'no .btn::after rule');
  assert.match(line, /position:\s*absolute;/);
  assert.match(line, /left:\s*26px;/);
  assert.match(line, /right:\s*26px;/);
  assert.match(line, /bottom:\s*9px;/);
  assert.match(line, /height:\s*1px;/);
  assert.match(line, /background:\s*var\(--color-button-underline\);/);
  assert.match(line, /transform:\s*scaleX\(0\);/);
  assert.match(line, /transform-origin:\s*0 50%;/);
  assert.match(line, /transition:\s*transform var\(--t-sweep\) var\(--ease\);/);
});

test('Resume sweep: full width on hover and on keyboard focus', () => {
  const on = rule(files.base, '.btn:hover::after,\n.btn:focus-visible::after');
  assert.ok(on, 'no shared :hover / :focus-visible rule');
  assert.match(on, /transform:\s*scaleX\(1\);/);
});

test('Hover touches: colors come through tokens only', () => {
  for (const [name, css] of Object.entries(files)) {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${name} holds a hex color`);
  }
});

test('Hover touches: the home page holds no hover-touch rule', () => {
  assert.doesNotMatch(home, /translate:\s*0 -2px/);
  assert.doesNotMatch(home, /::after/);
  assert.doesNotMatch(home, /--color-button-underline|--t-sweep/);
});
