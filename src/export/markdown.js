/* =============================================================================
 * Xodus — markdown.js  (ES module)
 * -----------------------------------------------------------------------------
 * Produces a bulleted Markdown list, handy for pasting into notes apps, GitHub
 * issues, or anywhere that renders Markdown.
 * ===========================================================================*/

/** Collapse whitespace and trim a tweet to a short, single-line snippet. */
function snippet(text, max = 100) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + '…';
}

/** Escape characters that would break Markdown link text. */
function escapeLinkText(s) {
  return s.replace(/([\[\]])/g, '\\$1');
}

export function toMarkdown(bookmarks) {
  const lines = bookmarks.map((bm) => {
    const handle = bm.author_handle ? `@${bm.author_handle}` : 'unknown';
    const label = escapeLinkText(`${handle} — ${snippet(bm.text)}`);
    return `- [${label}](${bm.url})`;
  });
  return lines.join('\n');
}
