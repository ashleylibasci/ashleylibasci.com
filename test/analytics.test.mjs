// Analytics (AD-11): the base layout loads the cookieless Cloudflare beacon once, at the end of
// the body, and no other third-party script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const base = readFileSync(join(src, 'layouts', 'Base.astro'), 'utf8');

/** @param {string} dir @returns {string[]} */
const files = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : [path];
});

test('the base layout loads the Cloudflare beacon once, as an inline module at the end of the body', () => {
  assert.match(base, /const ANALYTICS_TOKEN = '[0-9a-f]{32}';/);
  const tags = base.match(/<script[^>]*cloudflareinsights[^>]*><\/script>/g) ?? [];
  assert.equal(tags.length, 1);
  assert.match(tags[0], /is:inline type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/);
  assert.match(tags[0], /data-cf-beacon=\{JSON\.stringify\(\{ token: ANALYTICS_TOKEN \}\)\}/);
  assert.ok(base.indexOf('cloudflareinsights') > base.indexOf('<ConsoleHello'));
  assert.ok(base.indexOf('cloudflareinsights') < base.indexOf('</body>'));
});

test('no other source file loads a third-party script', () => {
  for (const file of files(src)) {
    if (!/\.(astro|ts|mjs|js)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [, url] of text.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)) {
      assert.equal(url, 'https://static.cloudflareinsights.com/beacon.min.js', file);
    }
  }
});
