// The exam-night rule and the Demo's choices, with no DOM in them, so Node can test every answer.
// Times are minutes after midnight.

export type Mode = 'easy' | 'most';
export type Screen = 'sleep' | 'fit';

/** Exam start times. */
export const EXAMS: readonly { value: number; label: string }[] = [
  { value: 480, label: '8:00' },
  { value: 540, label: '9:00' },
  { value: 600, label: '10:00 a.m.' },
];

/** Alarm modes. */
export const MODES: readonly { value: Mode; label: string }[] = [
  { value: 'easy', label: 'Easier wake-up' },
  { value: 'most', label: 'Most sleep' },
];

/** The two phone screens and the caption under each. */
export const SCREENS: readonly { value: Screen; label: string; caption: string }[] = [
  {
    value: 'sleep',
    label: 'Sleep',
    caption: "Last night measured against an 8-hour need, and tonight's bed-by time.",
  },
  {
    value: 'fit',
    label: 'Fitness',
    caption: 'A lighter session when recovery is low, timed to finish early before an exam.',
  },
];

/** What the Demo shows before anyone touches it. */
export const DEFAULT_EXAM = 540;
export const DEFAULT_MODE: Mode = 'easy';
export const DEFAULT_SCREEN: Screen = 'sleep';

const LEAD = 90; // wake this long before the exam
const MOST_SLEEP_EXTRA = 30; // Most sleep wakes this much later
const SLEEP = 8 * 60;
const FALL_ASLEEP = 15;
const DAY = 24 * 60;

/** wake = exam − 90 min (Most sleep: 30 min later); bed by = wake − 8 h − 15 min. */
export function plan(exam: number, mode: Mode): { wake: number; bed: number } {
  const wake = exam - LEAD + (mode === 'most' ? MOST_SLEEP_EXTRA : 0);
  return { wake, bed: wake - SLEEP - FALL_ASLEEP };
}

/** Minutes as a 12-hour time and its period: 450 is "7:30" "a.m.", −45 is "11:15" "p.m.". */
export function clock(minutes: number): { time: string; period: 'a.m.' | 'p.m.' } {
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  const hour = Math.floor(m / 60);
  const minute = m % 60;
  return {
    time: `${hour % 12 || 12}:${minute < 10 ? '0' : ''}${minute}`,
    period: hour < 12 ? 'a.m.' : 'p.m.',
  };
}

/** The tab a key moves to from `index` among `count` tabs, wrapping; null for any other key. */
export function nextTab(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
