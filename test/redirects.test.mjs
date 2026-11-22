// Redirect gate tests: each case builds a throwaway root with dist/ and redirects.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK = join(here, '..', 'scripts', 'redirects', 'check-redirects.mjs');

const DIST = { 'dist/index.html': '<p>home</p>', 'dist/work.html': '<p>work</p>', 'dist/career/x.html': '<p>x</p>', 'dist/resume.pdf': 'pdf' };

/** @param {unknown} redirects raw string or value to JSON-encode; null for no file @param {Record<string, string> | null} [dist] */
function run(redirects, dist = DIST) {
  const root = mkdtempSync(join(tmpdir(), 'redirects-'));
  try {
    for (const [name, body] of Object.entries(dist ?? {})) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), body);
    }
    if (redirects !== null) writeFileSync(join(root, 'redirects.json'), typeof redirects === 'string' ? redirects : JSON.stringify(redirects));
    const r = spawnSync(process.execPath, [CHECK, '--root', root], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const rule = (/** @type {string} */ source, /** @type {string} */ status, target = '/') => ({ source, target, status });

test('empty rules pass', () => {
  const r = run('[]\n');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /redirects: 0 findings/);
});

test('non-colliding rules pass', () => {
  const r = run([rule('/old', '301', '/work'), rule('/career', '302', '/work'), rule('https://www.ashleylibasci.com', '301', 'https://ashleylibasci.com'), rule('/<*>', '404-200', '/404.html')]);
  assert.equal(r.code, 0, r.out);
});

test('a 301 source equal to a page collides', () => {
  const r = run([rule('/work', '301')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /rule 1 \(\/work\) shadows dist\/work\.html/);
});

test('200 and 302 sources collide too, including files with extensions and apex URLs', () => {
  assert.match(run([rule('/resume.pdf', '200')]).out, /shadows dist\/resume\.pdf/);
  assert.match(run([rule('/', '302')]).out, /shadows dist\/index\.html/);
  assert.match(run([rule('https://ashleylibasci.com/work', '302')]).out, /shadows dist\/work\.html/);
});

test('a wildcard prefix that covers a dist/ file collides', () => {
  const r = run([rule('/career/<*>', '301', '/work')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /rule 1 \(\/career\/<\*>\) shadows dist\/career\/x\.html/);
  assert.match(run([rule('/career/<slug>', '301', '/work')]).out, /shadows dist\/career\/x\.html/);
});

test('404 rules are not collision-checked', () => {
  assert.equal(run([rule('/work', '404')]).code, 0);
});

test('a 404 rule before a non-404 rule is a finding', () => {
  const r = run([rule('/gone', '404'), rule('/old', '301', '/work')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /rule 1 \(\/gone\) is a 404 rule before rule 2/);
});

test('a /<*> 200 catch-all rewrite is a finding', () => {
  const r = run([rule('/<*>', '200', '/index.html')]);
  assert.equal(r.code, 1);
  assert.match(r.out, /rule 1 \(\/<\*>\) is a \/<\*> 200 catch-all rewrite/);
  assert.match(r.out, /redirects: 1 findings/);
});

test('404 order and catch-all are reported together', () => {
  const r = run([rule('/gone', '404'), rule('/<*>', '200', '/index.html')]);
  assert.match(r.out, /404 rule before rule 2/);
  assert.match(r.out, /catch-all/);
  assert.match(r.out, /redirects: 2 findings/);
});

test('bad files are findings', () => {
  const cases = [
    ['not json', /not valid JSON/],
    ['{"source":"/a"}', /must be a JSON array/],
    [[{ source: '/a', status: '301' }], /rule 1 has a missing or invalid target/],
    [[rule('/a', '307')], /rule 1 has a missing or invalid status/],
    [[rule('work', '301')], /rule 1 has a missing or invalid source/],
    [[{ source: '/a', target: '/b', status: '301', condition: 5 }], /invalid condition/],
    [['x'], /rule 1 is not an object/],
    [null, /redirects\.json: missing/],
  ];
  for (const [input, pattern] of cases) {
    const r = run(input);
    assert.equal(r.code, 1, String(input));
    assert.match(r.out, pattern);
  }
});

test('missing dist/ is a finding', () => {
  const r = run([], null);
  assert.equal(r.code, 1);
  assert.match(r.out, /dist\/: missing/);
});

test('a path on a domain source is a finding', () => {
  for (const source of ['https://www.ashleylibasci.com/<*>', 'https://www.ashleylibasci.com/']) {
    const r = run([rule(source, '301', 'https://ashleylibasci.com')]);
    assert.equal(r.code, 1, source);
    assert.ok(r.out.includes(`rule 1 (${source}) has a path on a domain source; Amplify ignores it`), r.out);
  }
});

test('the real redirects.json: Career Star paths, then www, then the 404 last', () => {
  const rules = JSON.parse(readFileSync(join(here, '..', 'redirects.json'), 'utf8'));
  const CAREER_STAR = ['/architecture', '/career/<*>', '/case-study', '/explore', '/field/<*>', '/methodology', '/rate', '/sky', '/top-20', '/api/<*>', '/og.png', '/careerstar-ratings.csv', '/star-trails-duotone.jpg'];
  assert.equal(rules.length, 15);
  CAREER_STAR.forEach((source, i) => {
    assert.deepEqual(rules[i], { source, status: '301', target: `https://careerstar.ashleylibasci.com${source}`, condition: null });
  });
  assert.deepEqual(rules[13], { source: 'https://www.ashleylibasci.com', status: '301', target: 'https://ashleylibasci.com', condition: null });
  assert.deepEqual(rules[14], { source: '/<*>', status: '404', target: '/404.html', condition: null });
});
