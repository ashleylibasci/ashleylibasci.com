// Footer dog: the pure core against a fake stage and a fake clock, one test per
// matrix row the core decides, then checks on the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOG_WIDTH,
  HOP_DELAY_MS,
  HOP_MS,
  HURDLE_DOWN_MS,
  HURDLE_STILL_MS,
  NEIGHBOUR_GAP,
  POLE_COUNT,
  RUN_MS,
  SETTLE_MS,
  SIT_MS,
  course,
  createDog,
  freeWidth,
  hopFrames,
  leadMs,
  poseFromMatrix,
  returnFrames,
  returnMs,
  runFrames,
} from '../src/islands/footer-dog/dog-core.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const island = join(src, 'islands', 'footer-dog');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

/** A clock that only moves when told to. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  /** @type {Map<number, { at: number, run: () => void }>} */
  const timers = new Map();
  return {
    now: () => now,
    /** @param {() => void} run @param {number} ms */
    setTimeout(run, ms) {
      timers.set(nextId, { at: now + ms, run });
      return nextId++;
    },
    /** @param {unknown} id */
    clearTimeout(id) {
      timers.delete(/** @type {number} */ (id));
    },
    /** @param {number} ms */
    tick(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = until;
    },
  };
}

/**
 * A stage that writes down what it is asked and finishes each animation on the clock.
 * @param {ReturnType<typeof fakeClock>} clock
 * @param {{ still?: boolean, free?: number }} [options]
 */
function fakeStage(clock, options = {}) {
  /** @type {string[]} */
  const log = [];
  /** @type {{ frames: { transform: string, offset?: number }[], options: { duration: number, delay?: number, easing: string }, cancelled: boolean }[]} */
  const plays = [];
  const state = {
    still: options.still ?? false,
    free: options.free ?? 400,
    matrix: 'none',
    hurdle: false,
    awake: false,
    sit: false,
    polesOn: false,
    /** @type {number[] | null} */
    poles: null,
    /** @type {number | null} */
    placed: null,
  };
  /** @type {import('../src/islands/footer-dog/dog-core.ts').Stage} */
  const stage = {
    still: () => state.still,
    matrix: () => state.matrix,
    free: () => state.free,
    hurdle(up) {
      state.hurdle = up;
      log.push(up ? 'hurdle up' : 'hurdle down');
    },
    play(frames, playOptions, finished) {
      const entry = { frames, options: playOptions, cancelled: false };
      plays.push(entry);
      log.push('play');
      clock.setTimeout(() => {
        if (!entry.cancelled) finished?.();
      }, (playOptions.delay ?? 0) + playOptions.duration);
      return {
        cancel() {
          entry.cancelled = true;
        },
      };
    },
    stop() {
      for (const entry of plays) entry.cancelled = true;
      log.push('stop');
    },
    polesUp(places) {
      state.poles = places;
      state.polesOn = true;
      log.push('poles up');
    },
    polesDown() {
      state.polesOn = false;
      log.push('poles down');
    },
    polesClear() {
      state.poles = null;
      state.polesOn = false;
      log.push('poles clear');
    },
    sit(on) {
      state.sit = on;
      log.push(on ? 'sit' : 'stand');
    },
    place(x) {
      state.placed = x;
    },
    awake(on) {
      state.awake = on;
      log.push(on ? 'awake' : 'asleep');
    },
  };
  return { stage, state, log, plays };
}

/** @param {{ still?: boolean, free?: number }} [options] */
function setUp(options) {
  const clock = fakeClock();
  const fake = fakeStage(clock, options);
  return { clock, ...fake, dog: createDog(fake.stage, clock) };
}

const HOP_TOTAL = HOP_DELAY_MS + HOP_MS;
const lastFrame = (/** @type {{ transform: string }[]} */ frames) => frames[frames.length - 1]?.transform ?? '';

test('one tap: the hurdle rises, the dog hops to the far side, the hurdle drops 0.9s after landing', () => {
  const { clock, dog, state, plays } = setUp();
  dog.tap();
  assert.equal(state.hurdle, true);
  assert.equal(plays.length, 1);
  assert.deepEqual(plays[0]?.options, { duration: 1050, delay: 260, easing: 'ease-in-out' });
  assert.match(plays[0]?.frames[0]?.transform ?? '', /^translate\(0px,0px\)/);
  assert.match(lastFrame(plays[0]?.frames ?? []), /^translate\(66px,0px\) rotate\(0deg\) scale\(1,1\)$/);
  clock.tick(HOP_TOTAL + HURDLE_DOWN_MS - 1);
  assert.equal(state.hurdle, true);
  clock.tick(1);
  assert.equal(state.hurdle, false);
});

test('next tap: the dog hops back, facing the other way', () => {
  const { clock, dog, plays } = setUp();
  dog.tap();
  clock.tick(HOP_TOTAL + 5000);
  dog.tap();
  assert.equal(plays.length, 2);
  assert.match(plays[1]?.frames[0]?.transform ?? '', /^translate\(66px,0px\) rotate\(0deg\) scale\(-1,1\)$/);
  assert.match(lastFrame(plays[1]?.frames ?? []), /^translate\(0px,0px\) rotate\(0deg\) scale\(-1,1\)$/);
  assert.equal(plays[0]?.cancelled, false, 'the first hop holds the dog through the delay');
  clock.tick(HOP_TOTAL - 1);
  assert.equal(plays[0]?.cancelled, false);
  clock.tick(1);
  assert.equal(plays[0]?.cancelled, true, 'only the newest hop is held');
  assert.equal(plays[1]?.cancelled, false);
  clock.tick(5000);
  dog.tap();
  assert.deepEqual(plays[2]?.frames, hopFrames(0));
});

test('the hop keyframes are the design ones', () => {
  assert.deepEqual(
    hopFrames(0).map((frame) => frame.offset),
    [0, 0.2, 0.38, 0.52, 0.68, 0.84, 1],
  );
  assert.equal(hopFrames(0)[3]?.transform, 'translate(33px,-15px) rotate(0deg) scale(1,1)');
  assert.equal(hopFrames(0)[1]?.transform, 'translate(0px,0px) rotate(0deg) scale(1,0.9)');
  assert.equal(hopFrames(1)[2]?.transform, 'translate(49.5px,-10px) rotate(10deg) scale(-1,1)');
});

test('tap mid-hop: counted toward the run, no second hop', () => {
  const { clock, dog, plays, state } = setUp();
  dog.tap();
  clock.tick(400);
  dog.tap();
  assert.equal(plays.length, 1);
  dog.tap();
  dog.tap();
  assert.equal(state.polesOn, false);
  dog.tap();
  assert.equal(state.polesOn, true, 'the fifth tap starts the run');
});

test('five taps in 4s: poles rise, the dog runs through, sits 3s, comes back, poles clear', () => {
  const { clock, dog, state, plays, log } = setUp({ free: 400 });
  for (let i = 0; i < 5; i += 1) {
    dog.tap();
    clock.tick(100);
  }
  const track = course(400);
  assert.deepEqual(state.poles, track.poles);
  assert.equal(state.poles?.length, 6);
  assert.equal(state.hurdle, false, 'the hurdle is gone for the run');
  assert.equal(plays[0]?.cancelled, true, 'the hop is dropped');

  // The hop never finished, so the dog starts from where it stood: 420ms, then the run.
  clock.tick(320);
  const through = plays[plays.length - 1];
  assert.deepEqual(through?.options, { duration: RUN_MS, easing: 'linear' });
  assert.deepEqual(through?.frames, runFrames(track));
  assert.equal(state.sit, false);
  clock.tick(RUN_MS);
  assert.equal(state.sit, true);
  clock.tick(SIT_MS - 1);
  assert.equal(state.sit, true);
  assert.equal(state.polesOn, true);
  clock.tick(1);
  assert.equal(state.sit, false);
  assert.equal(state.polesOn, false);
  clock.tick(380);
  const back = plays[plays.length - 1];
  assert.deepEqual(back?.frames, returnFrames(track.end));
  assert.equal(back?.options.duration, returnMs(track.end));
  assert.equal(through?.cancelled, true);
  clock.tick(returnMs(track.end));
  assert.equal(back?.cancelled, true, 'the dog is back on its own feet');
  assert.equal(log.includes('poles clear'), false);
  clock.tick(400);
  assert.equal(state.poles, null);

  // Back at the start: the next tap hops from the start side again.
  dog.tap();
  assert.deepEqual(plays[plays.length - 1]?.frames, hopFrames(0));
});

test('the run starts from the far side by walking back first', () => {
  const { clock, dog, state, plays } = setUp();
  dog.tap();
  clock.tick(HOP_TOTAL);
  state.matrix = 'matrix(1, 0, 0, 1, 66, 0)';
  for (let i = 0; i < 4; i += 1) dog.tap();
  const lead = plays[plays.length - 1];
  assert.equal(lead?.options.duration, leadMs(66));
  assert.equal(lead?.frames[0]?.transform, 'translate(66.00px,0.00px) scale(-1.000,1.000)');
  assert.equal(lead?.frames[1]?.transform, 'translate(0.00px,0.00px) scale(-1.000,1.000)');
  clock.tick(leadMs(66) + 79);
  assert.equal(plays[plays.length - 1], lead);
  clock.tick(1);
  assert.equal(plays[plays.length - 1]?.options.duration, RUN_MS);
  assert.equal(lead?.cancelled, true);
});

test('taps during the run are ignored for hops and runs', () => {
  const { clock, dog, plays, log } = setUp();
  for (let i = 0; i < 5; i += 1) dog.tap();
  clock.tick(1000);
  const before = plays.length;
  const ups = log.filter((line) => line === 'poles up').length;
  for (let i = 0; i < 12; i += 1) dog.tap();
  assert.equal(plays.length, before);
  assert.equal(log.filter((line) => line === 'poles up').length, ups);
  assert.equal(log.filter((line) => line === 'hurdle up').length, 1);
});

test('taps during the run do not count toward the next run', () => {
  const { clock, dog, log } = setUp({ still: true, free: 300 });
  for (let i = 0; i < 5; i += 1) dog.tap();
  clock.tick(SIT_MS - 1000);
  for (let i = 0; i < 4; i += 1) dog.tap();
  clock.tick(1000);
  dog.tap();
  assert.equal(log.filter((line) => line === 'poles up').length, 1, 'one tap after the run is a hop, not a second run');
});

test('slow taps: more than 4s from first to fifth gives hops only', () => {
  const { clock, dog, state, log } = setUp();
  for (let i = 0; i < 5; i += 1) {
    dog.tap();
    clock.tick(1001);
  }
  assert.equal(log.includes('poles up'), false);
  assert.equal(state.polesOn, false);

  // Exactly inside the window still counts.
  const quick = setUp();
  for (let i = 0; i < 5; i += 1) {
    quick.dog.tap();
    quick.clock.tick(999);
  }
  assert.equal(quick.log.includes('poles up'), true);
});

test('course: six poles, the design gap from 13 to 28px, and the sitting dog inside the free width', () => {
  // Wide: the gap tops out at 28.
  assert.deepEqual(course(600), { gap: 28, poles: [62, 90, 118, 146, 174, 202], end: 209 });
  // Between: the design formula.
  const mid = course(212);
  assert.equal(mid.gap, 20);
  assert.equal(mid.end, 161);
  // The design floor holds while it fits.
  assert.equal(course(165).gap, 13);
  assert.equal(course(161).gap, 13);
  for (let free = 90; free <= 700; free += 1) {
    const c = course(free);
    assert.equal(c.poles.length, POLE_COUNT);
    assert.ok(c.end + DOG_WIDTH <= free + 1e-9, `free ${free}: ends at ${c.end + DOG_WIDTH}`);
    assert.ok(c.gap >= 0 && c.gap <= 28);
    assert.equal(c.end, 62 + 6 * c.gap - 21);
  }
});

test('narrow footer: the poles close up below the design floor so the run ends inside', () => {
  const c = course(140);
  assert.ok(c.gap < 13);
  assert.equal(c.end + DOG_WIDTH, 140);
  assert.equal(runFrames(c).length, 73);
  // No room at all: the poles stack rather than run off the page.
  assert.equal(course(40).gap, 0);
  for (const frame of runFrames(course(40))) assert.equal(/NaN|Infinity/.test(frame.transform), false);
});

test('the run path starts at rest, ends at the sit, and never leaves the course', () => {
  const c = course(400);
  const frames = runFrames(c);
  assert.equal(frames[0]?.transform, 'translate(0.00px,0.00px) scale(1.000,1.000)');
  assert.equal(frames[72]?.transform, `translate(${c.end.toFixed(2)}px,0.00px) scale(1.000,1.000)`);
  for (const frame of frames) {
    const x = Number(/translate\(([-\d.]+)px/.exec(frame.transform)?.[1]);
    assert.ok(x >= 0 && x <= c.end);
  }
});

test('updated line beside the dog: the run stops 24px short of it', () => {
  const dogBox = { left: 100, right: 208, top: 50, bottom: 81 };
  assert.equal(NEIGHBOUR_GAP, 24);
  // Same line, to the right.
  assert.equal(freeWidth(dogBox, 900, { left: 700, right: 900, top: 60, bottom: 80 }), 700 - 24 - 100);
  // Wrapped below the dog: the whole row is free.
  assert.equal(freeWidth(dogBox, 900, { left: 300, right: 500, top: 93, bottom: 113 }), 800);
  // Not to the right of the dog, or not there at all.
  assert.equal(freeWidth(dogBox, 900, { left: 100, right: 208, top: 50, bottom: 81 }), 800);
  assert.equal(freeWidth(dogBox, 900, null), 800);
  // The row's own edge wins when it is nearer.
  assert.equal(freeWidth(dogBox, 500, { left: 700, right: 900, top: 60, bottom: 80 }), 400);
});

test('pose from a computed matrix', () => {
  assert.deepEqual(poseFromMatrix('none'), { x: 0, facing: 1 });
  assert.deepEqual(poseFromMatrix(''), { x: 0, facing: 1 });
  assert.deepEqual(poseFromMatrix(undefined), { x: 0, facing: 1 });
  assert.deepEqual(poseFromMatrix('matrix(1, 0, 0, 1, 66, 0)'), { x: 66, facing: 1 });
  assert.deepEqual(poseFromMatrix('matrix(-1, 0, 0, 1, 0, 0)'), { x: 0, facing: -1 });
  assert.deepEqual(poseFromMatrix('matrix(-0.98, 0.17, 0.17, 0.98, 31.5, -9)'), { x: 31.5, facing: -1 });
});

test('dark, tap: awake at once, asleep again 1.6s after the dog is idle', () => {
  const { clock, dog, state } = setUp();
  dog.tap();
  assert.equal(state.awake, true);
  clock.tick(HOP_TOTAL + HURDLE_DOWN_MS + SETTLE_MS - 1);
  assert.equal(state.awake, true);
  clock.tick(1);
  assert.equal(state.awake, false);

  // A tap while it waits to settle keeps it up.
  dog.tap();
  clock.tick(HOP_TOTAL + HURDLE_DOWN_MS + SETTLE_MS - 10);
  dog.tap();
  clock.tick(20);
  assert.equal(state.awake, true);
});

test('dark, run: awake for the whole run, asleep 1.6s after it is back', () => {
  const { clock, dog, state } = setUp({ free: 400 });
  for (let i = 0; i < 5; i += 1) dog.tap();
  const whole = 420 + RUN_MS + SIT_MS + 380 + returnMs(course(400).end);
  clock.tick(whole + SETTLE_MS - 1);
  assert.equal(state.awake, true);
  clock.tick(1);
  assert.equal(state.awake, false);
});

test('reduced motion, one tap: the hurdle shows for 2.4s and nothing plays', () => {
  const { clock, dog, state, plays } = setUp({ still: true });
  dog.tap();
  assert.equal(state.hurdle, true);
  clock.tick(HURDLE_STILL_MS - 1);
  assert.equal(state.hurdle, true);
  clock.tick(1);
  assert.equal(state.hurdle, false);
  assert.equal(plays.length, 0);
  assert.equal(state.awake, true);
  clock.tick(SETTLE_MS);
  assert.equal(state.awake, false);
});

test('reduced motion, five taps: the dog is placed at the end, sitting, for 3s, then reset', () => {
  const { clock, dog, state, plays } = setUp({ still: true, free: 300 });
  for (let i = 0; i < 5; i += 1) dog.tap();
  const track = course(300);
  assert.equal(plays.length, 0);
  assert.equal(state.placed, track.end);
  assert.equal(state.sit, true);
  assert.equal(state.polesOn, true);
  assert.equal(state.hurdle, false);
  clock.tick(SIT_MS - 1);
  assert.equal(state.sit, true);
  clock.tick(1);
  assert.equal(state.placed, null);
  assert.equal(state.sit, false);
  assert.equal(state.polesOn, false);
  clock.tick(400);
  assert.equal(state.poles, null);
});

test('stillness is read at each tap', () => {
  const { clock, dog, state, plays } = setUp({ still: true });
  dog.tap();
  clock.tick(5000);
  state.still = false;
  dog.tap();
  assert.equal(plays.length, 1);
});

// ---- The source.

test('markup: a focusable image labelled "A small dog", the rest hidden from assistive tech', () => {
  const source = read('islands', 'footer-dog', 'FooterDog.astro');
  assert.match(source, /<span class="dog-egg" data-footer-dog tabindex="0" role="img" aria-label="A small dog">/);
  assert.match(source, /<span class="nap" aria-hidden="true"><Dog pose="curled" \/><\/span>/);
  assert.match(source, /<span class="zz" aria-hidden="true">/);
  assert.match(source, /<span class="hurdle" data-hurdle aria-hidden="true">/);
  assert.match(source, /<span class="poles" data-poles aria-hidden="true">(?:<i><\/i>){6}<\/span>/);
  assert.match(source, /<span class="dog" data-dog><Dog pose="standing" \/><\/span>/);
  const drawing = read('components', 'drawings', 'Dog.astro');
  assert.equal([...drawing.matchAll(/<svg class="dog-drawing" viewBox="0 0 64 46" aria-hidden="true" focusable="false">/g)].length, 2);
  assert.equal(/<script/.test(drawing), false, 'the drawing is static');
  assert.equal([...drawing.matchAll(/id="dog-ground"/g)].length, 1);
});

test('the footer mounts the dog in its slot and marks the row the run measures', () => {
  const footer = read('layouts', 'Footer.astro');
  assert.match(footer, /<span data-slot="footer-drawing"><FooterDog \/><\/span>/);
  assert.match(footer, /<div class="wrap" data-dog-row>/);
});

test('styles: wag, focus ring on either drawing, dark sleep, still z and the phone touch area', () => {
  const source = read('islands', 'footer-dog', 'FooterDog.astro');
  assert.match(source, /\.dog-egg:hover :global\(\.tail\) \{\s*animation: dog-wag 0\.3s ease-in-out 4;/);
  assert.match(source, /\.dog-egg:focus-visible \.dog,\s*\.dog-egg:focus-visible \.nap \{\s*outline: 1\.5px solid var\(--color-focus\);/);
  assert.match(source, /:global\(:root\[data-theme='dark'\]\) \.dog-egg \{\s*--dog-opacity: 0\.82;/);
  assert.match(source, /:global\(:root\[data-theme='dark'\]\) \.dog-egg:not\(\.awake\) \.dog \{\s*visibility: hidden;/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\) \{\s*\.zz i:first-child \{\s*opacity: 0\.6;\s*transform: translate\(3px, -6px\);/);
  assert.match(source, /@media \(max-width: 760px\) \{\s*\.dog-egg::after \{[^}]*height: 44px;/);
});

test('plays hold the end forwards only, so a delayed hop never shows its first frame early', () => {
  const script = read('islands', 'footer-dog', 'footer-dog.ts');
  assert.match(script, /dog\.animate\(frames, \{ \.\.\.options, fill: 'forwards' \}\)/);
  assert.equal(/fill: 'both'|fill: 'backwards'/.test(script), false);
});

test('the client script imports nothing outside its own folder', () => {
  const component = read('islands', 'footer-dog', 'FooterDog.astro');
  const scripts = [...component.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
  assert.equal(scripts.length, 1);
  const sources = {
    'dog-core.ts': readFileSync(join(island, 'dog-core.ts'), 'utf8'),
    'footer-dog.ts': readFileSync(join(island, 'footer-dog.ts'), 'utf8'),
    script: scripts[0] ?? '',
  };
  let seen = 0;
  for (const [file, source] of Object.entries(sources)) {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      assert.match(match[1] ?? '', /^\.\/[^/]+$/, `${file}: ${match[1]}`);
      seen += 1;
    }
  }
  assert.ok(seen >= 2, 'the script and the leaf each import from the folder');
  assert.equal(/\bdocument\.|\bwindow\.|getComputedStyle\(/.test(sources['dog-core.ts']), false, 'the core has no DOM');
});

test('no colour outside the tokens', () => {
  for (const source of [
    read('islands', 'footer-dog', 'FooterDog.astro'),
    read('islands', 'footer-dog', 'footer-dog.ts'),
    read('islands', 'footer-dog', 'dog-core.ts'),
    read('components', 'drawings', 'Dog.astro'),
  ]) {
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(source), false);
  }
});

test('the script listens on the dog alone, moves no focus and never writes the theme', () => {
  const script = read('islands', 'footer-dog', 'footer-dog.ts');
  assert.equal(/(?:window|document|documentElement|body)\s*\.\s*addEventListener/.test(script), false);
  const listeners = [...script.matchAll(/(\w+)\.addEventListener\('(\w+)'/g)].map((match) => `${match[1]}:${match[2]}`);
  assert.deepEqual(listeners, ['animation:finish', 'root:click', 'root:keydown']);
  assert.equal(/\.focus\(|\.blur\(/.test(script), false);
  assert.equal(/data-theme|dataset\.theme|localStorage/.test(script), false);
  assert.equal([...script.matchAll(/preventDefault\(\)/g)].length, 1);
  assert.match(script, /if \(event\.key !== 'Enter' && event\.key !== ' '\) return;[\s\S]*event\.preventDefault\(\);\s*if \(!event\.repeat\) tap\(\);/);
});
