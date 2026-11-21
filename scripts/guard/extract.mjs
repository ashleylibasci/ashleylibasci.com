// Text extraction for the privacy guard. Line breaks are kept so findings report real lines.

const blank = (s) => s.replace(/[^\n]/g, ' ');

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const ATTRS = /(?<![\w-])(alt|title|aria-label|placeholder|content)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** Visible text of an HTML page plus alt, title, aria-label, placeholder and meta content. */
export function htmlText(raw) {
  let s = raw
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1\s*>/gi, blank);
  s = s.replace(/<[^>]*>/g, (tag) => {
    const isMeta = /^<meta\b/i.test(tag);
    const vals = [...tag.matchAll(ATTRS)]
      .filter((m) => isMeta || m[1].toLowerCase() !== 'content')
      .map((m) => (m[2] ?? m[3]).replace(/\n/g, ' '));
    const newlines = '\n'.repeat((tag.match(/\n/g) || []).length);
    return ` ${vals.join(' ')} ${newlines}`;
  });
  return decodeEntities(s);
}

/** Markdown prose without fenced code blocks or inline code spans. */
export function markdownText(raw) {
  let fence = null;
  const source = raw
    .replace(/<(code|pre)\b[\s\S]*?<\/\1\s*>/gi, blank)
    .replace(/(\]\()([^)\s]*)/g, (m, open, url) => open + blank(url));
  return source
    .split('\n')
    .map((line) => {
      const m = line.match(/^\s*(`{3,}|~{3,})/);
      if (fence) {
        if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
        return blank(line);
      }
      if (m) {
        fence = m[1];
        return blank(line);
      }
      return line.replace(/(`+)[^`]*?\1/g, blank);
    })
    .join('\n');
}

/** Text of each PDF page, using unpdf (pure JavaScript pdf.js, no native code). */
export async function pdfPages(buffer) {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(doc, { mergePages: false });
  return text;
}
