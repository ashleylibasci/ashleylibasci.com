// Date and status words: one test per row of the story's edge-case matrix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, formatRange, formatSeason, formatSince, formatYear, statusWords } from '../src/lib/format.ts';

const d = (/** @type {string} */ iso) => new Date(iso);

test('range in one year', () => {
  assert.equal(formatRange(d('2026-06-01'), d('2026-08-01')), 'June to August 2026');
});

test('range across two years', () => {
  assert.equal(formatRange(d('2025-08-01'), d('2028-05-01')), 'August 2025 to May 2028');
});

test('ongoing range', () => {
  assert.equal(formatRange(d('2026-05-01')), 'May 2026 to now');
});

test('one month', () => {
  assert.equal(formatRange(d('2025-08-01'), d('2025-08-01')), 'August 2025');
  assert.equal(formatRange(d('2025-08-01'), d('2025-08-31')), 'August 2025');
});

test('year left out', () => {
  assert.equal(formatRange(d('2026-06-01'), d('2026-08-01'), { year: false }), 'June to August');
  assert.equal(formatRange(d('2026-05-01'), undefined, { year: false }), 'May to now');
  assert.equal(formatRange(d('2025-08-01'), d('2025-08-01'), { year: false }), 'August');
});

test('no dates', () => {
  assert.equal(formatRange(), 'Now');
  assert.equal(formatRange(undefined, undefined, { year: false }), 'Now');
  assert.throws(() => formatRange(undefined, d('2026-08-01')), /needs a start/);
});

test('since', () => {
  assert.equal(formatSince(d('2026-05-01')), 'since May 2026');
  assert.throws(() => formatSince(), /needs a start/);
});

test('season', () => {
  assert.equal(formatSeason(d('2026-06-01'), d('2026-08-01')), 'summer 2026');
  assert.throws(() => formatSeason(d('2025-08-01'), d('2025-12-01')), /fits no season/);
  assert.throws(() => formatSeason(d('2025-06-01'), d('2026-08-01')), /fits no season/);
  assert.throws(() => formatSeason(d('2026-06-01')), /needs a start and an end/);
});

test('template', () => {
  assert.equal(fillTemplate('{since} · live app', { start: d('2026-05-01') }), 'Since May 2026 · live app');
  assert.equal(fillTemplate('Research · {since}', { start: d('2026-08-01') }), 'Research · since August 2026');
  assert.equal(
    fillTemplate('{range} · {status} · {stack}', {
      start: d('2026-05-01'),
      status: 'live',
      stack: ['Next.js', 'TypeScript', 'AWS Amplify'],
    }),
    'May 2026 to now · live · Next.js, TypeScript, AWS Amplify',
  );
  assert.equal(fillTemplate('{status} · {stack}', { status: 'building', stack: ['Swift'] }), 'Building now · Swift');
  assert.equal(
    fillTemplate('Intern, {season}', { start: d('2026-06-01'), end: d('2026-08-01') }),
    'Intern, summer 2026',
  );
  assert.equal(fillTemplate('iPhone app, {status}', { status: 'live' }), 'iPhone app, live');
  assert.equal(fillTemplate('Personal project, {status}', { status: 'live' }), 'Personal project, live');
  assert.throws(() => fillTemplate('{stack}', { stack: [] }), /needs a stack/);
  assert.throws(() => fillTemplate('{when}', { start: d('2026-05-01') }), /unknown token \{when\}/);
  assert.throws(() => fillTemplate('{status}'), /needs a status/);
  assert.throws(() => fillTemplate('{since}'), /needs a start/);
});

test('status words and year', () => {
  assert.equal(statusWords('building'), 'building now');
  assert.equal(statusWords('live'), 'live');
  assert.equal(statusWords('ongoing'), 'ongoing');
  assert.equal(statusWords('finished'), 'finished');
  assert.equal(formatYear(d('2023-06-01')), '2023');
});

test('months are read in UTC', () => {
  assert.equal(formatRange(d('2026-06-01T00:00:00Z'), d('2026-08-01T00:00:00Z')), 'June to August 2026');
});
