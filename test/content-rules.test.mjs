// Rules for dated entries: an entry that names a project takes its dates and link from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datedIssues, entryFacts, entryIssues } from '../src/lib/content-rules.ts';

const d = (/** @type {string} */ iso) => new Date(iso);
const paths = (/** @type {{ path: string }[]} */ issues) => issues.map((issue) => issue.path).sort();
const experience = { needsStart: true, needsTitle: true };
const timeline = { needsStart: false, needsTitle: false };
const project = { id: 'career-star' };

test('an entry with a project takes its dates and link target from the project', () => {
  const facts = entryFacts({}, { start: d('2026-05-01'), end: undefined, href: '/career-star' });
  assert.deepEqual(facts, { start: d('2026-05-01'), end: undefined, href: '/career-star' });
  assert.deepEqual(entryFacts({ start: d('2024-06-01'), end: d('2024-07-01') }), {
    start: d('2024-06-01'),
    end: d('2024-07-01'),
  });
});

test('own dates plus a project fails', () => {
  assert.deepEqual(paths(entryIssues({ title: 'A', project, start: d('2026-05-01') }, experience)), ['project']);
  assert.deepEqual(paths(entryIssues({ title: 'A', project, start: d('2026-05-01') }, timeline)), ['project']);
  assert.deepEqual(entryIssues({ title: 'A', project, linkLabel: 'The case study' }, experience), []);
});

test('an experience entry needs a title, and a start or a project', () => {
  assert.deepEqual(entryIssues({ title: 'A', start: d('2026-11-01') }, experience), []);
  assert.deepEqual(paths(entryIssues({ title: 'A' }, experience)), ['start']);
  assert.deepEqual(paths(entryIssues({ project }, experience)), ['title']);
});

test('a timeline entry may have no dates, and may leave its title to a project', () => {
  assert.deepEqual(entryIssues({ title: 'A' }, timeline), []);
  assert.deepEqual(entryIssues({ project }, timeline), []);
  assert.deepEqual(paths(entryIssues({}, timeline)), ['title']);
});

test('a link label needs a project', () => {
  assert.deepEqual(paths(entryIssues({ title: 'A', start: d('2026-11-01'), linkLabel: 'More' }, experience)), ['linkLabel']);
});

test('an end needs a start and cannot come first', () => {
  assert.deepEqual(paths(datedIssues({ end: d('2026-08-01') })), ['end']);
  assert.deepEqual(paths(datedIssues({ start: d('2026-08-01'), end: d('2026-06-01') })), ['end']);
  assert.deepEqual(datedIssues({ start: d('2026-06-01'), end: d('2026-08-01') }), []);
});
