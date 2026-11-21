// Footer dog logic with no DOM in it, so Node can test every row with a fake
// stage and a fake clock. The DOM script supplies the stage; this decides what
// the dog does and when.

/** Width of the dog's box, and half of it. */
export const DOG_WIDTH = 42;
const DOG_HALF = DOG_WIDTH / 2;

/** How far the hop carries the dog. */
export const HOP_DISTANCE = 66;
export const HOP_MS = 1050;
export const HOP_DELAY_MS = 260;
/** The hurdle drops this long after the dog lands. */
export const HURDLE_DOWN_MS = 900;
/** With no motion, the hurdle shows for this long. */
export const HURDLE_STILL_MS = 2400;

/** This many taps inside the window start the run. */
export const RUN_TAPS = 5;
export const TAP_WINDOW_MS = 4000;

export const POLE_COUNT = 6;
const FIRST_POLE = 62;
const GAP_MAX = 28;
const GAP_MIN = 13;
export const RUN_MS = 2500;
/** How long the dog sits at the end of the run. */
export const SIT_MS = 3000;
/** The pause between standing up and heading back. */
const RISE_MS = 380;
/** The poles are cleared this long after the run is over. */
const POLES_CLEAR_MS = 400;
/** Asleep again this long after the dog is idle. */
export const SETTLE_MS = 1600;
/** The run stops this far short of whatever shares the row. */
export const NEIGHBOUR_GAP = 24;

export interface Course {
  /** Distance between poles. */
  gap: number;
  /** Where each pole stands, from the dog's left edge. */
  poles: number[];
  /** How far the dog has moved when it sits. */
  end: number;
}

/**
 * The course that fits in `free` px, measured from the dog's left edge. The gap
 * follows the design from 13 to 28px; in a tighter space it closes up further so
 * the sitting dog (`end` plus its width) stays inside.
 */
export function course(free: number): Course {
  const wanted = (free - 92) / POLE_COUNT;
  const fits = (free - (FIRST_POLE - DOG_HALF) - DOG_WIDTH) / POLE_COUNT;
  const gap = Math.max(0, Math.min(GAP_MAX, Math.max(wanted, Math.min(GAP_MIN, fits))));
  const poles: number[] = [];
  for (let i = 0; i < POLE_COUNT; i += 1) poles.push(FIRST_POLE + i * gap);
  return { gap, poles, end: FIRST_POLE + POLE_COUNT * gap - DOG_HALF };
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The room for the run, from the dog's left edge to the row's inner right edge.
 * A neighbour to the right on the same line ends it 24px early.
 */
export function freeWidth(dog: Box, rowRight: number, neighbour?: Box | null): number {
  let right = rowRight;
  if (neighbour && neighbour.left > dog.right && neighbour.top < dog.bottom) {
    right = Math.min(right, neighbour.left - NEIGHBOUR_GAP);
  }
  return right - dog.left;
}

/** One keyframe. A type alias, so the browser's keyframe type accepts it as it is. */
export type Frame = {
  transform: string;
  offset?: number;
};

export interface PlayOptions {
  duration: number;
  delay?: number;
  easing: string;
}

/** The hop from one side of the hurdle to the other: 0 is the start side, 1 the far side. */
export function hopFrames(side: 0 | 1): Frame[] {
  const from = side ? HOP_DISTANCE : 0;
  const to = side ? 0 : HOP_DISTANCE;
  const dir = side ? -1 : 1;
  const mid = (from + to) / 2;
  const at = (x: number, y: number, turn: number, squash = 1): string =>
    `translate(${x}px,${y}px) rotate(${turn}deg) scale(${dir},${squash})`;
  return [
    { transform: at(from, 0, 0), offset: 0 },
    { transform: at(from, 0, 0, 0.9), offset: 0.2 },
    { transform: at(from + (mid - from) * 0.5, -10, -10 * dir), offset: 0.38 },
    { transform: at(mid, -15, 0), offset: 0.52 },
    { transform: at(to - (to - mid) * 0.4, -8, 9 * dir), offset: 0.68 },
    { transform: at(to, 0, 0, 0.9), offset: 0.84 },
    { transform: at(to, 0, 0), offset: 1 },
  ];
}

function moved(x: number, y: number, facing: number, size = 1): string {
  return `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(facing * size).toFixed(3)},${size.toFixed(3)})`;
}

/** Walking back to the start from `x`, facing left. */
export function leadFrames(x: number): Frame[] {
  return [{ transform: moved(x, 0, -1) }, { transform: moved(0, 0, -1) }];
}

export function leadMs(x: number): number {
  return Math.max(220, x * 6);
}

/**
 * The path through the poles: side to side around each one, a touch smaller
 * and higher when passing behind a pole, larger and lower in front, with a
 * small step bounce.
 */
export function runFrames(c: Course): Frame[] {
  const frames: Frame[] = [];
  const steps = 72;
  const first = DOG_HALF;
  const last = c.end + DOG_HALF;
  const ramp = c.gap * 0.8;
  const firstPole = c.poles[0] ?? FIRST_POLE;
  for (let k = 0; k <= steps; k += 1) {
    const u = k / steps;
    const centre = first + u * (last - first);
    const swing = c.gap > 0 ? Math.cos((Math.PI * (centre - firstPole)) / c.gap) : 0;
    const ease = ramp > 0 ? Math.max(0, Math.min(1, (centre - first) / ramp, (last - centre) / ramp)) : 0;
    const depth = swing * ease;
    const bounce = -0.8 * Math.abs(Math.sin(u * Math.PI * 14)) * ease;
    frames.push({ transform: moved(centre - DOG_HALF, -2.2 * depth + bounce, 1, 1 - 0.06 * depth) });
  }
  return frames;
}

/** Back from the end of the run, turning to face forward at the last moment. */
export function returnFrames(end: number): Frame[] {
  return [
    { transform: moved(end, 0, -1) },
    { transform: moved(0, 0, -1), offset: 0.96 },
    { transform: moved(0, 0, 1) },
  ];
}

export function returnMs(end: number): number {
  return Math.max(700, end * 6);
}

/** Where the dog is and which way it faces, from a computed `transform` value. */
export function poseFromMatrix(matrix: string | null | undefined): { x: number; facing: 1 | -1 } {
  const match = matrix ? /matrix\(([^)]+)\)/.exec(matrix) : null;
  if (!match?.[1]) return { x: 0, facing: 1 };
  const parts = match[1].split(',').map((part) => Number.parseFloat(part));
  const a = parts[0] ?? 1;
  const x = parts[4] ?? 0;
  return { x: Number.isFinite(x) ? x : 0, facing: a < 0 ? -1 : 1 };
}

/** A playing animation the core can drop. */
export interface Played {
  cancel(): void;
}

/** Everything the core asks of the page. The DOM script is the one implementation. */
export interface Stage {
  /** True when nothing may animate: reduced motion, or no Web Animations. */
  still(): boolean;
  /** The dog's computed transform, for `poseFromMatrix`. */
  matrix(): string;
  /** Room for the run, from the dog's left edge. */
  free(): number;
  hurdle(up: boolean): void;
  /** Plays on the dog and holds the last frame; calls `finished` once at the end. */
  play(frames: Frame[], options: PlayOptions, finished?: () => void): Played;
  /** Drops every animation on the dog. */
  stop(): void;
  /** Stands the poles at these places and raises them. */
  polesUp(places: number[]): void;
  polesDown(): void;
  /** Forgets where the poles stood. */
  polesClear(): void;
  sit(on: boolean): void;
  /** Puts the dog at `x` with no animation; `null` puts it back. */
  place(x: number | null): void;
  awake(on: boolean): void;
}

export interface Clock {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export interface Dog {
  tap(): void;
}

export function createDog(stage: Stage, clock: Clock): Dog {
  let side: 0 | 1 = 0;
  let busy = false;
  let running = false;
  let hurdleUp = false;
  let taps: number[] = [];
  let hurdleTimer: unknown;
  let settleTimer: unknown;
  let held: Played | null = null;

  const idle = (): boolean => !busy && !running && !hurdleUp;

  /** Once idle, the dog may go back to sleep after a moment. */
  const settle = (): void => {
    clock.clearTimeout(settleTimer);
    if (!idle()) return;
    settleTimer = clock.setTimeout(() => {
      if (idle()) stage.awake(false);
    }, SETTLE_MS);
  };

  const setHurdle = (up: boolean): void => {
    hurdleUp = up;
    stage.hurdle(up);
    if (!up) settle();
  };

  const hop = (still: boolean): void => {
    if (busy) return;
    clock.clearTimeout(hurdleTimer);
    setHurdle(true);
    if (still) {
      hurdleTimer = clock.setTimeout(() => setHurdle(false), HURDLE_STILL_MS);
      return;
    }
    busy = true;
    const before = held;
    const playing = stage.play(
      hopFrames(side),
      { duration: HOP_MS, delay: HOP_DELAY_MS, easing: 'ease-in-out' },
      () => {
        if (held !== playing) return;
        side = side ? 0 : 1;
        busy = false;
        hurdleTimer = clock.setTimeout(() => setHurdle(false), HURDLE_DOWN_MS);
      },
    );
    held = playing;
    before?.cancel();
  };

  const done = (): void => {
    side = 0;
    running = false;
    busy = false;
    clock.setTimeout(() => {
      if (!running) stage.polesClear();
    }, POLES_CLEAR_MS);
    settle();
  };

  const run = (still: boolean): void => {
    if (running) return;
    running = true;
    busy = true;
    clock.clearTimeout(hurdleTimer);
    setHurdle(false);
    const pose = poseFromMatrix(stage.matrix());
    held = null;
    stage.stop();
    const track = course(stage.free());
    stage.polesUp(track.poles);

    if (still) {
      stage.place(track.end);
      stage.sit(true);
      clock.setTimeout(() => {
        stage.polesDown();
        stage.sit(false);
        stage.place(null);
        done();
      }, SIT_MS);
      return;
    }

    const lead = leadMs(pose.x);
    const walkBack =
      pose.x > 1 || pose.facing < 0
        ? stage.play(leadFrames(pose.x), { duration: lead, easing: 'ease-in-out' })
        : null;
    clock.setTimeout(
      () => {
        const through = stage.play(runFrames(track), { duration: RUN_MS, easing: 'linear' }, () => {
          stage.sit(true);
          clock.setTimeout(() => {
            stage.polesDown();
            stage.sit(false);
            clock.setTimeout(() => {
              const back = stage.play(
                returnFrames(track.end),
                { duration: returnMs(track.end), easing: 'ease-in-out' },
                () => {
                  back.cancel();
                  done();
                },
              );
              through.cancel();
            }, RISE_MS);
          }, SIT_MS);
        });
        walkBack?.cancel();
      },
      walkBack ? lead + 80 : 420,
    );
  };

  return {
    tap(): void {
      clock.clearTimeout(settleTimer);
      stage.awake(true);
      if (running) return;
      const still = stage.still();
      const now = clock.now();
      taps = taps.filter((at) => now - at < TAP_WINDOW_MS);
      taps.push(now);
      if (taps.length >= RUN_TAPS) {
        taps = [];
        run(still);
      } else {
        hop(still);
      }
      settle();
    },
  };
}
