// The footer year in Roman numerals: the pure core, testable in Node.
const NUMERALS: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Standard subtractive form, or null for anything that is not an integer 1 to 3999. */
export function toRoman(year: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 3999) return null;
  let rest = year;
  let out = '';
  for (const [value, symbol] of NUMERALS) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

/** The Roman form of an element's text, or null when the text is not a plain year. */
export function romanFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return toRoman(Number(trimmed));
}
