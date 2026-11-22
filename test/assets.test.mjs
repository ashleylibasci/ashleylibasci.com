// Image originals live in src/assets/ and reach pages through astro:assets;
// public/ never holds a raster image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RASTER = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tif', '.tiff', '.heic']);

/** Raster image files under a folder, as paths relative to it; none when the folder is absent. */
function rastersIn(/** @type {string} */ dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((file) => String(file).split('\\').join('/'))
    .filter((file) => RASTER.has(extname(file).toLowerCase()))
    .sort();
}

// The social card is the one exception (AD-10): link previews need its fixed, unhashed address.
const PUBLIC_RASTERS = new Set(['public/social-card.png']);

test('public/ holds no raster image but the social card', () => {
  const found = rastersIn(join(root, 'public')).map((file) => `public/${file}`).filter((file) => !PUBLIC_RASTERS.has(file));
  assert.deepEqual(found, [], `move to src/assets/ and serve through astro:assets: ${found.join(', ')}`);
});

test('a raster image in a folder is found and named', () => {
  const dir = mkdtempSync(join(tmpdir(), 'assets-test-'));
  try {
    assert.deepEqual(rastersIn(join(dir, 'absent')), []);
    mkdirSync(join(dir, 'img'));
    writeFileSync(join(dir, 'x.jpg'), '');
    writeFileSync(join(dir, 'img', 'y.PNG'), '');
    writeFileSync(join(dir, 'robots.txt'), '');
    assert.deepEqual(rastersIn(dir), ['img/y.PNG', 'x.jpg']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the seven originals are in src/assets/', () => {
  const originals = [
    'careerstar-og.png',
    'careerstar-rate.png',
    'headshot-full.jpg',
    'healthdash-fitness.jpg',
    'healthdash-icon.png',
    'healthdash-sleep.jpg',
    'proof-of-history.png',
  ];
  const present = new Set(rastersIn(join(root, 'src', 'assets')));
  const missing = originals.filter((file) => !present.has(file));
  assert.deepEqual(missing, [], `missing from src/assets/: ${missing.join(', ')}`);
});
