// The only place dates and status become words (AD-4). Pure and type-erasable:
// the tests import this file directly, so no Astro imports and no enums.
// Content dates are ISO days read as UTC; only the month and year are used.

export const STATUSES = ['building', 'live', 'ongoing', 'finished'] as const;
export type Status = (typeof STATUSES)[number];

const STATUS_WORDS: Record<Status, string> = {
  building: 'building now',
  live: 'live',
  ongoing: 'ongoing',
  finished: 'finished',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// Season by month index, December to February being winter.
const SEASONS = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'fall',
  'fall',
  'fall',
  'winter',
] as const;

function valid(date: Date, name: string): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error(`format: ${name} is not a date`);
  return date;
}

const month = (date: Date): string => MONTHS[date.getUTCMonth()];
const year = (date: Date): number => date.getUTCFullYear();

/** "building now", "live", "ongoing" or "finished". */
export function statusWords(status: Status): string {
  const words = STATUS_WORDS[status];
  if (!words) throw new Error(`format: unknown status "${status}"`);
  return words;
}

/** "2023". */
export function formatYear(date: Date): string {
  return String(year(valid(date, 'date')));
}

/**
 * "June to August 2026", "August 2025 to May 2028", "May 2026 to now", "August 2025",
 * or "Now" with no dates. `year: false` drops the year ("June to August", "May to now")
 * for lists already grouped by year; a range that crosses years keeps both years.
 */
export function formatRange(start?: Date, end?: Date, options: { year?: boolean } = {}): string {
  const withYear = options.year ?? true;
  if (!start) {
    if (end) throw new Error('format: a range with an end needs a start');
    return 'Now';
  }
  valid(start, 'start');
  const startYear = withYear ? ` ${year(start)}` : '';
  if (!end) return `${month(start)}${startYear} to now`;
  valid(end, 'end');
  if (end.getTime() < start.getTime()) throw new Error('format: a range ends before it starts');
  if (year(start) !== year(end)) return `${month(start)} ${year(start)} to ${month(end)} ${year(end)}`;
  if (start.getUTCMonth() === end.getUTCMonth()) return `${month(start)}${startYear}`;
  return `${month(start)} to ${month(end)}${startYear}`;
}

/** "since May 2026". */
export function formatSince(start?: Date): string {
  if (!start) throw new Error('format: "since" needs a start');
  valid(start, 'start');
  return `since ${month(start)} ${year(start)}`;
}

/** "summer 2026" when the start and end months sit in one season; a winter takes its end year. */
export function formatSeason(start?: Date, end?: Date): string {
  if (!start || !end) throw new Error('format: a season needs a start and an end');
  valid(start, 'start');
  valid(end, 'end');
  const season = SEASONS[start.getUTCMonth()];
  const months = (year(end) - year(start)) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (season !== SEASONS[end.getUTCMonth()] || months < 0 || months > 2) {
    throw new Error(`format: ${month(start)} to ${month(end)} fits no season`);
  }
  return `${season} ${year(end)}`;
}

/**
 * "fall 2025" for a term that starts in August or September and ends in December;
 * "spring 2026" for one that runs January to May. Any other pair of months throws.
 */
export function formatTerm(start?: Date, end?: Date): string {
  if (!start || !end) throw new Error('format: a term needs a start and an end');
  valid(start, 'start');
  valid(end, 'end');
  const from = start.getUTCMonth();
  const to = end.getUTCMonth();
  if (year(start) === year(end)) {
    if ((from === 7 || from === 8) && to === 11) return `fall ${year(end)}`;
    if (from === 0 && to === 4) return `spring ${year(end)}`;
  }
  throw new Error(`format: ${month(start)} ${year(start)} to ${month(end)} ${year(end)} fits no term`);
}

export interface TemplateFacts {
  start?: Date;
  end?: Date;
  status?: Status;
  stack?: readonly string[];
}

/** One piece of a filled template: plain words, or the words a token became. */
export interface TemplatePart {
  text: string;
  /** The token name ("status"), on a part that came from a token. */
  token?: string;
}

function fillToken(token: string, facts: TemplateFacts): string {
  switch (token) {
    case 'range':
      return formatRange(facts.start, facts.end);
    case 'since':
      return formatSince(facts.start);
    case 'season':
      return formatSeason(facts.start, facts.end);
    case 'term':
      return formatTerm(facts.start, facts.end);
    case 'status':
      if (!facts.status) throw new Error('format: {status} needs a status');
      return statusWords(facts.status);
    case 'stack':
      if (!facts.stack?.length) throw new Error('format: {stack} needs a stack');
      return facts.stack.join(', ');
    default:
      throw new Error(`format: unknown token {${token}}`);
  }
}

/**
 * A template split at its tokens, each token filled, so a page can style one part
 * (the status words) on its own. Joined, the parts are `fillTemplate`.
 */
export function templateParts(template: string, facts: TemplateFacts = {}): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(/\{([^{}]*)\}/g)) {
    if (match.index > last) parts.push({ text: template.slice(last, match.index) });
    parts.push({ text: fillToken(match[1], facts), token: match[1] });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  const first = parts[0];
  if (first && template.startsWith('{')) first.text = first.text.charAt(0).toUpperCase() + first.text.slice(1);
  return parts;
}

/**
 * Fill `{range} {since} {season} {term} {status} {stack}` in a line of content, so a date
 * or a status is written once per entry. A line that opens with a token gets a capital:
 * "{since} · live app" gives "Since May 2026 · live app".
 */
export function fillTemplate(template: string, facts: TemplateFacts = {}): string {
  return templateParts(template, facts)
    .map((part) => part.text)
    .join('');
}
