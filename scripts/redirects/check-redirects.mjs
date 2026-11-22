#!/usr/bin/env node
// @ts-check
// Redirect gate: redirects.json (Amplify custom-rules array) must be well-formed, keep
// 404 rules last (AD-16), have no `/<*>` 200 catch-all rewrite, have no path on a domain
// source (Amplify ignores `https://host/path` sources and appends the path itself), and
// never shadow a dist/ file with a 200/301/302 rule. 404 rules are not collision-checked:
// Amplify applies them only when no file matches.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { distFileUrls, listDist, matchesSource, readRedirects, sourcePath, urlToDistFile } from '../lib/urls.mjs';

const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() } } });
const root = resolve(values.root);

const STATUSES = new Set(['200', '301', '302', '404', '404-200']);
const is404 = (/** @type {string} */ status) => status === '404' || status === '404-200';

/** @type {string[]} */
const findings = [];
const report = (/** @type {string} */ what) => findings.push(`redirects.json: ${what}`);

/** @type {unknown} */
let rules;
try {
  rules = readRedirects(root);
} catch (err) {
  const code = /** @type {{ code?: string }} */ (err).code;
  report(code === 'ENOENT' ? 'missing' : 'not valid JSON');
}

if (rules !== undefined && !Array.isArray(rules)) report('must be a JSON array of rules');

/** @type {{ n: number, source: string, status: string }[]} */
const valid = [];
if (Array.isArray(rules)) {
  rules.forEach((rule, i) => {
    const n = i + 1;
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return report(`rule ${n} is not an object`);
    const { source, target, status, condition } = rule;
    const bad = [];
    if (typeof source !== 'string' || !/^(\/|https?:\/\/[^/]+)/i.test(source)) bad.push('source');
    if (typeof target !== 'string' || !target) bad.push('target');
    if ((typeof status !== 'string' && typeof status !== 'number') || !STATUSES.has(String(status))) bad.push('status');
    if (condition !== undefined && condition !== null && typeof condition !== 'string') bad.push('condition');
    if (bad.length) return report(`rule ${n} has a missing or invalid ${bad.join(', ')}`);
    if (/^https?:\/\/[^/]+\//i.test(source)) report(`rule ${n} (${source}) has a path on a domain source; Amplify ignores it`);
    valid.push({ n, source, status: String(status) });
  });
}

// AD-16: 404 rules come last.
const lastNon404 = valid.findLast((r) => !is404(r.status));
for (const r of valid) {
  if (lastNon404 && is404(r.status) && r.n < lastNon404.n) report(`rule ${r.n} (${r.source}) is a 404 rule before rule ${lastNon404.n}; 404 rules must be last`);
}

const files = listDist(root);
if (!files) findings.push('dist/: missing (run npm run build first)');

for (const r of valid) {
  if (is404(r.status)) continue;
  const path = sourcePath(r.source);
  if (path === null) continue; // another host: cannot shadow an apex file
  if (path === '/<*>' && r.status === '200') {
    report(`rule ${r.n} (${r.source}) is a /<*> 200 catch-all rewrite`);
    continue;
  }
  if (!files) continue;
  const wildcard = path.indexOf('<*>');
  const patterned = /<[^<>/]+>/.test(path);
  const shadowed = files.filter((f) => {
    if (!patterned) return urlToDistFile(path) === f;
    const prefix = wildcard === -1 ? null : path.slice(0, wildcard);
    return distFileUrls(f).some((url) => matchesSource(url, path) || (prefix !== null && url.startsWith(prefix)));
  });
  for (const f of shadowed) report(`rule ${r.n} (${r.source}) shadows dist/${f}`);
}

for (const line of findings) console.log(line);
console.log(`redirects: ${findings.length} findings`);
process.exitCode = findings.length ? 1 : 0;
