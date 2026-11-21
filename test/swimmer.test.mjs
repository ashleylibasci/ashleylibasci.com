// Swimmer: the pure core with a fake clock and a seeded random, one test per
// matrix row the core decides, then checks on the markup and the source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FISH_OPACITY,
  LOOP_RX,
  LOOP_RY,
  PUFF_GAP_MS,
  TAP_WINDOW_MS,
  TURN_TAPS,
  atEnd,
  bubbleSpecs,
  createTapWindow,
  easeStep,
  fishFrames,
  keepRunning,
  landingY,
  puffCount,
  scrollPuff,
  settled,
  sinkProgress,
  sinkTarget,
  smoothVelocity,
  stillFishPlace,
  turnFrames,
  waveFrames,
} from '../src/islands/swimmer/swimmer-core.ts';

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (/** @type {string[]} */ ...parts) => readFileSync(join(src, ...parts), 'utf8');

/** A clock that only moves when told to. */
function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    /** @param {number} ms */
    tick(ms) {
      now += ms;
    },
  };
}

/** A small seeded random (mulberry32), so bubble rows repeat. */
function seeded(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const page = { nav: 64, height: 800, scrollHeight: 4000 };

test('top of page: the figure starts 48px below the header', () => {
  assert.equal(sinkTarget({ ...page, scrollY: 0, endTop: 2000 }), 64 + 48);
});

test('scroll down: the target follows progress toward the end element, clamped', () => {
  // end = tlTop + scrollY - 0.45h = 1000 + 500 - 360 = 1140
  const input = { ...page, scrollY: 500, endTop: 1000 };
  const p = 500 / 1140;
  assert.ok(Math.abs(sinkProgress(input) - p) < 1e-9);
  assert.ok(Math.abs(sinkTarget(input) - (64 + 48 + p * (800 - 64 - 170))) < 1e-9);
  assert.equal(sinkTarget({ ...page, scrollY: 3000, endTop: -1500 }), 64 + 48 + (800 - 64 - 170));
  assert.equal(sinkProgress({ ...page, scrollY: 10, endTop: -9999 }), 1, 'a tiny end divides by at least 1');
});

test('no end element: progress runs over the whole page height', () => {
  assert.equal(sinkProgress({ ...page, scrollY: 1600, endTop: null }), 0.5);
  assert.equal(sinkProgress({ ...page, scrollY: 3200, endTop: null }), 1);
});

test('the figure eases 8% per frame, the first frame jumps', () => {
  assert.equal(easeStep(null, 300), 300);
  assert.ok(Math.abs(easeStep(100, 200) - 108) < 1e-9);
});

test('the loop runs only while the figure moves', () => {
  assert.equal(keepRunning(100, 100.2, 0.01), false);
  assert.equal(keepRunning(100, 100.5, 0), true);
  assert.equal(keepRunning(100, 100, 0.1), true);
});

test('fast scroll: bubbles once the smoothed velocity passes 1.5, at most once per 1400ms', () => {
  let v = 0;
  for (let i = 0; i < 10; i += 1) v = smoothVelocity(v, 20);
  assert.ok(v > 1.5);
  assert.equal(smoothVelocity(10, 0), 8.5);
  assert.equal(scrollPuff(v, 2000, 0), true);
  assert.equal(scrollPuff(v, 2000, 2000 - PUFF_GAP_MS), false);
  assert.equal(scrollPuff(1.4, 9000, 0), false);
  assert.equal(scrollPuff(-2, 9000, 0), true, 'scrolling up counts too');
});

test('small puffs are two or three bubbles', () => {
  assert.equal(puffCount(() => 0.1, 0.5), 3);
  assert.equal(puffCount(() => 0.6, 0.5), 2);
  assert.equal(puffCount(() => 0.45, 0.4), 2);
});

test('hover and click puffs: spread, size, rise and stagger', () => {
  const random = seeded();
  for (const [n, spread] of [
    [7, 10],
    [8, 12],
  ]) {
    const specs = bubbleSpecs(n, spread, random);
    assert.equal(specs.length, n);
    specs.forEach((b, i) => {
      assert.ok(b.size >= 2 && b.size <= 4.6);
      assert.ok(Math.abs(b.x) <= spread / 2);
      assert.ok(Math.abs(b.dx) <= (6 + spread) / 2);
      assert.ok(b.dy <= -(26 + spread * 1.5) && b.dy >= -(52 + spread * 1.5));
      assert.ok(b.delay >= i * 60 && b.delay <= i * 60 + 80);
    });
  }
  const idle = bubbleSpecs(3, 0, seeded(3));
  idle.forEach((b, i) => {
    assert.ok(b.x === 0);
    assert.ok(b.delay >= i * 240 && b.delay <= i * 240 + 80);
  });
  assert.deepEqual(bubbleSpecs(4, 8, seeded(11)), bubbleSpecs(4, 8, seeded(11)), 'seeded rows repeat');
});

test('three clicks inside 1100ms start one somersault; the window resets after the third', () => {
  const clock = fakeClock();
  const tap = createTapWindow(TURN_TAPS, TAP_WINDOW_MS, clock);
  assert.equal(tap(), false);
  clock.tick(400);
  assert.equal(tap(), false);
  clock.tick(400);
  assert.equal(tap(), true);
  clock.tick(100);
  assert.equal(tap(), false, 'counting starts again');
  clock.tick(100);
  assert.equal(tap(), false);
  clock.tick(100);
  assert.equal(tap(), true);
});

test('two slow clicks: no somersault', () => {
  const clock = fakeClock();
  const tap = createTapWindow(3, 1100, clock);
  const results = [];
  for (let i = 0; i < 6; i += 1) {
    results.push(tap());
    clock.tick(1100);
  }
  assert.deepEqual(results, [false, false, false, false, false, false]);
  // Taps spread so the oldest ages out keep the count below three.
  const slow = createTapWindow(3, 1100, clock);
  assert.equal(slow(), false);
  clock.tick(600);
  assert.equal(slow(), false);
  clock.tick(600);
  assert.equal(slow(), false);
});

test('the somersault turns once from the current lean', () => {
  assert.deepEqual(turnFrames(false), [{ transform: 'rotate(-28deg)' }, { transform: 'rotate(-388deg)' }]);
  assert.deepEqual(turnFrames(true), [{ transform: 'rotate(-6deg)' }, { transform: 'rotate(-366deg)' }]);
});

test('very end: landed at the bottom, onto the sand, settled once close', () => {
  assert.equal(atEnd(3200, 800, 4000), true);
  assert.equal(atEnd(3196, 800, 4000), true);
  assert.equal(atEnd(3195, 800, 4000), false);
  assert.equal(landingY(700), 698.5);
  assert.equal(settled(698.5, 699.9), true);
  assert.equal(settled(698.5, 700.1), false);
});

test('the fish: in from the right, one oval loop, off up-right, fading at the ends', () => {
  const cx = 1200;
  const cy = 700;
  const vw = 1280;
  const frames = fishFrames(cx, cy, vw);
  assert.equal(frames.length, 81);
  assert.equal(frames[0]?.offset, 0);
  assert.equal(frames.at(-1)?.offset, 1);
  for (let i = 1; i < frames.length; i += 1) assert.ok((frames[i]?.offset ?? 0) > (frames[i - 1]?.offset ?? 0));
  assert.equal(frames[0]?.opacity, 0);
  assert.equal(frames.at(-1)?.opacity, 0);
  assert.equal(frames[40]?.opacity, FISH_OPACITY);
  const at = (/** @type {number} */ i) => {
    const m = /translate\(([-\d.]+)px,([-\d.]+)px\) rotate\(([-\d.]+)deg\) scaleX\(([-\d.]+)\)/.exec(frames[i]?.transform ?? '');
    assert.ok(m, frames[i]?.transform);
    return m.slice(1).map(Number);
  };
  assert.deepEqual(at(0).slice(0, 2), [vw + 14, cy + 10]);
  assert.deepEqual(at(16).slice(0, 2), [cx + LOOP_RX, cy]);
  const top = at(16 + 12);
  assert.ok(Math.abs(top[0] - cx) < 0.1 && Math.abs(top[1] - (cy - LOOP_RY)) < 0.1, 'a quarter round is the top of the oval');
  assert.deepEqual(at(64).slice(0, 2), [cx + LOOP_RX, cy]);
  assert.deepEqual(at(80).slice(0, 2), [vw + 14, cy - 44]);
  for (let i = 0; i < frames.length; i += 1) {
    const [, , tilt, flip] = at(i);
    assert.ok(Math.abs(tilt) <= 32);
    assert.ok(Math.abs(flip) >= 0.12 && Math.abs(flip) <= 1);
  }
  assert.ok(at(4)[3] < 0, 'swimming in, it faces left');
  assert.ok(at(76)[3] > 0, 'swimming off, it faces right');
});

test('the wave and the still versions', () => {
  const frames = waveFrames();
  assert.deepEqual(
    frames.map((f) => f.transform),
    ['rotate(0)', 'rotate(58deg)', 'rotate(34deg)', 'rotate(58deg)', 'rotate(0)'],
  );
  assert.equal(stillFishPlace(1200, 700), 'translate(1170.0px,706.0px)');
});

// ---- markup and source ----

const island = read('islands', 'swimmer', 'SwimmerEgg.astro');
const drawing = read('components', 'drawings', 'Swimmer.astro');
const script = read('islands', 'swimmer', 'swimmer.ts');
const core = read('islands', 'swimmer', 'swimmer-core.ts');

test('everything is hidden from assistive tech and nothing is focusable', () => {
  assert.match(island, /<div class="swimmer-egg" data-swimmer-egg data-sink-to=\{sinkTo\} aria-hidden="true">/);
  assert.match(drawing, /<svg class="swimmer-drawing" viewBox=\{viewBox\} aria-hidden="true" focusable="false">/);
  const svgs = [...island.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(svgs.length, 2);
  for (const tag of svgs) assert.match(tag, /focusable="false"/);
  for (const source of [island, drawing]) {
    assert.equal(/tabindex|role=|aria-label|<title|<button|<a\b/.test(source), false);
  }
});

test('the drawing: static, its arm pivot, mouth, slot before the arm, viewBox prop', () => {
  assert.equal(/<script/.test(drawing), false);
  assert.match(drawing, /const \{ viewBox = '0 0 24 46' \} = Astro\.props;/);
  assert.match(drawing, /<slot \/>\s*<path class="arm" data-arm /);
  assert.match(drawing, /class="mouth" data-mouth/);
  assert.match(drawing, /\.arm \{[^}]*transform-box: view-box;\s*transform-origin: 10\.4px 13\.6px;/);
  assert.match(drawing, /width: 18px;\s*height: 38px;/);
});

test('styles: right margin, opacity, sway, landed lean, sand fade, layers, hidden below 900px', () => {
  assert.match(island, /--swimmer-right: max\(12px, calc\(\(100vw - var\(--space-content-max\)\) \/ 2 - 2px\)\);/);
  assert.match(island, /\.figure \{[^}]*opacity: 0\.55;[^}]*pointer-events: none;/);
  assert.match(island, /:global\(:root\[data-theme='dark'\]\) \.figure \{\s*opacity: 0\.5;/);
  assert.match(island, /\.figure :global\(svg\) \{\s*pointer-events: auto;\s*cursor: default;/);
  assert.match(island, /\.motion \.figure :global\(svg\) \{\s*animation: swimmer-sway 3\.8s ease-in-out infinite alternate;/);
  assert.match(island, /from \{\s*transform: rotate\(-31deg\);\s*\}\s*to \{\s*transform: rotate\(-25deg\);/);
  assert.match(island, /\.landed \.figure :global\(svg\) \{\s*animation: none;\s*transform: rotate\(-6deg\);/);
  assert.match(island, /\.landed \.sand svg \{\s*opacity: 0\.8;/);
  assert.match(island, /:global\(:root\[data-theme='dark'\]\) \.landed \.sand svg \{\s*opacity: 0\.7;/);
  assert.match(island, /transition: opacity 0\.6s ease-out;/);
  assert.match(island, /\.bubbles :global\(i\) \{/);
  for (const layer of ['bubbles', 'sand', 'fish-box']) {
    assert.match(island, new RegExp(`\\.${layer} \\{[^}]*pointer-events: none;`), layer);
  }
  assert.match(island, /@media \(max-width: 899px\) \{\s*\.swimmer-egg \{\s*display: none;/);
});

test('the sprig ids are unique and named for the swimmer', () => {
  const ids = [...island.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? '');
  assert.deepEqual(ids, ['swimmer-sprig-flower', 'swimmer-sprig-leaf', 'swimmer-sprig-bud']);
  for (const id of ids) assert.match(island, new RegExp(`href="#${id}"`));
});

test('the home page mounts it after the closing line; no other page does', () => {
  const pagesDir = join(src, 'pages');
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const mounting = walk(pagesDir).filter((file) => /SwimmerEgg/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(mounting, [join(pagesDir, 'index.astro')]);
  assert.match(read('pages', 'index.astro'), /<ClosingLine \/>\s*<SwimmerEgg sinkTo="\.tl" \/>\s*<\/Base>/);
});

test('the client script imports nothing outside its own folder', () => {
  const scripts = [...island.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
  assert.equal(scripts.length, 1);
  let seen = 0;
  for (const [file, source] of Object.entries({ 'swimmer.ts': script, 'swimmer-core.ts': core, script: scripts[0] ?? '' })) {
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      assert.match(m[1] ?? '', /^\.\/[^/]+$/, `${file}: ${m[1]}`);
      seen += 1;
    }
  }
  assert.ok(seen >= 2);
  assert.equal(/\bdocument\.|\bwindow\.|getComputedStyle\(|performance\./.test(core), false, 'the core has no DOM');
});

test('no colour outside the tokens', () => {
  for (const source of [island, drawing, script, core]) {
    assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(source), false);
  }
});

test('window listeners are scroll and resize, both passive; no preventDefault, focus or keys', () => {
  const onWindow = [...script.matchAll(/window\.addEventListener\('(\w+)', (\w+), (\{[^}]*\})\)/g)].map((m) => [m[1], m[3]]);
  assert.deepEqual(onWindow, [
    ['scroll', '{ passive: true }'],
    ['resize', '{ passive: true }'],
  ]);
  assert.equal([...script.matchAll(/window\.addEventListener/g)].length, 2);
  assert.equal(/(?:document|documentElement|body)\s*\.\s*addEventListener/.test(script), false);
  assert.equal(/preventDefault|\.focus\(|\.blur\(|keydown|keyup|keypress|hashchange/.test(script), false);
  const all = [...script.matchAll(/(\w+)\.addEventListener\(\s*'(\w+)'/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(all, [
    'bubble:animationend',
    'run:finish',
    'run:finish',
    'drawing:mouseenter',
    'drawing:click',
    'window:scroll',
    'window:resize',
  ]);
});

test('the script writes nothing outside its root', () => {
  assert.equal(/document\.(?:body|documentElement)\.(?:classList|style|setAttribute|dataset)/.test(script), false);
  assert.equal(/data-theme|localStorage/.test(script), false);
  assert.equal(/appendChild/.test(script.replace(/bubbles\.appendChild/g, '')), false);
});
