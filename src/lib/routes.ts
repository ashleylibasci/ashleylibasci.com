// An in-site link renders only when its page exists in src/pages/. Only the file
// names are read; the lazy loaders this glob returns are never called.
import { matchRoute, pageRoutes } from './route-match';

const ROUTES = pageRoutes(Object.keys(import.meta.glob('../pages/**/*.astro')));

/** True when `href` ("/experience", "/about#resume") is a page of this site. Throws on an external URL. */
export function routeExists(href: string): boolean {
  return matchRoute(href, ROUTES);
}
