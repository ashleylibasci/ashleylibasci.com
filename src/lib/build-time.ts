// Build-time date constants (AD-4): one Date, read once when the site is built.
const BUILT_AT = new Date();
const ZONE = 'America/Chicago';

export const COPYRIGHT_YEAR = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric' }).format(BUILT_AT);

/** "November 2026" style. */
export const UPDATED_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, month: 'long', year: 'numeric' }).format(
  BUILT_AT,
);
