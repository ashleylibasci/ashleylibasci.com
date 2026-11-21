#!/usr/bin/env node
// @ts-check
// Internal link gate: every href, src, srcset and poster in dist/**/*.html that points at
// this site must resolve to a dist/ file (AD-15 URL mapping), an id/name for its fragment,
// or a 301/302 rule in redirects.json. External links are never fetched.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { decodeEntities } from '../guard/extract.mjs';
import { APEX, OWN_HOSTS, distFileUrls, listDist, matchesSource, readRedirects, sourcePath, urlToDistFile } from '../lib/urls.mjs';

const { values } = parseArgs({ options: { root: { type: 'string', default: process.cwd() } } });
const root = resolve(values.root);

/** @type {string[]} */
const findings = [];

const TAG = /<[a-zA-Z](?:"[^"]*"|'[^']*'|[^'">])*>/g;
// One attribute at a time, name and value together, so text inside a quoted value is never read as an attribute.
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'poster']);

/** HTML without comments and without script/style bodies (their opening tags stay). @param {string} raw */
function stripHtml(raw) {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');
}

/** URLs in a srcset value: the first token of each comma-separated candidate. @param {string} value */
function srcsetUrls(value) {
  /** @type {string[]} */
  const urls = [];
  let rest = value.trim();
  while (rest) {
    const url = /^\S+/.exec(rest)?.[0] ?? '';
    const trailingComma = url.endsWith(',');
    urls.push(url.replace(/,+$/, ''));
    rest = rest.slice(url.length);
    if (!trailingComma) {
      const comma = rest.indexOf(',');
      rest = comma === -1 ? '' : rest.slice(comma + 1);
    }
    rest = rest.trim();
  }
  return urls.filter(Boolean);
}

/** @param {string} html */
function pageRefs(html) {
  /** @type {string[]} */
  const refs = [];
  /** @type {Set<string>} */
  const ids = new Set();
  for (const [tag] of html.matchAll(TAG)) {
    const attrs = tag.slice(1, -1).replace(/^[^\s\/>]+/, '');
    for (const m of attrs.matchAll(ATTR)) {
      const name = m[1].toLowerCase();
      const value = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
      if (name === 'srcset') refs.push(...srcsetUrls(value));
      else if (URL_ATTRS.has(name)) refs.push(value.trim());
      else if (name === 'id' || name === 'name') ids.add(value);
    }
  }
  return { refs, ids };
}

/** @param {string} s */
function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

const files = listDist(root);
if (!files) {
  findings.push('dist/: missing (run npm run build first)');
} else {
  const fileSet = new Set(files);
  /** @type {{ source: string }[]} */
  let rules = [];
  try {
    const parsed = readRedirects(root);
    if (Array.isArray(parsed)) rules = parsed.filter((r) => r && typeof r.source === 'string' && ['301', '302'].includes(String(r.status)));
  } catch {
    // An unreadable redirects.json is reported by the redirect gate.
  }
  const viaRedirect = (/** @type {string} */ pathname) =>
    rules.some((r) => {
      const path = sourcePath(r.source);
      return path !== null && matchesSource(pathname, path);
    });

  const pages = files.filter((f) => /\.html$/i.test(f));
  /** @type {Map<string, { refs: string[], ids: Set<string> }>} */
  const parsed = new Map(pages.map((f) => [f, pageRefs(stripHtml(readFileSync(join(root, 'dist', f), 'utf8')))]));

  for (const [page, { refs }] of parsed) {
    const base = `https://${APEX}${distFileUrls(page)[0]}`;
    const report = (/** @type {string} */ what, /** @type {string} */ ref) => findings.push(`dist/${page}: ${what} ${ref}`);
    for (const ref of refs) {
      if (!ref || ref.startsWith('//')) continue;
      const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(ref)?.[1]?.toLowerCase();
      if (scheme && scheme !== 'http' && scheme !== 'https') continue;
      let url;
      try {
        url = new URL(ref, base);
      } catch {
        report('malformed link', ref);
        continue;
      }
      if (!OWN_HOSTS.has(url.hostname.toLowerCase())) continue;
      const pathname = decode(url.pathname);
      const fragment = url.hash ? decode(url.hash.slice(1)) : '';
      if (pathname === null || fragment === null) {
        report('malformed link', ref);
        continue;
      }
      const target = urlToDistFile(pathname);
      if (target === null) {
        report('trailing slash', ref);
        continue;
      }
      if (!fileSet.has(target)) {
        if (!viaRedirect(pathname)) report('broken link', ref);
        continue;
      }
      if (fragment && /\.html$/i.test(target) && !parsed.get(target)?.ids.has(fragment)) report('missing fragment', ref);
    }
  }
}

for (const line of findings) console.log(line);
console.log(`links: ${findings.length} findings`);
process.exitCode = findings.length ? 1 : 0;
