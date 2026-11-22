// Theme head-script tests: the inline script from Base.astro runs in a vm
// against fake document and localStorage objects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');
const base = readFileSync(join(SRC, 'layouts', 'Base.astro'), 'utf8');
const scripts = [...base.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');

/** @param {{ stored?: string | null, throws?: boolean }} [state] */
function run({ stored = null, throws = false } = {}) {
  /** @type {Record<string, string>} */
  const attrs = {};
  /** @type {string[]} */
  const writes = [];
  const document = {
    documentElement: {
      /** @param {string} name @param {string} value */
      setAttribute(name, value) {
        attrs[name] = value;
      },
    },
  };
  const storage = {
    /** @param {string} key */
    getItem(key) {
      return key === 'al-theme' ? stored : null;
    },
    /** @param {string} key */
    setItem(key) {
      writes.push(key);
    },
  };
  const sandbox = { document };
  Object.defineProperty(sandbox, 'localStorage', {
    get() {
      if (throws) throw new Error('SecurityError');
      return storage;
    },
  });
  vm.runInNewContext(scripts[0] ?? '', sandbox);
  return { attrs, writes };
}

// `<script is:inline>` with no attributes is the theme script; the analytics beacon
// (`<script is:inline type="module" ...>`) is checked in analytics.test.mjs.
test('Base.astro has exactly one theme head script, before the title', () => {
  assert.equal(scripts.length, 1);
  const at = base.indexOf('<script is:inline>');
  assert.ok(at > base.indexOf('<head>'));
  assert.ok(at > base.indexOf('name="viewport"'));
  assert.ok(at < base.indexOf('<title>'));
});

test('first visit is light', () => {
  assert.deepEqual(run().attrs, { 'data-theme': 'light' });
});

test('stored dark is dark', () => {
  assert.deepEqual(run({ stored: 'dark' }).attrs, { 'data-theme': 'dark' });
});

test('stored light is light', () => {
  assert.deepEqual(run({ stored: 'light' }).attrs, { 'data-theme': 'light' });
});

test('junk values are light', () => {
  for (const stored of ['', 'DARK', 'dark ', 'auto', 'system', 'true', '1']) {
    assert.deepEqual(run({ stored }).attrs, { 'data-theme': 'light' }, JSON.stringify(stored));
  }
});

test('throwing storage is light and does not throw', () => {
  assert.deepEqual(run({ throws: true }).attrs, { 'data-theme': 'light' });
});

test('the head script never writes storage', () => {
  assert.deepEqual(run({ stored: 'dark' }).writes, []);
  assert.doesNotMatch(scripts[0] ?? '', /setItem/);
});

test('theme code never reads the OS colour scheme', () => {
  const toggle = join(SRC, 'islands', 'theme-toggle');
  const sources = [
    scripts[0] ?? '',
    readFileSync(join(toggle, 'theme-toggle.ts'), 'utf8'),
    readFileSync(join(toggle, 'ThemeToggle.astro'), 'utf8'),
  ];
  for (const source of sources) {
    assert.doesNotMatch(source, /matchMedia/);
    assert.doesNotMatch(source, /prefers-color-scheme/);
  }
});
