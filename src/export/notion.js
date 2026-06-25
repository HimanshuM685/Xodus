/* =============================================================================
 * Xodus — notion.js  (ES module; runs in the service worker)
 * -----------------------------------------------------------------------------
 * Pushes collected bookmarks into the user's own Notion workspace using a
 * "bring your own token" internal integration. NOTHING here phones home — the
 * only network calls are to https://api.notion.com using the user's token.
 *
 * Flow:
 *   - First push under a parent page: create a database with our schema and
 *     persist the returned database_id so later pushes APPEND (no duplicates).
 *   - Each bookmark becomes one page in that database.
 *   - We respect Notion's ~3 requests/second limit and retry on HTTP 429.
 *
 * Notion API version is pinned; bump NOTION_VERSION if Notion deprecates it.
 * Docs: https://developers.notion.com/reference/intro
 * ===========================================================================*/

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const DB_TITLE = 'Xodus — X Bookmarks';

// ~3 req/sec → space requests ~350ms apart. Tune if you see sustained 429s.
const REQUEST_SPACING_MS = 350;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/**
 * fetch wrapper with 429 handling. Honors Notion's Retry-After header and
 * retries on 429 / 5xx with exponential backoff up to MAX_RETRIES.
 */
async function notionFetch(path, options) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(`${NOTION_API}${path}`, options);
    if (res.status !== 429 && res.status < 500) return res;

    attempt++;
    if (attempt > MAX_RETRIES) return res; // give up; caller inspects status

    const retryAfter = parseFloat(res.headers.get('Retry-After') || '0');
    const backoff = retryAfter > 0
      ? retryAfter * 1000
      : Math.min(1000 * 2 ** (attempt - 1), 10000);
    await sleep(backoff);
  }
}

// --- schema -----------------------------------------------------------------
function databaseSchema(parentPageId) {
  return {
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: DB_TITLE } }],
    properties: {
      Title: { title: {} },
      Author: { rich_text: {} },
      Date: { date: {} },
      'Tweet Link': { url: {} },
      Text: { rich_text: {} },
      Media: { url: {} },
      Thread: { checkbox: {} },
    },
  };
}

/** Create the Xodus database under a parent page; returns its id. */
async function createDatabase(token, parentPageId) {
  const res = await notionFetch('/databases', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(databaseSchema(parentPageId)),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(`Notion: could not create database — ${msg}`);
  }
  return json.id;
}

// --- per-bookmark page mapping ----------------------------------------------
function snippet(text, max = 60) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '(no text)';
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…';
}

/** Notion rich_text content is capped at 2000 chars per text object. */
function richText(value) {
  const s = (value || '').slice(0, 2000);
  return s ? [{ type: 'text', text: { content: s } }] : [];
}

/** Convert X's created_at ("Wed Oct 10 20:19:24 +0000 2018") to ISO 8601. */
function toIsoDate(created_at) {
  if (!created_at) return null;
  const d = new Date(created_at);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function pageForBookmark(databaseId, bm) {
  const properties = {
    Title: { title: [{ type: 'text', text: { content: snippet(bm.text) } }] },
    Author: {
      rich_text: richText(
        bm.author_handle
          ? `@${bm.author_handle} · ${bm.author_name || ''}`.trim()
          : bm.author_name || ''
      ),
    },
    'Tweet Link': { url: bm.url || null },
    Text: { rich_text: richText(bm.text) },
    Thread: { checkbox: !!bm.is_thread },
  };

  const iso = toIsoDate(bm.created_at);
  if (iso) properties.Date = { date: { start: iso } };

  const media = (bm.media_urls && bm.media_urls[0]) || '';
  // Notion rejects an empty-string url; only set the property if we have one.
  if (media) properties.Media = { url: media };

  return {
    parent: { database_id: databaseId },
    properties,
  };
}

async function createPage(token, databaseId, bm) {
  const res = await notionFetch('/pages', {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(pageForBookmark(databaseId, bm)),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg = json && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
}

/**
 * Push all bookmarks to Notion.
 *
 * @param {object}   opts
 * @param {string}   opts.token        Notion internal integration token.
 * @param {string}   opts.parentPageId Parent page id (shared with integration).
 * @param {string}   [opts.databaseId] Existing db to append to (skip create).
 * @param {boolean}  [opts.forceNewDatabase] Create a fresh db even if one exists.
 * @param {object[]} opts.bookmarks    Normalized bookmarks to push.
 * @param {function} [opts.onProgress] Called with {pushed, failed, total, databaseId}.
 * @returns {Promise<{pushed:number, failed:number, total:number, databaseId:string}>}
 */
export async function pushToNotion(opts) {
  const { token, parentPageId, bookmarks, onProgress } = opts;

  if (!token) throw new Error('Missing Notion integration token.');
  if (!bookmarks || !bookmarks.length) throw new Error('No bookmarks to push.');

  let databaseId = opts.databaseId;
  if (!databaseId || opts.forceNewDatabase) {
    if (!parentPageId) {
      throw new Error('Missing Notion parent page id (needed to create the database).');
    }
    databaseId = await createDatabase(token, parentPageId);
    await sleep(REQUEST_SPACING_MS);
  }

  const total = bookmarks.length;
  let pushed = 0;
  let failed = 0;

  for (const bm of bookmarks) {
    try {
      await createPage(token, databaseId, bm);
      pushed++;
    } catch (_) {
      failed++;
    }
    if (onProgress) onProgress({ pushed, failed, total, databaseId });
    await sleep(REQUEST_SPACING_MS); // stay under ~3 req/sec
  }

  return { pushed, failed, total, databaseId };
}
