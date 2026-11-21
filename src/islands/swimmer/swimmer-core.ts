// Swimmer logic with no DOM in it, so Node can test every row the core decides
// with a fake clock and a seeded random. The DOM script measures the page and
// plays what this returns.

/** Below the header, the figure starts this far down. */
export const TOP_OFFSET = 48;
/** At the bottom of its sink the figure stops this far above the viewport's foot (with the header). */
export const SINK_SPARE = 170;
/** The sink ends when the end element's top is this far down the viewport. */
export const SINK_END_AT = 0.45;
/** With no motion, the figure holds this far down the viewport. */
export const STILL_HOLD = '38vh';
/** The figure eases this share of the way to its target each frame. */
export const EASE_RATE = 0.08;
/** The loop stops once the figure is this close and the page is this still. */
export const REST_DISTANCE = 0.3;
export const REST_VELOCITY = 0.05;
/** The figure has settled on the sand once it is this close. */
export const SETTLE_DISTANCE = 1.5;
/** The page counts as at its end this close to the bottom. */
export const END_SLACK = 4;
/** The figure's top sits this far above the sand box's top when landed. */
export const LAND_OFFSET = 1.5;

/** A fast scroll lets bubbles go, at most once per gap. */
export const PUFF_VELOCITY = 1.5;
export const PUFF_GAP_MS = 1400;
/** A few bubbles now and then. */
export const IDLE_MS = 5200;

/** This many clicks inside the window start the somersault. */
export const TURN_TAPS = 3;
export const TAP_WINDOW_MS = 1100;
export const TURN_MS = 1400;
export const TURN_EASING = 'cubic-bezier(.45,.05,.4,1)';
/** With no motion, the turn is held this far, this long. */
export const STILL_TURN = 'rotate(152deg)';
export const STILL_TURN_MS = 1300;

/** The figure's lean while sinking, and once landed. */
export const LEAN = -28;
export const LANDED_LEAN = -6;

/** After the figure settles on the sand, the scene starts this much later. */
export const SCENE_DELAY_MS = 380;
export const FISH_MS = 5600;
/** The oval the fish swims around the figure. */
export const LOOP_RX = 27;
export const LOOP_RY = 14;
export const FISH_OPACITY = 0.85;
/** With no motion, the fish shows beside the figure this long. */
export const STILL_FISH_MS = 4500;
export const WAVE_AT_MS = 2300;
export const WAVE_MS = 1300;
export const STILL_WAVE = 'rotate(55deg)';
export const STILL_WAVE_MS = 1400;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

export interface SinkInput {
  /** Header height. */
  nav: number;
  /** Viewport height. */
  height: number;
  scrollY: number;
  /** The end element's top in the viewport, or null when there is none. */
  endTop: number | null;
  /** The page's full height, for when there is no end element. */
  scrollHeight: number;
}

/** How far the sink has got, 0 to 1. With no end element it runs over the whole page. */
export function sinkProgress(input: SinkInput): number {
  const end =
    input.endTop === null
      ? Math.max(1, input.scrollHeight - input.height)
      : Math.max(1, input.endTop + input.scrollY - input.height * SINK_END_AT);
  return clamp(input.scrollY / end, 0, 1);
}

/** Where the figure's top should be, in viewport px, while it sinks. */
export function sinkTarget(input: SinkInput): number {
  return input.nav + TOP_OFFSET + sinkProgress(input) * (input.height - input.nav - SINK_SPARE);
}

/** Where the figure's top should be when it has landed, from the sand box's top. */
export function landingY(sandTop: number): number {
  return sandTop - LAND_OFFSET;
}

/** True at the very end of the page. */
export function atEnd(scrollY: number, innerHeight: number, scrollHeight: number): boolean {
  return scrollY + innerHeight >= scrollHeight - END_SLACK;
}

/** One frame of easing toward the target; the first frame (null) jumps straight there. */
export function easeStep(current: number | null, target: number, rate = EASE_RATE): number {
  if (current === null) return target;
  return current + (target - current) * rate;
}

/** The scroll velocity, smoothed over frames. */
export function smoothVelocity(velocity: number, moved: number): number {
  return velocity * 0.85 + moved * 0.15;
}

/** True when a fast scroll should let bubbles go now. */
export function scrollPuff(velocity: number, now: number, lastPuff: number): boolean {
  return Math.abs(velocity) > PUFF_VELOCITY && now - lastPuff > PUFF_GAP_MS;
}

/** True while the figure is still moving and the loop should run another frame. */
export function keepRunning(target: number, y: number, velocity: number): boolean {
  return Math.abs(target - y) > REST_DISTANCE || Math.abs(velocity) > REST_VELOCITY;
}

/** True when the landed figure has come to rest on the sand. */
export function settled(target: number, y: number): boolean {
  return Math.abs(target - y) < SETTLE_DISTANCE;
}

/** How many bubbles a small puff lets go: two, sometimes three. */
export function puffCount(random: () => number, chance: number): number {
  return 2 + (random() < chance ? 1 : 0);
}

export interface Clock {
  now(): number;
}

/**
 * Counts taps; returns true on the tap that makes `count` inside `windowMs`,
 * then starts counting again.
 */
export function createTapWindow(count: number, windowMs: number, clock: Clock): () => boolean {
  let taps: number[] = [];
  return () => {
    const now = clock.now();
    taps = taps.filter((at) => now - at < windowMs);
    taps.push(now);
    if (taps.length < count) return false;
    taps = [];
    return true;
  };
}

/** One keyframe. A type alias, so the browser's keyframe type accepts it as it is. */
export type Frame = {
  transform: string;
  offset?: number;
  opacity?: number;
};

/** One whole turn backward from the current lean. */
export function turnFrames(landed: boolean): Frame[] {
  const from = landed ? LANDED_LEAN : LEAN;
  return [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${from - 360}deg)` }];
}

/** The arm's wave: up, a little down, up, and back. */
export function waveFrames(): Frame[] {
  return [
    { transform: 'rotate(0)' },
    { transform: 'rotate(58deg)', offset: 0.25 },
    { transform: 'rotate(34deg)', offset: 0.45 },
    { transform: 'rotate(58deg)', offset: 0.65 },
    { transform: 'rotate(0)' },
  ];
}

/** Where the fish waits beside the figure when nothing moves. */
export function stillFishPlace(cx: number, cy: number): string {
  return `translate(${(cx - 30).toFixed(1)}px,${(cy + 6).toFixed(1)}px)`;
}

/**
 * The fish's route around a figure centred at (cx, cy) in a viewport `vw` wide:
 * in from the right edge, one oval loop around the figure, then up and off to the
 * right. 81 frames, each tilted along the path, flipped to face the way it swims,
 * fading in and out at the ends.
 */
export function fishFrames(cx: number, cy: number, vw: number): Frame[] {
  const points: [number, number][] = [];
  const times: number[] = [];
  const edge = vw + 14;
  for (let i = 0; i <= 16; i += 1) {
    const u = i / 16;
    points.push([edge + (cx + LOOP_RX - edge) * u, cy + 10 - 10 * u]);
    times.push(u * 0.25);
  }
  for (let i = 1; i <= 48; i += 1) {
    const u = (i / 48) * Math.PI * 2;
    points.push([cx + LOOP_RX * Math.cos(u), cy - LOOP_RY * Math.sin(u)]);
    times.push(0.25 + (i / 48) * 0.5);
  }
  for (let i = 1; i <= 16; i += 1) {
    const u = i / 16;
    points.push([cx + LOOP_RX + (edge - cx - LOOP_RX) * u, cy - 44 * u * u]);
    times.push(0.75 + u * 0.25);
  }
  const last = points.length - 1;
  return points.map((point, i) => {
    const before = points[Math.max(0, i - 1)] ?? point;
    const after = points[Math.min(last, i + 1)] ?? point;
    const dx = after[0] - before[0];
    const dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    let flip = clamp((dx / length) * 3, -1, 1);
    const tilt = clamp((Math.atan2(dy, Math.abs(dx) || 0.001) * 180) / Math.PI, -32, 32) * (flip < 0 ? -1 : 1);
    if (Math.abs(flip) < 0.12) flip = flip < 0 ? -0.12 : 0.12;
    const t = times[i] ?? 0;
    const opacity = t < 0.06 ? (t / 0.06) * FISH_OPACITY : t > 0.94 ? ((1 - t) / 0.06) * FISH_OPACITY : FISH_OPACITY;
    return {
      offset: t,
      opacity,
      transform: `translate(${point[0].toFixed(1)}px,${point[1].toFixed(1)}px) rotate(${tilt.toFixed(1)}deg) scaleX(${flip.toFixed(2)})`,
    };
  });
}

export interface BubbleSpec {
  /** Width and height, px. */
  size: number;
  /** Start, sideways from the mouth, px. */
  x: number;
  /** How far it drifts sideways and rises, px. */
  dx: number;
  dy: number;
  /** Delay before it starts, ms. */
  delay: number;
}

/** `n` bubbles from the mouth, spread `spread` px sideways at the start. */
export function bubbleSpecs(n: number, spread: number, random: () => number): BubbleSpec[] {
  const specs: BubbleSpec[] = [];
  for (let i = 0; i < n; i += 1) {
    const size = 2 + random() * 2.6;
    const x = (random() - 0.5) * spread;
    const dx = (random() - 0.5) * (6 + spread);
    const dy = -(26 + random() * 26 + spread * 1.5);
    const delay = i * (spread ? 60 : 240) + random() * 80;
    specs.push({ size, x, dx, dy, delay });
  }
  return specs;
}
