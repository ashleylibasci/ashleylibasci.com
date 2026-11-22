// Canonical URLs (AD-15): apex, pretty path, none on the 404 page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ORIGIN, canonicalUrl } from '../src/lib/canonical.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = readFileSync(join(root, 'src', 'layouts', 'Base.astro'), 'utf8');

test('canonical URLs map pathnames to the apex and skip the 404 page', () => {
  assert.equal(CANONICAL_ORIGIN, 'https://ashleylibasci.com');
  const cases = [
    ['/', 'https://ashleylibasci.com/'],
    ['/index.html', 'https://ashleylibasci.com/'],
    ['/work', 'https://ashleylibasci.com/work'],
    ['/work.html', 'https://ashleylibasci.com/work'],
    ['/404', null],
    ['/404.html', null],
  ];
  for (const [pathname, expected] of cases) assert.equal(canonicalUrl(/** @type {string} */ (pathname)), expected, pathname);
});

test('Base renders one canonical link, inside the head', () => {
  assert.equal((base.match(/rel="canonical"/g) ?? []).length, 1);
  const head = base.slice(base.indexOf('<head>'), base.indexOf('</head>'));
  assert.ok(head.includes('<link rel="canonical" href={canonical} />'));
});
