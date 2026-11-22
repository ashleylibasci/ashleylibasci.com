// The canonical URL of a page (AD-15): always the apex, pretty path, no `.html`.
// Pure and type-erasable: the tests import this file directly.

export const CANONICAL_ORIGIN = 'https://ashleylibasci.com';

/** The canonical URL for a page pathname, or null for the 404 page. */
export function canonicalUrl(pathname: string): string | null {
  let path = pathname.endsWith('.html') ? pathname.slice(0, -'.html'.length) : pathname;
  if (path === '/index' || path === '') path = '/';
  if (path === '/404') return null;
  return CANONICAL_ORIGIN + path;
}
