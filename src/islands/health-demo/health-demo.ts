// Health Dashboard Demo behaviour. Leaf module (AD-5): imports only from its own
// folder, touches only its own DOM. The markup already holds the default answer,
// so everything here only follows what the visitor chooses.
import { EXAMS, MODES, SCREENS, clock, nextTab, plan } from './demo-core.ts';

/** Sets text only when it differs, so a live region is not announced for nothing. */
function write(element: Element | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

for (const demo of document.querySelectorAll<HTMLElement>('[data-health-demo]')) {
  // ---- Tabs: automatic activation, one tab stop.
  const tabs = [...demo.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panelOf = (tab: HTMLElement): HTMLElement | null =>
    document.getElementById(tab.getAttribute('aria-controls') ?? '');

  const pickTab = (index: number, focus: boolean): void => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      const panel = panelOf(tab);
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[index]?.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => pickTab(i, false));
    tab.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const next = nextTab(event.key, i, tabs.length);
      if (next === null) return;
      event.preventDefault();
      pickTab(next, true);
    });
  });

  // ---- Exam night: the two choices give the two times.
  const examPanel = demo.querySelector<HTMLElement>('[data-panel="exam"]');
  const trace = demo.querySelector<SVGElement>('[data-trace]');

  const showPlan = (): boolean => {
    const exam = Number(demo.querySelector<HTMLInputElement>('input[data-choice="exam"]:checked')?.value);
    const mode = MODES.find(
      (m) => m.value === demo.querySelector<HTMLInputElement>('input[data-choice="mode"]:checked')?.value,
    );
    if (!mode || !EXAMS.some((e) => e.value === exam)) return false;
    const { wake, bed } = plan(exam, mode.value);
    for (const [name, minutes] of [['wake', wake], ['bed', bed]] as const) {
      const { time, period } = clock(minutes);
      write(demo.querySelector(`[data-out="${name}-time"]`), time);
      write(demo.querySelector(`[data-out="${name}-period"]`), period);
    }
    return true;
  };

  const redraw = (): void => {
    if (!trace || reducedMotion()) return;
    trace.classList.remove('again');
    void trace.getBoundingClientRect(); // restart the animation
    trace.classList.add('again');
  };

  examPanel?.addEventListener('change', () => {
    if (showPlan()) redraw();
  });

  // ---- On the phone: one of the two screenshots and its caption.
  const phonePanel = demo.querySelector<HTMLElement>('[data-panel="phone"]');
  const shots = [...demo.querySelectorAll<HTMLElement>('[data-screen]')];
  const caption = demo.querySelector<HTMLElement>('[data-caption]');

  const showScreen = (): void => {
    const value = demo.querySelector<HTMLInputElement>('input[data-choice="screen"]:checked')?.value;
    const screen = SCREENS.find((s) => s.value === value);
    if (!screen) return;
    for (const shot of shots) {
      const on = shot.dataset.screen === screen.value;
      shot.classList.toggle('on', on);
      if (on) shot.removeAttribute('aria-hidden');
      else shot.setAttribute('aria-hidden', 'true');
    }
    write(caption, screen.caption);
  };

  phonePanel?.addEventListener('change', showScreen);

  // ---- A reload or the back button can bring back earlier choices: follow them, without a redraw.
  const sync = (): void => {
    showPlan();
    showScreen();
  };
  sync();
  window.addEventListener('pageshow', sync);
}
