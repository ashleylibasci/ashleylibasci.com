// The AL favicon: a static SVG with outlined letters, linked once from Base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');
const base = readFileSync(join(root, 'src', 'layouts', 'Base.astro'), 'utf8');

test('icon: 32 unit viewBox, misty disc with a thin teal ring', () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">/);
  const circle = svg.match(/<circle [^>]*\/>/);
  assert.ok(circle, 'one circle');
  for (const attr of ['cx="16"', 'cy="16"', 'r="14.6"', 'fill="#f3f7fa"', 'stroke="#1f8a84"', 'stroke-width="1.1"']) {
    assert.ok(circle[0].includes(attr), attr);
  }
});

test('letters: outlined paths in ink, drawn after the disc', () => {
  const path = svg.match(/<path fill="#14294a" d="M[^"]+Z"\/>/);
  assert.ok(path, 'an ink path');
  assert.ok(svg.indexOf('<path') > svg.indexOf('<circle'), 'letters on top of the disc');
});

test('self-contained and static: no text, fonts, styles, scripts or references', () => {
  for (const bad of [/<text/, /font-family/, /<style/, /<script/, /href=/, /url\(/, /<animate/, /@media/]) {
    assert.doesNotMatch(svg, bad);
  }
});

test('Base links the icon once, inside the head', () => {
  const links = base.match(/rel="icon"/g) ?? [];
  assert.equal(links.length, 1);
  const head = base.slice(base.indexOf('<head>'), base.indexOf('</head>'));
  assert.ok(head.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'));
});
