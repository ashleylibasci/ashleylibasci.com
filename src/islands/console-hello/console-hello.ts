// Console hello behaviour. Leaf module (AD-5): imports only from its own
// folder. The only script that touches its carrier element (AD-18).
// One console.log per page load; no listeners, no globals.
import { helloArgs } from './hello-core.ts';

try {
  const href = document.querySelector<HTMLElement>('[data-console-hello]')?.dataset.href ?? '';
  if (href) {
    const style = getComputedStyle(document.documentElement);
    const token = (name: string): string => style.getPropertyValue(name);
    console.log(
      ...helloArgs(href, {
        display: token('--font-display'),
        body: token('--font-body'),
        teal: token('--color-egg-teal'),
      }),
    );
  }
} catch {
  // A console note is never worth an error on the page.
}
