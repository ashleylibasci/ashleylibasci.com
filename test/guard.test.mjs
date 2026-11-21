// Privacy guard tests. Every failing input uses harmless test words hashed with a test key
// (test/fixtures/test-hashes.json); the real block list is never used here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makePdf } from './helpers/minimal-pdf.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const GUARD = join(here, '..', 'scripts', 'guard', 'guard.mjs');
const HASHES = join(here, 'fixtures', 'test-hashes.json');
const TEST_KEY = 'guard-test-key-not-a-secret';

/** Write files into a fresh temp dir (no .git, so the guard walks it) and run the guard. */
function run(files, { key = TEST_KEY } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      if (body instanceof Buffer || body instanceof Uint8Array) writeFileSync(join(root, name), body);
      else if (body && body.copy) copyFileSync(body.copy, join(root, name));
      else writeFileSync(join(root, name), body);
    }
    const env = { ...process.env };
    delete env.GUARD_KEY;
    if (key !== null) env.GUARD_KEY = key;
    const r = spawnSync(process.execPath, [GUARD, '--root', root, '--hashes', HASHES], { env, encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('clean tree passes', () => {
  const r = run({ 'src/a.astro': '<p>Plain words only.</p>\n', 'dist/index.html': '<h1>Ashley Libasci</h1>' });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /guard: 0 findings/);
});

test('word hit reports file, line and id only', () => {
  const r = run({ 'notes.txt': 'one\ntwo\nthe Zebraword\'s tail\n' });
  assert.equal(r.code, 1);
  assert.match(r.out, /notes\.txt:3 blocked term #1/);
  assert.doesNotMatch(r.out, /zebraword/i);
});

test('no match inside a longer word', () => {
  const r = run({ 'a.txt': 'zebrawordy xzebraword zebraworded\n' });
  assert.equal(r.code, 0, r.out);
});

test('plurals with s or es are caught', () => {
  for (const text of ['zebrawords', 'zebrawordes', 'quartz lanterns']) {
    const r = run({ 'a.txt': text });
    assert.equal(r.code, 1, text);
  }
});

test('phrases match across lines, hyphens and camelCase', () => {
  for (const text of ['x\nquartz\n  lantern', 'quartz-lantern', 'const quartzLantern = 1', 'QUARTZ LANTERN']) {
    const r = run({ 'a.txt': text });
    assert.equal(r.code, 1, text);
    assert.match(r.out, /blocked term #2/);
  }
  const first = run({ 'a.txt': 'x\nquartz\nlantern' });
  assert.match(first.out, /a\.txt:2 blocked term #2/);
  assert.equal(run({ 'a.txt': 'quartz and lantern' }).code, 0);
});

test('Unicode is NFKC-normalized', () => {
  assert.equal(run({ 'a.txt': 'ＺＥＢＲＡＷＯＲＤ' }).code, 1);
});

test('HTML entities are decoded before matching', () => {
  assert.equal(run({ 'a.astro': '<p>&#122;ebraword</p>' }).code, 1);
});

test('phone number in all three forms, digits never printed', () => {
  for (const text of ['call 312-555-0123', 'call (312) 555-0123', 'id 3125550123']) {
    const r = run({ 'a.txt': text });
    assert.equal(r.code, 1, text);
    assert.match(r.out, /a\.txt:1 phone #1/);
    assert.doesNotMatch(r.out, /555/);
  }
  assert.equal(run({ 'a.txt': '312-555-0124 and 13125550123999' }).code, 0);
});

test('pronouns in Markdown prose and built HTML text fail', () => {
  assert.match(run({ 'README.md': '# Title\n\nHe built it.\n' }).out, /README\.md:3 pronoun "he"/);
  assert.equal(run({ 'dist/a.html': '<p>About her work</p>' }).code, 1);
  assert.equal(run({ 'dist/a.html': '<img src="x.png" alt="his photo">' }).code, 1);
});

test('pronouns in code are ignored', () => {
  const md = 'Text.\n\n```js\nconst he = 1;\n```\n\nUse `his` here.\n';
  assert.equal(run({ 'README.md': md, 'src/x.ts': 'const he = her + his;\n' }).code, 0);
  assert.equal(run({ 'dist/a.html': '<p>ok</p><code>her</code><pre>she</pre><script>let him</script>' }).code, 0);
  assert.equal(run({ 'dist/a.html': '<p class="his-x">the theme</p>' }).code, 0);
});

test('committed fixture PDF text is extracted and checked', () => {
  const r = run({ 'public/resume.pdf': { copy: join(here, 'fixtures', 'guard-sample.pdf') } });
  assert.equal(r.code, 1);
  assert.match(r.out, /public\/resume\.pdf page 1 blocked term #1/);
});

test('generated PDFs: phone fails, clean passes, broken is a finding', () => {
  assert.match(run({ 'dist/r.pdf': makePdf(['Contact (312) 555-0123']) }).out, /dist\/r\.pdf page 1 phone #1/);
  assert.equal(run({ 'dist/r.pdf': makePdf(['Clean resume text']) }).code, 0);
  assert.match(run({ 'dist/r.pdf': Buffer.from('%PDF-1.4 broken') }).out, /pdf unreadable/);
});

test('binary files are skipped', () => {
  assert.equal(run({ 'public/f.woff2': Buffer.from([0, 1, 2, ...Buffer.from('zebraword')]) }).code, 0);
});

test('missing GUARD_KEY fails closed without a key in output', () => {
  const r = run({ 'a.txt': 'fine' }, { key: null });
  assert.equal(r.code, 1);
  assert.match(r.out, /GUARD_KEY is not set/);
});

test('invisible characters do not split a word', () => {
  assert.equal(run({ 'a.txt': 'zebra\u00ADword' }).code, 1);
  assert.equal(run({ 'a.txt': 'zebra\u200Bword' }).code, 1);
});

test('pronoun lines stay correct after a multi-line attribute', () => {
  const html = '<p>a</p>\n<img alt="x\ny\nz">\n<p>ok</p>\n<p>He</p>\n';
  assert.match(run({ 'dist/a.html': html }).out, /dist\/a\.html:6 pronoun "he"/);
});

test('data attributes, non-meta content, Markdown code tags and URLs are not prose', () => {
  assert.equal(run({ 'dist/a.html': '<div data-title="his thing" content="her">ok</div>' }).code, 0);
  assert.equal(run({ 'dist/a.html': '<meta name="description" content="about her">' }).code, 1);
  assert.equal(run({ 'README.md': 'See <code>her</code> and [link](https://x.com/his-page)\n' }).code, 0);
});

test('a malformed hash file fails closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-bad-'));
  try {
    const bad = join(root, 'bad.json');
    writeFileSync(bad, JSON.stringify({ algorithm: 'hmac-sha256', terms: [{ id: 1, hmac: 'a'.repeat(64) }] }));
    const r = spawnSync(process.execPath, [GUARD, '--root', root, '--hashes', bad], {
      env: { ...process.env, GUARD_KEY: TEST_KEY },
      encoding: 'utf8',
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /valid id, words or hmac/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a different key does not match', () => {
  assert.equal(run({ 'a.txt': 'zebraword' }, { key: 'another-key' }).code, 0);
});
