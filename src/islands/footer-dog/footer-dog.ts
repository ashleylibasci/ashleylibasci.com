// Footer dog behaviour. Leaf module (AD-5): imports only from its own folder.
// The only writer of the dog, its hurdle and its poles (AD-18). It listens on
// the dog alone, moves no focus, and reads the theme through CSS only.
import { createDog, freeWidth, type Frame, type PlayOptions, type Played, type Stage } from './dog-core.ts';

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

for (const root of document.querySelectorAll<HTMLElement>('[data-footer-dog]')) {
  const dog = root.querySelector<HTMLElement>('[data-dog]');
  const hurdle = root.querySelector<HTMLElement>('[data-hurdle]');
  const poles = root.querySelector<HTMLElement>('[data-poles]');
  if (!dog || !hurdle || !poles) continue;
  const posts = [...poles.querySelectorAll<HTMLElement>('i')];

  const stage: Stage = {
    still: () => reducedMotion() || typeof dog.animate !== 'function',
    matrix: () => getComputedStyle(dog).transform,
    free() {
      const box = root.getBoundingClientRect();
      const row = root.closest('[data-dog-row]');
      if (!row) return document.documentElement.clientWidth - box.left;
      const inner = row.getBoundingClientRect().right - (Number.parseFloat(getComputedStyle(row).paddingRight) || 0);
      const last = row.lastElementChild;
      const neighbour = last && !last.contains(root) ? last.getBoundingClientRect() : null;
      return freeWidth(box, inner, neighbour);
    },
    hurdle(up) {
      hurdle.classList.toggle('up', up);
    },
    play(frames: Frame[], options: PlayOptions, finished?: () => void): Played {
      const animation = dog.animate(frames, { ...options, fill: 'both' });
      if (finished) animation.addEventListener('finish', finished, { once: true });
      return animation;
    },
    stop() {
      if (typeof dog.getAnimations !== 'function') return;
      for (const animation of dog.getAnimations()) animation.cancel();
    },
    polesUp(places) {
      posts.forEach((post, i) => {
        const at = places[i];
        post.style.left = at === undefined ? '' : `${(at - 0.6).toFixed(1)}px`;
      });
      void poles.offsetWidth;
      poles.classList.add('on');
    },
    polesDown() {
      poles.classList.remove('on');
    },
    polesClear() {
      poles.classList.remove('on');
      for (const post of posts) post.style.left = '';
    },
    sit(on) {
      root.classList.toggle('sit', on);
    },
    place(x) {
      dog.style.transform = x === null ? '' : `translate(${x.toFixed(1)}px,0)`;
    },
    awake(on) {
      root.classList.toggle('awake', on);
    },
  };

  const { tap } = createDog(stage, {
    now: () => Date.now(),
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout> | undefined),
  });

  root.addEventListener('click', tap);
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!event.repeat) tap();
  });
}
