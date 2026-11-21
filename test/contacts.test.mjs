// The contact addresses: written once, three of them, and never a phone number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTACTS } from '../src/lib/contacts.ts';

test('contacts are email, github and linkedin, nothing else', () => {
  assert.deepEqual(Object.keys(CONTACTS).sort(), ['email', 'github', 'linkedin']);
});

test('the email is a plain address', () => {
  assert.match(CONTACTS.email, /^[^\s@]+@[^\s@]+\.[a-z]+$/);
});

test('the profile addresses are https', () => {
  assert.equal(new URL(CONTACTS.github).protocol, 'https:');
  assert.equal(new URL(CONTACTS.github).hostname, 'github.com');
  assert.equal(new URL(CONTACTS.linkedin).protocol, 'https:');
  assert.equal(new URL(CONTACTS.linkedin).hostname, 'www.linkedin.com');
});

test('no value holds a run of digits that could be a phone number', () => {
  for (const [key, value] of Object.entries(CONTACTS)) {
    assert.doesNotMatch(value, /\d[\d\s().+-]{5,}\d/, key);
    assert.doesNotMatch(value, /^tel:/i, key);
  }
});
