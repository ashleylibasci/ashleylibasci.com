// Image loading attributes: the two loading rows of the story's edge-case matrix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadingAttrs } from '../src/lib/image-loading.ts';

test('default loading is lazy and async', () => {
  assert.deepEqual(loadingAttrs(), { loading: 'lazy', decoding: 'async' });
  assert.deepEqual(loadingAttrs(false), { loading: 'lazy', decoding: 'async' });
  assert.equal('fetchpriority' in loadingAttrs(), false);
});

test('above the fold is eager with high priority', () => {
  const attrs = loadingAttrs(true);
  assert.equal(attrs.loading, 'eager');
  assert.equal(attrs.fetchpriority, 'high');
  assert.notEqual(attrs.loading, 'lazy');
});
