// Menu sheet behaviour. Leaf module (AD-5): imports nothing, touches only its own DOM.
const button = document.getElementById('menu-btn');
const sheet = document.getElementById('menu-sheet');
const closeButton = document.getElementById('menu-close');

if (button instanceof HTMLButtonElement && sheet instanceof HTMLDialogElement && closeButton instanceof HTMLButtonElement) {
  // Whether closing should return focus to the Menu button.
  let returnFocus = true;

  const open = (): void => {
    if (sheet.open) return;
    returnFocus = true;
    sheet.showModal();
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('locked');
    closeButton.focus();
  };

  const close = (back: boolean): void => {
    if (!sheet.open) return;
    returnFocus = back;
    sheet.close();
  };

  // Every way the dialog closes (Close, Escape, link, widen) ends here.
  sheet.addEventListener('close', () => {
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('locked');
    if (returnFocus) button.focus();
  });

  button.addEventListener('click', open);
  closeButton.addEventListener('click', () => close(true));

  // Escape: let the native cancel close the dialog; focus goes back to Menu.
  sheet.addEventListener('cancel', () => {
    returnFocus = true;
  });

  // Keep Tab inside the sheet.
  sheet.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // A link closes the sheet; the browser then does a full page load.
  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a')) close(false);
  });

  // Widening past the phone breakpoint closes the sheet.
  const wide = window.matchMedia('(min-width: 761px)');
  wide.addEventListener('change', () => {
    if (wide.matches) close(false);
  });
}
