// The sample nights behind Figure 1 of the Health Dashboard case study: made-up sleep and
// heart-rate variability, the same on every build. Not readings from anyone.
// Pure and type-erasable: the tests import this file directly, so no Astro imports and no enums.

export interface Night {
  /** Hours of sleep, to one decimal. */
  sleep: number;
  /** Heart-rate variability in whole milliseconds. */
  hrv: number;
}

export const NIGHTS = 28;
/** The exam week, as night numbers counted from 1, first and last included. */
export const EXAM_WEEK = { first: 17, last: 21 } as const;

// A Lehmer generator (multiplier 16807, modulus 2^31 - 1) started from a fixed seed.
const SEED = 7;
const MULTIPLIER = 16807;
const MODULUS = 2147483647;

const BASE_SLEEP = 7.2;
/** Longer nights on days 6 and 7 of each week. */
const WEEKEND_EXTRA = 0.6;
const EXAM_LOSS = 1.0;
const SLEEP_SPREAD = 0.9;
const BASE_HRV = 52;
/** Milliseconds of HRV per hour of sleep above or below the base. */
const HRV_PER_HOUR = 7;
const HRV_SPREAD = 8;

/** True for a night number (from 1) inside the exam week. */
export function inExamWeek(night: number): boolean {
  return night >= EXAM_WEEK.first && night <= EXAM_WEEK.last;
}

/** The 28 nights, in order. Every call returns the same values. */
export function sampleNights(): Night[] {
  let state = SEED;
  const random = () => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  };

  const nights: Night[] = [];
  for (let index = 0; index < NIGHTS; index++) {
    const weekday = index % 7;
    const base =
      BASE_SLEEP + (weekday === 5 || weekday === 6 ? WEEKEND_EXTRA : 0) - (inExamWeek(index + 1) ? EXAM_LOSS : 0);
    // Sleep is drawn first; HRV follows it, so the order of the two draws is fixed.
    const sleep = Math.round((base + (random() - 0.5) * SLEEP_SPREAD) * 10) / 10;
    const hrv = Math.round(BASE_HRV + (sleep - BASE_SLEEP) * HRV_PER_HOUR + (random() - 0.5) * HRV_SPREAD);
    nights.push({ sleep, hrv });
  }
  return nights;
}
