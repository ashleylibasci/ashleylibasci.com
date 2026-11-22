// Link previews: the base layout names the one 1200x630 social card and the site description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = readFileSync(join(root, 'src', 'layouts', 'Base.astro'), 'utf8');

test('the social card is a 1200x630 PNG in public/', () => {
  const png = readFileSync(join(root, 'public', 'social-card.png'));
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('the base layout sets description, Open Graph and large-card tags once each', () => {
  assert.match(base, /const SOCIAL_CARD = new URL\('\/social-card\.png', Astro\.site\)\.href;/);
  for (const tag of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:image:alt"', 'name="twitter:card"']) {
    assert.equal(base.split(tag).length - 1, 1, tag);
  }
  assert.match(base, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(base, /<meta property="og:image:height" content="630" \/>/);
  assert.match(base, /<meta name="twitter:card" content="summary_large_image" \/>/);
  // og:url follows the canonical, so the Lost page (no canonical) has none.
  assert.match(base, /\{canonical && <meta property="og:url" content=\{canonical\} \/>\}/);
});
