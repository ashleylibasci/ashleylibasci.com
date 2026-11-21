// Theme toggle behaviour. Leaf module (AD-5): imports nothing.
// The only runtime writer of <html data-theme> and the only writer of al-theme (AD-7).
const root = document.documentElement;
const toggles = document.querySelectorAll<HTMLButtonElement>('button[data-theme-toggle]');

const isDark = (): boolean => root.getAttribute('data-theme') === 'dark';

const sync = (): void => {
  const dark = isDark();
  for (const toggle of toggles) {
    toggle.textContent = dark ? 'Light' : 'Dark';
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
};

for (const toggle of toggles) {
  toggle.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('al-theme', next);
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  });
}

// Every instance follows the attribute, whichever toggle changed it.
new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
sync();
