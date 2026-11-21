// Internal link gate tests: each case builds a throwaway root with dist/ and redirects.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK = join(here, '..', 'scripts', 'links', 'check-links.mjs');

/** @param {Record<string, string>} files @param {{ redirects?: unknown }} [opts] */
function run(files, { redirects = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'links-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), body);
    }
    if (redirects !== null) writeFileSync(join(root, 'redirects.json'), JSON.stringify(redirects));
    const r = spawnSync(process.execPath, [CHECK, '--root', root], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const page = (/** @type {string} */ body) => `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;
const base = {
  'dist/work.html': page('<h1 id="top">Work</h1>'),
  'dist/_astro/a.css': 'body{}',
  'dist/a.png': 'png',
};

test('clean tree passes', () => {
  const r = run({
    ...base,
    'dist/index.html': page(
      '<link rel="stylesheet" href="/_astro/a.css"><a href="/">home</a><a href="/work">work</a>' +
        '<a href="#main">skip</a><main id="main"></main><a href="work#top">rel</a><a href="./work">dot</a>' +
        '<a href="https://ashleylibasci.com/work">abs</a><a href="https://www.ashleylibasci.com/">www</a>' +
        '<img src="/a.png" srcset="/a.png 1x,/a.png 2x"><a href="/work?x=1">query</a><a href="">self</a>',
    ),
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /links: 0 findings/);
});

test('broken page link names file and link', () => {
  const r = run({ ...base, 'dist/index.html': page('<a href="/nope">x</a>') });
  assert.equal(r.code, 1);
  assert.match(r.out, /dist\/index\.html: broken link \/nope/);
  assert.match(r.out, /links: 1 findings/);
});

test('trailing slash is a finding even when the page exists', () => {
  const r = run({ ...base, 'dist/index.html': page('<a href="/work/">x</a>') });
  assert.equal(r.code, 1);
  assert.match(r.out, /trailing slash \/work\//);
});

test('missing assets in src and srcset are each reported', () => {
  const r = run({
    ...base,
    'dist/index.html': page('<script type="module" src="/_astro/gone.js"></script><img srcset="/a.png 1x, /b.png 2x"><video poster="/p.jpg"></video>'),
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /broken link \/_astro\/gone\.js/);
  assert.match(r.out, /broken link \/b\.png/);
  assert.match(r.out, /broken link \/p\.jpg/);
  assert.doesNotMatch(r.out, /\/a\.png/);
  assert.match(r.out, /links: 3 findings/);
});

test('fragment must match an id or name in the target page', () => {
  const r = run({ ...base, 'dist/index.html': page('<a href="/work#x">x</a><a href="#y">y</a><a name="z"></a><a href="#z">z</a>') });
  assert.equal(r.code, 1);
  assert.match(r.out, /missing fragment \/work#x/);
  assert.match(r.out, /missing fragment #y/);
  assert.match(r.out, /links: 2 findings/);
});

test('external links and other schemes are ignored', () => {
  const r = run({
    ...base,
    'dist/index.html': page(
      '<a href="https://example.com/nope">a</a><a href="//cdn.example.com/x.js">b</a><a href="mailto:a@example.com">c</a>' +
        '<a href="tel:+10000000000">d</a><img src="data:image/png;base64,AAAA"><a href="javascript:void(0)">e</a>',
    ),
  });
  assert.equal(r.code, 0, r.out);
});

test('absolute links on the own host are checked', () => {
  const r = run({ ...base, 'dist/index.html': page('<a href="https://ashleylibasci.com/nope">x</a>') });
  assert.equal(r.code, 1);
  assert.match(r.out, /broken link https:\/\/ashleylibasci\.com\/nope/);
});

test('a link resolving through a 301/302 rule is valid, a 200 or 404 rule is not', () => {
  const html = { ...base, 'dist/index.html': page('<a href="/career/a">x</a>') };
  assert.equal(run(html, { redirects: [{ source: '/career/<*>', target: '/work', status: '301' }] }).code, 0);
  assert.equal(run(html, { redirects: [{ source: '/career/<*>', target: '/work', status: '404' }] }).code, 1);
});

test('missing dist/ is a finding', () => {
  const r = run({});
  assert.equal(r.code, 1);
  assert.match(r.out, /dist\/: missing/);
});

test('links inside comments and script bodies are ignored; entities and percent-encoding are decoded', () => {
  const r = run({
    ...base,
    'dist/my page.html': page('ok'),
    'dist/index.html': page('<!-- <a href="/nope">x</a> --><script>const s = \'<a href="/nope2">\';</script><a href="/my%20page">p</a><a href="/work?a=1&amp;b=2">q</a>'),
  });
  assert.equal(r.code, 0, r.out);
});

test('page-relative links resolve against nested pages', () => {
  const r = run({ ...base, 'dist/career/x.html': page('<a href="y">y</a><a href="../work">w</a>'), 'dist/career/y.html': page('') });
  assert.equal(r.code, 0, r.out);
  const bad = run({ ...base, 'dist/career/x.html': page('<a href="z">z</a>') });
  assert.match(bad.out, /dist\/career\/x\.html: broken link z/);
});

test('attribute-like text inside another attribute value is not read as an attribute', () => {
  const r = run({ ...base, 'dist/index.html': page('<img alt="see src=/nope" src="/a.png"><img alt="id=x" src="/a.png"><a href="#x">x</a>') });
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.out, /\/nope/);
  assert.match(r.out, /missing fragment #x/);
  assert.match(r.out, /links: 1 findings/);
});
