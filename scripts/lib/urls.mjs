// @ts-check
// URL helpers shared by the link and redirect gates.
// URL mapping follows AD-15 (`build.format: 'file'`, `trailingSlash: 'never'`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const APEX = 'ashleylibasci.com';
export const OWN_HOSTS = new Set([APEX, `www.${APEX}`]);

/**
 * The dist/ file (POSIX path relative to dist/) a URL pathname is served from,
 * or null when the path has a trailing slash (other than `/`).
 * `/` -> index.html, `/work` -> work.html, `/_astro/x.css` -> _astro/x.css.
 * @param {string} pathname decoded pathname starting with `/`
 * @returns {string | null}
 */
export function urlToDistFile(pathname) {
  if (pathname === '/') return 'index.html';
  if (pathname.endsWith('/')) return null;
  const rel = pathname.replace(/^\/+/, '');
  const last = rel.slice(rel.lastIndexOf('/') + 1);
  return last.includes('.') ? rel : `${rel}.html`;
}

/**
 * URL pathnames a dist/ file answers to: its pretty URL and, for HTML pages, the raw file path.
 * @param {string} file POSIX path relative to dist/
 * @returns {string[]}
 */
export function distFileUrls(file) {
  const raw = `/${file}`;
  if (file === 'index.html') return ['/', raw];
  if (file.endsWith('.html')) return [raw.slice(0, -'.html'.length), raw];
  return [raw];
}

/** @param {string} s */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a pathname matches an Amplify rule source: `<*>` matches anything,
 * `<name>` one path segment. Anchored at both ends, so `/career/<*>` does not match `/career`.
 * @param {string} pathname
 * @param {string} source
 */
export function matchesSource(pathname, source) {
  const pattern = source
    .split(/(<\*>|<[^<>/]+>)/)
    .map((part) => (part === '<*>' ? '.*' : /^<[^<>/]+>$/.test(part) ? '[^/]+' : escapeRegex(part)))
    .join('');
  return new RegExp(`^${pattern}$`).test(pathname);
}

/**
 * The apex-relative path of a rule source, or null when it is on another host.
 * @param {string} source
 */
export function sourcePath(source) {
  if (source.startsWith('/')) return source;
  const m = /^https?:\/\/([^/]+)(\/.*)?$/i.exec(source);
  if (m && m[1].toLowerCase() === APEX) return m[2] || '/';
  return null;
}

/**
 * Every file under dist/ as POSIX paths relative to dist/, or null when dist/ is missing.
 * @param {string} root
 * @returns {string[] | null}
 */
export function listDist(root) {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return null;
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(dist, full).split(sep).join('/'));
    }
  };
  walk(dist);
  return out.sort();
}

/**
 * The redirects.json rules, parsed but not validated; throws on unreadable or invalid JSON.
 * @param {string} root
 * @returns {unknown}
 */
export function readRedirects(root) {
  return JSON.parse(readFileSync(join(root, 'redirects.json'), 'utf8'));
}
