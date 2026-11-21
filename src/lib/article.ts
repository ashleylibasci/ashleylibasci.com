// Splits the HTML of a Markdown write-up into the parts an inner page lays out: the lead
// before the first h2, then one section per h2. In the lead or a section, a paragraph that
// starts with [[figure:name]] is a figure, and the rest of that paragraph is its caption.
// Pure and type-erasable: the tests import this file directly, so no Astro imports and no enums.

export type ArticlePart =
  | { kind: 'html'; html: string }
  | { kind: 'figure'; name: string; caption: string };

export interface ArticleSection {
  /** The heading's id, from the Markdown processor, or made from its words. */
  id: string;
  /** The heading's inner HTML. */
  heading: string;
  parts: ArticlePart[];
}

export interface Article {
  /** The lead's HTML, without its figures. */
  lead: string;
  /** The lead in order, figures included. */
  leadParts: ArticlePart[];
  sections: ArticleSection[];
}

const H2 = /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g;
const FIGURE = /<p>\s*\[\[figure:([^\]]*)\]\]\s*([\s\S]*?)<\/p>/g;
const MARKER = '[[figure:';

const slug = (heading: string) =>
  heading
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// A marker that is left over did not start a paragraph, so it would print as text.
function plain(html: string, where: string): string {
  if (html.includes(MARKER)) {
    throw new Error(`article: a figure marker in ${where} does not start its own paragraph`);
  }
  return html.trim();
}

function parts(body: string, where: string): ArticlePart[] {
  const out: ArticlePart[] = [];
  const push = (html: string) => {
    const text = plain(html, where);
    if (text) out.push({ kind: 'html', html: text });
  };
  let from = 0;
  for (const match of body.matchAll(FIGURE)) {
    push(body.slice(from, match.index));
    const name = match[1];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`article: "${name}" in ${where} is not a figure name`);
    }
    out.push({ kind: 'figure', name, caption: match[2].trim() });
    from = match.index + match[0].length;
  }
  push(body.slice(from));
  return out;
}

/** The lead and the sections of a write-up. Without an h2, all of it is the lead. */
export function splitArticle(html: string): Article {
  const headings = [...html.matchAll(H2)];
  const leadParts = parts(html.slice(0, headings[0]?.index ?? html.length), 'the lead');
  const lead = leadParts.flatMap((part) => (part.kind === 'html' ? [part.html] : [])).join('\n');
  const sections = headings.map((match, index) => {
    const heading = match[2].trim();
    const id = match[1]?.match(/\sid="([^"]+)"/)?.[1] ?? slug(heading);
    const body = html.slice(match.index + match[0].length, headings[index + 1]?.index ?? html.length);
    return { id, heading, parts: parts(body, `the section "${id}"`) };
  });
  return { lead, leadParts, sections };
}

/** The names of the figures a write-up places, in order: the lead's, then each section's. */
export function figureNames(article: Article): string[] {
  return [article.leadParts, ...article.sections.map((section) => section.parts)].flatMap((parts) =>
    parts.flatMap((part) => (part.kind === 'figure' ? [part.name] : [])),
  );
}

/**
 * Throws unless the write-up places every figure in `known` exactly once and names no other.
 * `page` names the page in the message.
 */
export function checkFigures(article: Article, known: readonly string[], page: string): void {
  const used = figureNames(article);
  for (const name of used) {
    if (!known.includes(name)) throw new Error(`${page}: the write-up names an unknown figure "${name}"`);
  }
  for (const name of known) {
    const count = used.filter((other) => other === name).length;
    if (count === 0) throw new Error(`${page}: the write-up never uses the figure "${name}"`);
    if (count > 1) throw new Error(`${page}: the write-up uses the figure "${name}" ${count} times`);
  }
}
