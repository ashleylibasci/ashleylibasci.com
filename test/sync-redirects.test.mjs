// sync-redirects: one test per row of the story's sync matrix, each on a throwaway root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const SYNC = join(repo, 'scripts', 'redirects', 'sync-redirects.mjs');

const RULES = [
  { source: '/old', status: '301', target: '/work', condition: null },
  { source: '/<*>', status: '404', target: '/404.html', condition: null },
];

/**
 * @param {unknown} redirects raw string or value to JSON-encode; null for no file
 * @param {string[]} args
 * @param {{ env?: Record<string, string>, setup?: (dir: string) => Record<string, string> }} [opts]
 */
function run(redirects, args, opts = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sync-redirects-'));
  try {
    if (redirects !== null) writeFileSync(join(root, 'redirects.json'), typeof redirects === 'string' ? redirects : JSON.stringify(redirects));
    const extraEnv = opts.setup ? opts.setup(root) : {};
    const env = { PATH: join(root, 'empty-bin'), ...opts.env, ...extraEnv };
    const r = spawnSync(process.execPath, [SYNC, '--root', root, ...args], { encoding: 'utf8', env });
    const argvFile = join(root, 'argv.json');
    let argv = null;
    try {
      argv = JSON.parse(readFileSync(argvFile, 'utf8'));
    } catch {}
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, argv };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A fake `aws` on a PATH of its own that records its argv. @param {string} root */
function fakeAws(root) {
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const aws = join(bin, 'aws');
  writeFileSync(aws, `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(join(root, 'argv.json'))}, JSON.stringify(process.argv.slice(2)));\nprocess.exit(3);\n`);
  chmodSync(aws, 0o755);
  return { PATH: bin };
}

const normalized = (/** @type {unknown} */ rules) => JSON.stringify(rules, null, 2) + '\n';

test('dry run prints exactly the normalized rules', () => {
  const r = run(RULES, ['--dry-run']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, normalized(RULES));
});

test('normalize: numeric status becomes a string, missing condition becomes null, keys in order', () => {
  const r = run([{ target: '/work', status: 301, source: '/old' }], ['--dry-run']);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, normalized([{ source: '/old', status: '301', target: '/work', condition: null }]));
});

test('bad files exit 1 with a message on stderr and no aws call', () => {
  const cases = [
    [null, /missing/],
    ['not json', /not valid JSON/],
    ['{"source":"/a"}', /JSON array/],
    [[{ target: '/b', status: '301' }], /rule 1 has a missing or invalid source/],
    [[{ source: '/a', status: '301' }], /rule 1 has a missing or invalid target/],
    [[{ source: '/a', target: '/b' }], /rule 1 has a missing or invalid status/],
  ];
  for (const [input, pattern] of cases) {
    for (const args of [['--dry-run'], ['--app-id', 'app1']]) {
      const r = run(input, args, { setup: fakeAws });
      assert.equal(r.code, 1, String(input));
      assert.match(r.stderr, pattern);
      assert.equal(r.stdout, '');
      assert.equal(r.argv, null, 'no aws call');
    }
  }
});

test('no app id: exit 1 naming --app-id, AMPLIFY_APP_ID and --dry-run, no aws call', () => {
  const r = run(RULES, [], { setup: fakeAws });
  assert.equal(r.code, 1);
  for (const word of ['--app-id', 'AMPLIFY_APP_ID', '--dry-run']) assert.ok(r.stderr.includes(word), word);
  assert.equal(r.argv, null);
});

test('apply: spawns aws amplify update-app with the normalized rules and returns its exit code', () => {
  const r = run([{ source: '/old', target: '/work', status: 301 }], ['--app-id', 'app1'], { setup: fakeAws });
  assert.equal(r.code, 3, r.stderr);
  assert.deepEqual(r.argv, ['amplify', 'update-app', '--app-id', 'app1', '--custom-rules', normalized([{ source: '/old', status: '301', target: '/work', condition: null }])]);
});

test('apply: AMPLIFY_APP_ID stands in for --app-id', () => {
  const r = run(RULES, [], { setup: fakeAws, env: { AMPLIFY_APP_ID: 'app2' } });
  assert.equal(r.code, 3, r.stderr);
  assert.deepEqual(r.argv?.slice(0, 4), ['amplify', 'update-app', '--app-id', 'app2']);
});

test('no CLI: exit 1 saying the AWS CLI was not found and to paste the dry-run output', () => {
  const r = run(RULES, ['--app-id', 'app1']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /AWS CLI was not found/);
  assert.match(r.stderr, /--dry-run/);
  assert.match(r.stderr, /console/);
});

test('the real redirects.json is byte-identical to its dry-run output', () => {
  const r = spawnSync(process.execPath, [SYNC, '--dry-run', '--root', repo], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, readFileSync(join(repo, 'redirects.json'), 'utf8'));
});
