// The home Timeline's date words and its grouping by year. Pure and type-erasable:
// the tests import this file directly, so no Astro imports and no enums.
import { formatRange } from './format.ts';

export interface TimelineDates {
  start?: Date;
  end?: Date;
}

export interface YearGroup<T> {
  year: number;
  /** The build year: drawn larger and labelled "This year". */
  current: boolean;
  entries: T[];
}

/** "June to July, remote", "August", "November to now", or "Now" with no dates. */
export function timelineWhen(start?: Date, end?: Date, whenNote?: string): string {
  const range = formatRange(start, end, { year: false });
  return whenNote ? `${range}, ${whenNote}` : range;
}

/**
 * Years ascending; inside a year by start, then end, an open end after a closed one.
 * An entry with no start is "Now": it sits last in the build year.
 */
export function groupByYear<T extends TimelineDates>(entries: readonly T[], buildYear: number | string): YearGroup<T>[] {
  const now = Number(buildYear);
  if (!Number.isInteger(now)) throw new Error(`timeline: "${buildYear}" is not a year`);
  const time = (date?: Date) => date?.getTime() ?? Infinity;
  const years = new Map<number, T[]>();
  for (const entry of entries) {
    const year = entry.start ? entry.start.getUTCFullYear() : now;
    const list = years.get(year);
    if (list) list.push(entry);
    else years.set(year, [entry]);
  }
  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, list]) => ({
      year,
      current: year === now,
      // Infinity minus Infinity is NaN, so compare before subtracting.
      entries: list.sort((a, b) => order(time(a.start), time(b.start)) || order(time(a.end), time(b.end))),
    }));
}

const order = (a: number, b: number): number => (a === b ? 0 : a < b ? -1 : 1);
