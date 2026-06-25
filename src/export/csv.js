/* =============================================================================
 * Xodus — csv.js  (ES module)
 * -----------------------------------------------------------------------------
 * The always-works fallback export. Produces an RFC-4180-style UTF-8 CSV that
 * imports cleanly into Excel, Google Sheets ("File → Import"), Numbers, etc.
 * ===========================================================================*/

const COLUMNS = [
  'tweet_id',
  'url',
  'author_handle',
  'author_name',
  'text',
  'created_at',
  'media_urls',
  'is_thread',
  'quoted_tweet_url',
];

/** Escape a single field per RFC 4180: wrap in quotes, double inner quotes. */
function escapeField(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // Always quote — simplest correct behaviour, and handles commas, quotes,
  // newlines and leading/trailing whitespace in tweet text uniformly.
  return '"' + s.replace(/"/g, '""') + '"';
}

function rowFor(bm) {
  return COLUMNS.map((col) => {
    if (col === 'media_urls') {
      return escapeField((bm.media_urls || []).join(' '));
    }
    if (col === 'is_thread') {
      return escapeField(bm.is_thread ? 'true' : 'false');
    }
    return escapeField(bm[col]);
  }).join(',');
}

/** Build the full CSV text (with a leading UTF-8 BOM for Excel friendliness). */
export function toCsv(bookmarks) {
  const lines = [COLUMNS.join(',')];
  for (const bm of bookmarks) lines.push(rowFor(bm));
  // ﻿ BOM makes Excel respect UTF-8; CRLF line endings per the CSV spec.
  return '﻿' + lines.join('\r\n');
}

/** Trigger a browser download of the CSV. Returns the filename used. */
export function downloadCsv(bookmarks) {
  const csv = toCsv(bookmarks);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `xodus-bookmarks-${stamp}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke shortly after to let the download start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
