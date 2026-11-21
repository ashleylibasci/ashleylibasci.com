// Pure path matching behind routeExists (src/lib/routes.ts). Type-erasable, no Astro
// imports, so the tests import this file directly.

/** Page file paths ("../pages/experience.astro") to route paths ("/experience"). */
export function pageRoutes(files: readonly string[]): Set<string> {
  const routes = new Set<string>();
  for (const file of files) {
    const match = /(?:^|\/)pages\/(.+)\.astro$/.exec(file);
    if (!match) continue;
    const segments = match[1].split('/');
    // Dynamic and private files are not fixed addresses.
    if (segments.some((segment) => segment.startsWith('[') || segment.startsWith('_'))) continue;
    if (segments[segments.length - 1] === 'index') segments.pop();
    routes.add(`/${segments.join('/')}`);
  }
  return routes;
}

/** True when an in-site href points at a known page. Fragment and query are ignored. */
export function matchRoute(href: string, routes: ReadonlySet<string>): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) {
    throw new Error(`routes: "${href}" is not an in-site path`);
  }
  const path = href.replace(/[?#].*$/, '');
  return routes.has(path.length > 1 ? path.replace(/\/+$/, '') : path);
}
