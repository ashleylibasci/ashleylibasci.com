// The footer year turns Roman while hovered. Leaf module (AD-5): imports only from
// its own folder and is the only writer of the year element (AD-18).
import { romanFromText } from './roman-core.ts';

for (const year of document.querySelectorAll<HTMLElement>('[data-roman-year]')) {
  const plain = year.textContent ?? '';
  const roman = romanFromText(plain);
  if (roman === null) continue;

  const show = (text: string): void => {
    if (year.textContent !== text) year.textContent = text;
  };

  year.addEventListener('mouseenter', () => show(roman));
  year.addEventListener('mouseleave', () => show(plain));
}
