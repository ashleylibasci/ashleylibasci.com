// One navigation config for the header tabs and the menu sheet.
// List only pages that exist; header tabs show `tab: true` items, the sheet shows all.
export const SITE_NAME = 'Ashley Libasci';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  tab: boolean;
}

export const NAV: readonly NavItem[] = [{ key: 'home', label: 'Home', href: '/', tab: false }];
