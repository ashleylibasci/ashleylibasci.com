// Route matching behind routeExists, against the pages that exist today.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchRoute, pageRoutes } from '../src/lib/route-match.ts';

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages');
const today = pageRoutes(
  readdirSync(pagesDir, { recursive: true }).map((file) => `../pages/${String(file).split('\\').join('/')}`),
);

test('route exists', () => {
  assert.equal(matchRoute('/experience', today), true);
  assert.equal(matchRoute('/', today), true);
  assert.equal(matchRoute('/experience#education-heading', today), true);
});

test('a page that is not built yet does not exist', () => {
  const routes = pageRoutes(['../pages/index.astro', '../pages/experience.astro']);
  assert.equal(matchRoute('/about#resume', routes), false);
  assert.equal(matchRoute('/research', routes), false);
});

test('an external URL throws', () => {
  for (const href of ['https://github.com/ashleylibasci', '//example.com/experience', 'mailto:a@example.com', 'experience']) {
    assert.throws(() => matchRoute(href, today), /not an in-site path/, href);
  }
});

test('file paths map to route paths', () => {
  const routes = pageRoutes([
    '../pages/index.astro',
    '../pages/about.astro',
    '../pages/notes/index.astro',
    '../pages/notes/[slug].astro',
    '../pages/_draft.astro',
    '../pages/data.json.ts',
  ]);
  assert.deepEqual([...routes].sort(), ['/', '/about', '/notes']);
  assert.equal(matchRoute('/about#resume', routes), true);
  assert.equal(matchRoute('/about/?x=1', routes), true);
  assert.equal(matchRoute('/abou', routes), false);
});
