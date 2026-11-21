// Copy email: the pure core against fake clipboards, one test per matrix row.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY_RESET_MS, COPY_STATES, copyAddress, resetScheduler } from '../src/islands/copy-email/copy-core.ts';

const ADDRESS = 'someone@example.com';
const island = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'islands', 'copy-email');

/** A fallback that counts its calls. */
function counter() {
  const fn = () => {
    fn.calls += 1;
  };
  fn.calls = 0;
  return fn;
}

test('copy works: the address reaches the clipboard and nothing is selected', async () => {
  /** @type {string[]} */
  const written = [];
  const select = counter();
  const clipboard = {
    /** @param {string} text */
    async writeText(text) {
      written.push(text);
    },
  };
  assert.equal(await copyAddress(ADDRESS, clipboard, select), 'copied');
  assert.deepEqual(written, [ADDRESS]);
  assert.equal(select.calls, 0);
});

test('clipboard missing: the address is selected', async () => {
  for (const clipboard of [undefined, null, /** @type {any} */ ({})]) {
    const select = counter();
    assert.equal(await copyAddress(ADDRESS, clipboard, select), 'selected');
    assert.equal(select.calls, 1);
  }
});

test('clipboard refuses: a rejection or a throw selects the address', async () => {
  const rejects = { writeText: () => Promise.reject(new Error('NotAllowedError')) };
  const throws = {
    writeText() {
      throw new Error('SecurityError');
    },
  };
  for (const clipboard of [rejects, throws]) {
    const select = counter();
    assert.equal(await copyAddress(ADDRESS, clipboard, select), 'selected');
    assert.equal(select.calls, 1);
  }
});

test('a fallback that throws still resolves', async () => {
  const state = await copyAddress(ADDRESS, undefined, () => {
    throw new Error('no selection');
  });
  assert.equal(state, 'selected');
});

test('labels, announcements and the reset time', () => {
  assert.deepEqual(COPY_STATES.idle, { label: 'Copy', announcement: '' });
  assert.deepEqual(COPY_STATES.copied, { label: 'Copied', announcement: 'Email address copied.' });
  assert.deepEqual(COPY_STATES.selected, {
    label: 'Selected',
    announcement: 'Copying is blocked here, so the address is selected for you to copy.',
  });
  assert.equal(COPY_RESET_MS, 2200);
});

test('the island scripts import nothing outside their own folder', () => {
  for (const file of ['copy-core.ts', 'copy-email.ts', 'CopyEmail.astro']) {
    const source = readFileSync(join(island, file), 'utf8');
    for (const match of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
    }
  }
});

test('second click before reset: one timer, reset 2.2s after the last click', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let resets = 0;
    const schedule = resetScheduler(() => {
      resets += 1;
    });
    schedule();
    mock.timers.tick(1500);
    schedule();
    mock.timers.tick(COPY_RESET_MS - 1);
    assert.equal(resets, 0);
    mock.timers.tick(1);
    assert.equal(resets, 1);
    mock.timers.tick(COPY_RESET_MS * 2);
    assert.equal(resets, 1);
  } finally {
    mock.timers.reset();
  }
});

test('no JavaScript: the address is a mail link in the markup itself', () => {
  const source = readFileSync(join(island, 'CopyEmail.astro'), 'utf8');
  assert.match(source, /<a href=\{`mailto:\$\{email\}`\}>\{email\}<\/a>/);
});

test('the Resume button is rendered only when its page exists', () => {
  const page = readFileSync(join(island, '..', '..', 'pages', 'index.astro'), 'utf8');
  assert.match(page, /const showResume = routeExists\(RESUME_HREF\);/);
  assert.match(page, /\{showResume && <a class="btn" href=\{RESUME_HREF\}>Resume<\/a>\}/);
  assert.equal([...page.matchAll(/class="btn"/g)].length, 1);
});
