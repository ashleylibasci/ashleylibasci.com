// Swimmer behaviour. Leaf module (AD-5): imports only from its own folder.
// The only writer of the swimmer's position, its turn, its arm, the bubbles,
// the sand's landed state and the fish (AD-18). It reads the header height and
// the end element's position but writes nothing outside its own root. Window
// listeners are scroll and resize, both passive; it moves no focus.
import {
  FISH_MS,
  IDLE_MS,
  SCENE_DELAY_MS,
  STILL_FISH_MS,
  STILL_HOLD,
  STILL_TURN,
  STILL_TURN_MS,
  STILL_WAVE,
  STILL_WAVE_MS,
  TAP_WINDOW_MS,
  TURN_EASING,
  TURN_MS,
  TURN_TAPS,
  WAVE_AT_MS,
  WAVE_MS,
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
  sinkTarget,
  smoothVelocity,
  stillFishPlace,
  turnFrames,
  waveFrames,
} from './swimmer-core.ts';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface Parts {
  root: HTMLElement;
  figure: HTMLElement;
  drawing: SVGSVGElement;
  arm: SVGElement;
  mouth: SVGElement;
  bubbles: HTMLElement;
  sand: HTMLElement;
  fish: HTMLElement;
}

function find(root: HTMLElement): Parts | null {
  const figure = root.querySelector<HTMLElement>('[data-figure]');
  const drawing = figure?.querySelector<SVGSVGElement>('svg');
  const arm = drawing?.querySelector<SVGElement>('[data-arm]');
  const mouth = drawing?.querySelector<SVGElement>('[data-mouth]');
  const bubbles = root.querySelector<HTMLElement>('[data-bubbles]');
  const sand = root.querySelector<HTMLElement>('[data-sand]');
  const fish = root.querySelector<HTMLElement>('[data-fish]');
  if (!figure || !drawing || !arm || !mouth || !bubbles || !sand || !fish) return null;
  return { root, figure, drawing, arm, mouth, bubbles, sand, fish };
}

function start({ root, figure, drawing, arm, mouth, bubbles, sand, fish }: Parts): void {
  const sinkTo = root.dataset.sinkTo ?? '';

  let y: number | null = null;
  let lastScroll = window.scrollY;
  let velocity = 0;
  let lastPuff = 0;
  let raf = 0;
  let landed = false;
  let settledDown = false;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let fishRun: Animation | null = null;
  let waveRun: Animation | null = null;
  let turnRun: Animation | null = null;
  let turnTimer: ReturnType<typeof setTimeout> | undefined;

  const still = (): boolean => reducedMotion() || typeof drawing.animate !== 'function';
  const hidden = (): boolean => getComputedStyle(root).display === 'none';
  const later = (run: () => void, ms: number): void => {
    timers.push(setTimeout(run, ms));
  };

  function nav(): number {
    const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav'));
    return Number.isFinite(value) ? value : 0;
  }

  function endTop(): number | null {
    if (!sinkTo) return null;
    try {
      const end = document.querySelector(sinkTo);
      return end ? end.getBoundingClientRect().top : null;
    } catch {
      return null;
    }
  }

  function target(): number {
    if (landed) return landingY(sand.getBoundingClientRect().top);
    return sinkTarget({
      nav: nav(),
      height: window.innerHeight,
      scrollY: window.scrollY,
      endTop: endTop(),
      scrollHeight: document.documentElement.scrollHeight,
    });
  }

  function puff(n: number, spread: number): void {
    if (still() || hidden()) return;
    const box = mouth.getBoundingClientRect();
    const x = box.left + box.width / 2 - 1.5;
    const top = box.top - 2;
    for (const spec of bubbleSpecs(n, spread, Math.random)) {
      const bubble = document.createElement('i');
      bubble.style.width = bubble.style.height = `${spec.size.toFixed(1)}px`;
      bubble.style.left = `${(x + spec.x).toFixed(1)}px`;
      bubble.style.top = `${top.toFixed(1)}px`;
      bubble.style.setProperty('--dx', `${spec.dx.toFixed(1)}px`);
      bubble.style.setProperty('--dy', `${spec.dy.toFixed(1)}px`);
      bubble.style.animationDelay = `${spec.delay.toFixed(0)}ms`;
      bubble.addEventListener('animationend', () => bubble.remove(), { once: true });
      bubbles.appendChild(bubble);
    }
  }

  function resetScene(): void {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    fishRun?.cancel();
    fishRun = null;
    fish.style.transform = '';
    fish.style.opacity = '';
    waveRun?.cancel();
    waveRun = null;
    arm.style.transform = '';
  }

  function setLanded(on: boolean): void {
    if (on === landed) return;
    landed = on;
    root.classList.toggle('landed', on);
    if (!on) {
      settledDown = false;
      resetScene();
    }
  }

  function wave(): void {
    if (still()) {
      arm.style.transform = STILL_WAVE;
      later(() => {
        arm.style.transform = '';
      }, STILL_WAVE_MS);
      return;
    }
    waveRun?.cancel();
    waveRun = arm.animate(waveFrames(), { duration: WAVE_MS, easing: 'ease-in-out' });
  }

  function playScene(): void {
    const box = drawing.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2 + 2;
    if (still()) {
      fish.style.transform = stillFishPlace(cx, cy);
      fish.style.opacity = '.85';
      wave();
      later(() => {
        fish.style.opacity = '';
      }, STILL_FISH_MS);
      return;
    }
    fishRun?.cancel();
    const run = fish.animate(fishFrames(cx, cy, window.innerWidth), { duration: FISH_MS, easing: 'linear', fill: 'both' });
    fishRun = run;
    run.addEventListener(
      'finish',
      () => {
        run.cancel();
        if (fishRun === run) fishRun = null;
      },
      { once: true },
    );
    later(wave, WAVE_AT_MS);
  }

  function frame(): void {
    raf = 0;
    if (hidden() || still()) {
      update();
      return;
    }
    setLanded(atEnd(window.scrollY, window.innerHeight, document.documentElement.scrollHeight));
    const goal = target();
    y = easeStep(y, goal);
    const scroll = window.scrollY;
    velocity = smoothVelocity(velocity, scroll - lastScroll);
    lastScroll = scroll;
    figure.style.transform = `translate(0px,${y.toFixed(1)}px)`;
    if (landed && !settledDown && settled(goal, y)) {
      settledDown = true;
      later(playScene, SCENE_DELAY_MS);
    }
    const now = performance.now();
    if (scrollPuff(velocity, now, lastPuff)) {
      lastPuff = now;
      puff(puffCount(Math.random, 0.5), 0);
    }
    if (keepRunning(goal, y, velocity)) raf = requestAnimationFrame(frame);
  }

  // No motion: the figure holds, or jumps onto the sand at the end.
  function hold(): void {
    y = null;
    lastScroll = window.scrollY;
    velocity = 0;
    setLanded(atEnd(window.scrollY, window.innerHeight, document.documentElement.scrollHeight));
    figure.style.transform = landed ? `translate(0px,${target().toFixed(1)}px)` : `translate(0px,${STILL_HOLD})`;
    if (landed && !settledDown) {
      settledDown = true;
      playScene();
    }
  }

  // Stops everything the script set going: the frame loop, the scene, the turn and the bubbles.
  function quiet(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    resetScene();
    clearTimeout(turnTimer);
    turnRun?.cancel();
    turnRun = null;
    drawing.style.transform = '';
    bubbles.replaceChildren();
    settledDown = false;
    y = null;
  }

  let mode: 'hidden' | 'still' | 'motion' | null = null;

  function update(): void {
    if (hidden()) {
      // Once, on the way out: off the sand, scene cleared, then no work.
      if (mode !== 'hidden') {
        mode = 'hidden';
        root.classList.remove('motion');
        setLanded(false);
        quiet();
      }
      return;
    }
    const calm = still();
    const next = calm ? 'still' : 'motion';
    // Into the still version: drop whatever is playing, then show the still scene.
    if (calm && mode === 'motion') quiet();
    mode = next;
    root.classList.toggle('motion', !calm);
    if (calm) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      hold();
      return;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function somersault(): void {
    clearTimeout(turnTimer);
    turnRun?.cancel();
    turnRun = null;
    if (still()) {
      drawing.style.transform = STILL_TURN;
      turnTimer = setTimeout(() => {
        drawing.style.transform = '';
      }, STILL_TURN_MS);
      return;
    }
    drawing.style.transform = '';
    const run = drawing.animate(turnFrames(landed), { duration: TURN_MS, easing: TURN_EASING });
    turnRun = run;
    run.addEventListener(
      'finish',
      () => {
        if (turnRun === run) turnRun = null;
        puff(4, 8);
      },
      { once: true },
    );
  }

  const tapped = createTapWindow(TURN_TAPS, TAP_WINDOW_MS, { now: () => Date.now() });

  drawing.addEventListener('mouseenter', () => puff(7, 10));
  drawing.addEventListener('click', () => {
    if (still() && mode === 'motion') update();
    puff(8, 12);
    if (tapped()) somersault();
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  // Now and then, a few bubbles.
  setInterval(() => {
    if (document.hidden || hidden() || still()) return;
    puff(puffCount(Math.random, 0.4), 0);
  }, IDLE_MS);

  update();
}

const found = document.querySelector<HTMLElement>('[data-swimmer-egg]');
const parts = found ? find(found) : null;
if (parts) start(parts);
