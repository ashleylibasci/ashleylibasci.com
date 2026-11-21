// Secret code behaviour. Leaf module (AD-5): imports only from its own folder.
// The only writer of the island's bubble layer (AD-18). One passive key
// listener on the window: it never cancels, stops or moves focus.
import { bubbles, clearAfter, createMatcher } from './code-core.ts';

const layer = document.querySelector<HTMLElement>('[data-secret-code]');

if (layer) {
  const step = createMatcher();
  let timer: number | undefined;

  const show = (): void => {
    let still = false;
    try {
      still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      still = false;
    }
    const nodes = bubbles(Math.random, still).map((spec) => {
      const bubble = document.createElement('i');
      bubble.style.width = spec.size;
      bubble.style.height = spec.size;
      bubble.style.left = spec.left;
      if (spec.top) bubble.style.top = spec.top;
      if (spec.vars) {
        for (const [name, value] of Object.entries(spec.vars)) bubble.style.setProperty(name, value);
      }
      return bubble;
    });
    window.clearTimeout(timer);
    layer.classList.toggle('still', still);
    layer.replaceChildren(...nodes);
    timer = window.setTimeout(() => {
      layer.replaceChildren();
      layer.classList.remove('still');
    }, clearAfter(still));
  };

  window.addEventListener(
    'keydown',
    (event) => {
      if (step(event)) show();
    },
    { passive: true },
  );
}

// Let key presses reach the page from the start: take window focus only when
// nothing else has it, so a heading focused by page-focus keeps its focus.
const grab = (): void => {
  try {
    const active = document.activeElement;
    if (!active || active === document.body) window.focus();
  } catch {
    // Some embedders refuse window focus; the code still works once the page is clicked.
  }
};
grab();
window.addEventListener('load', grab);
