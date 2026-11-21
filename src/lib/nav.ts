// One navigation config for the header tabs and the menu sheet.
// List only pages that exist; header tabs show `tab: true` items, the sheet shows all.
// Resume is a section of About, not a page: no page passes its key, so it is never current.
export const SITE_NAME = 'Ashley Libasci';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  tab: boolean;
}

export const NAV: readonly NavItem[] = [
  { key: 'home', label: 'Home', href: '/', tab: false },
  { key: 'work', label: 'Work', href: '/work', tab: true },
  { key: 'research', label: 'Research', href: '/research', tab: true },
  { key: 'experience', label: 'Experience', href: '/experience', tab: true },
  { key: 'about', label: 'About', href: '/about', tab: true },
  { key: 'resume', label: 'Resume', href: '/about#resume', tab: true },
];

/** The nav item for a key; throws on a key that is not in NAV. */
export function navItem(key: string): NavItem {
  const item = NAV.find((entry) => entry.key === key);
  if (!item) throw new Error(`nav: no item "${key}"`);
  return item;
}
