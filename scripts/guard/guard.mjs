#!/usr/bin/env node
// Privacy guard: fails when source, public/, built HTML or PDF text holds a blocked term,
// the blocked phone number, or a gendered pronoun. Blocked entries are stored only as
// HMAC-SHA-256 hashes keyed by GUARD_KEY; findings never print the matched text.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { makeHasher, matchPhones, matchPronouns, matchTerms, tokenize } from './tokens.mjs';
import { decodeEntities, htmlText, markdownText, pdfPages } from './extract.mjs';
import { distFiles, sourceFiles } from './sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.cwd() },
    hashes: { type: 'string', default: join(here, 'blocked-hashes.json') },
  },
});
const root = resolve(values.root);

const key = process.env.GUARD_KEY;
if (!key || !key.trim()) {
  console.error('guard: GUARD_KEY is not set. Locally put it in .env; on Amplify add it as an environment variable.');
  process.exit(1);
}

let list;
try {
  list = JSON.parse(readFileSync(resolve(values.hashes), 'utf8'));
} catch {
  console.error(`guard: cannot read hash file ${values.hashes}`);
  process.exit(1);
}
if (list.algorithm !== 'hmac-sha256' || !Array.isArray(list.terms) || list.terms.length === 0) {
  console.error('guard: hash file must be hmac-sha256 with at least one term');
  process.exit(1);
}
const validId = (e) => Number.isInteger(e.id) && e.id > 0 && /^[0-9a-f]{64}$/.test(e.hmac ?? '');
if (
  !list.terms.every((t) => validId(t) && Number.isInteger(t.words) && t.words > 0) ||
  !(list.phones ?? []).every(validId)
) {
  console.error('guard: hash file has an entry without a valid id, words or hmac');
  process.exit(1);
}
const terms = new Map(list.terms.map((t) => [t.hmac, t.id]));
const maxWords = Math.max(...list.terms.map((t) => t.words));
const phones = new Map((list.phones ?? []).map((p) => [p.hmac, p.id]));
const hash = makeHasher(key.trim());

const findings = [];
const report = (file, where, what) => findings.push(`${file}${where} ${what}`);

function scanText(file, text, where = (line) => `:${line}`) {
  for (const f of matchTerms(tokenize(text), terms, maxWords, hash)) report(file, where(f.line), `blocked term #${f.id}`);
  for (const f of matchPhones(text, phones, hash)) report(file, where(f.line), `phone #${f.id}`);
}

function scanPronouns(file, text) {
  for (const f of matchPronouns(text)) report(file, `:${f.line}`, `pronoun "${f.word}"`);
}

async function scanFile(file, fromDist) {
  const buf = readFileSync(join(root, file));
  if (/\.pdf$/i.test(file)) {
    let pages;
    try {
      pages = await pdfPages(buf);
    } catch {
      report(file, '', 'pdf unreadable');
      return;
    }
    pages.forEach((text, i) => scanText(file, text, () => ` page ${i + 1}`));
    return;
  }
  if (buf.subarray(0, 8000).includes(0)) return; // binary
  const raw = buf.toString('utf8');
  scanText(file, decodeEntities(raw));
  if (fromDist && /\.html?$/i.test(file)) scanPronouns(file, htmlText(raw));
  if (!fromDist && /\.mdx?$/i.test(file)) scanPronouns(file, markdownText(raw));
}

for (const file of sourceFiles(root)) await scanFile(file, false);
for (const file of distFiles(root)) await scanFile(file, true);

for (const line of findings) console.log(line);
console.log(`guard: ${findings.length} findings`);
process.exit(findings.length ? 1 : 0);
