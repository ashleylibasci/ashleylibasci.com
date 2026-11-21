// Copy email behaviour. Leaf module (AD-5): imports only from its own folder,
// touches only its own DOM. The address copied is the link's own text.
import { COPY_STATES, copyAddress, resetScheduler, type ClipboardLike, type CopyState } from './copy-core.ts';

for (const group of document.querySelectorAll<HTMLElement>('[data-copy-email]')) {
  const link = group.querySelector<HTMLAnchorElement>('a');
  const button = group.querySelector<HTMLButtonElement>('button');
  const status = group.querySelector<HTMLElement>('[role="status"]');
  if (!link || !button || !status) continue;

  const show = (state: CopyState): void => {
    button.textContent = COPY_STATES[state].label;
    button.classList.toggle('ok', state === 'copied');
    status.textContent = COPY_STATES[state].announcement;
  };

  const scheduleReset = resetScheduler(() => show('idle'));

  const selectAddress = (): void => {
    const range = document.createRange();
    range.selectNodeContents(link);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  button.addEventListener('click', () => {
    let clipboard: ClipboardLike | undefined;
    try {
      clipboard = navigator.clipboard;
    } catch {
      clipboard = undefined;
    }
    void copyAddress((link.textContent ?? '').trim(), clipboard, selectAddress).then((state) => {
      show(state);
      scheduleReset();
    });
  });
}
