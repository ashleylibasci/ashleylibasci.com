// Word tokens and keyed hashing for the privacy guard.
import { createHmac } from 'node:crypto';

const WORD = /[\p{L}\p{N}]+/gu;
// Soft hyphen and zero-width characters, removed so they cannot split a word.
const INVISIBLE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;

/** Normalize one line: NFKC, split camelCase, lowercase. */
export function normalizeLine(line) {
  return line
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    .toLowerCase();
}

/** Split text into tokens, each with its 1-based line number. */
export function tokenize(text) {
  const tokens = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const m of normalizeLine(lines[i]).matchAll(WORD)) {
      tokens.push({ word: m[0], line: i + 1 });
    }
  }
  return tokens;
}

/** The word itself plus its forms with a trailing "s" or "es" removed. */
export function variants(word) {
  const out = [word];
  if (word.length > 2 && word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.length > 1 && word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

export function makeHasher(key) {
  const cache = new Map();
  return (s) => {
    let h = cache.get(s);
    if (h === undefined) {
      h = createHmac('sha256', key).update(s).digest('hex');
      cache.set(s, h);
    }
    return h;
  };
}

/**
 * Find blocked terms in a token list.
 * terms: Map of hash -> id; maxWords: longest term in words.
 * Returns [{ line, id }], one per line and term.
 */
export function matchTerms(tokens, terms, maxWords, hash) {
  const found = new Map();
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= maxWords && i + n <= tokens.length; n++) {
      const head = tokens.slice(i, i + n - 1).map((t) => t.word);
      for (const last of variants(tokens[i + n - 1].word)) {
        const id = terms.get(hash([...head, last].join(' ')));
        if (id !== undefined) found.set(`${tokens[i].line}:${id}`, { line: tokens[i].line, id });
      }
    }
  }
  return [...found.values()];
}

const PHONE = /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

/** Find phone numbers whose last 10 digits hash to a blocked entry. */
export function matchPhones(text, phones, hash) {
  const found = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].normalize('NFKC').matchAll(PHONE)) {
      const digits = m[0].replace(/\D/g, '').slice(-10);
      const id = phones.get(hash(digits));
      if (id !== undefined) found.push({ line: i + 1, id });
    }
  }
  return found;
}

const PRONOUN = /\b(he|she|him|her|his)\b/gi;

/** Find gendered pronouns as standalone words. */
export function matchPronouns(text) {
  const found = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].normalize('NFKC').matchAll(PRONOUN)) {
      found.push({ line: i + 1, word: m[1].toLowerCase() });
    }
  }
  return found;
}
