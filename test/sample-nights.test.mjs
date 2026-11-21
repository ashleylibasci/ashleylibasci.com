// The seeded sample nights behind Figure 1: the same values on every call, and an exam week.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAM_WEEK, NIGHTS, inExamWeek, sampleNights } from '../src/lib/sample-nights.ts';

const nights = sampleNights();
const sleep = nights.map((night) => night.sleep);
const hrv = nights.map((night) => night.hrv);
const mean = (/** @type {number[]} */ values) => values.reduce((sum, value) => sum + value, 0) / values.length;

test('28 pairs, the same on every call', () => {
  assert.equal(NIGHTS, 28);
  assert.equal(nights.length, 28);
  assert.deepEqual(sampleNights(), nights);
  assert.notEqual(sampleNights(), nights);
});

test('the first values and the ranges', () => {
  assert.deepEqual(sleep.slice(0, 3), [6.8, 7, 7.4]);
  assert.deepEqual(hrv.slice(0, 3), [53, 48, 54]);
  assert.deepEqual([Math.min(...sleep), Math.max(...sleep)], [5.9, 8.2]);
  assert.deepEqual([Math.min(...hrv), Math.max(...hrv)], [41, 61]);
});

test('sleep has one decimal at most and HRV is whole', () => {
  assert.ok(sleep.every((hours) => Math.round(hours * 10) / 10 === hours));
  assert.ok(hrv.every(Number.isInteger));
});

test('the exam week is nights 17 to 21: less sleep and lower HRV than the other nights', () => {
  assert.deepEqual(EXAM_WEEK, { first: 17, last: 21 });
  const numbers = nights.map((_, index) => index + 1);
  assert.deepEqual(numbers.filter(inExamWeek), [17, 18, 19, 20, 21]);
  const exam = nights.filter((_, index) => inExamWeek(index + 1));
  const other = nights.filter((_, index) => !inExamWeek(index + 1));
  assert.ok(mean(exam.map((night) => night.sleep)) < mean(other.map((night) => night.sleep)));
  assert.ok(mean(exam.map((night) => night.hrv)) < mean(other.map((night) => night.hrv)));
});
