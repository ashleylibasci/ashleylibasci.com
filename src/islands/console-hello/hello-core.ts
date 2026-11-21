// Console hello logic with no DOM in it, so Node can test the text and the
// styles. The DOM script reads the tokens and the link, then logs what this
// returns in one console.log call.

export const GREETING = 'Hi! Nice to see you.';
export const LEAD = 'Go check out my project code at ';

/** Token values read from the page at log time; any of them may be empty. */
export interface HelloTokens {
  display: string;
  body: string;
  teal: string;
}

/**
 * The console.log arguments: one format string with three %c segments, then
 * the greeting style, the line-2 style and the link style. The text lines set
 * no colour, so they take the console's own text colour in light and dark.
 */
export function helloArgs(href: string, tokens: HelloTokens): [string, string, string, string] {
  // The plain family names come first: the tokens hold Astro's hashed names,
  // which the devtools console never loads, so they only serve as fallbacks.
  const display = `Marcellus,${tokens.display.trim() || 'serif'}`;
  const body = `"Albert Sans",${tokens.body.trim() || 'sans-serif'}`;
  const teal = tokens.teal.trim();
  const format = `%c${GREETING}\n%c${LEAD}%c${href}`;
  const greeting = `font-family:${display};font-size:15px;line-height:1.6`;
  const line = `font-family:${body};font-size:13px;line-height:1.6`;
  const link = `${line}${teal ? `;color:${teal}` : ''};text-decoration:underline`;
  return [format, greeting, line, link];
}
