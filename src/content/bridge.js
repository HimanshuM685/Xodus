/* =============================================================================
 * Xodus — bridge.js  (runs in the ISOLATED world content-script context)
 * -----------------------------------------------------------------------------
 * The "glue" between the page-world interceptor and the extension. It:
 *   1. Receives raw GraphQL response bodies from interceptor.js (postMessage).
 *   2. Hands them to XodusParser (xparser.js) for normalization.
 *   3. Dedupes by tweet_id and persists into chrome.storage.local.
 *   4. Drives the auto-scroll "Collect" loop on command from the popup.
 *
 * This file is intentionally free of X-response-shape knowledge — all of that
 * lives in xparser.js so contributors have a single brittle file to patch.
 * ===========================================================================*/
(function () {
  'use strict';

  const TAG = '__XODUS__';
  const BOOKMARKS_KEY = 'xodus_bookmarks'; // { [tweet_id]: bookmark }
  const STATUS_KEY = 'xodus_collect_status';

  let scrolling = false;

  // --- storage helpers -------------------------------------------------------
  function getBookmarksMap() {
    return new Promise((resolve) => {
      chrome.storage.local.get(BOOKMARKS_KEY, (res) => {
        resolve(res[BOOKMARKS_KEY] || {});
      });
    });
  }

  function setBookmarksMap(map) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [BOOKMARKS_KEY]: map }, resolve);
    });
  }

  function setStatus(status) {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { [STATUS_KEY]: { ...status, lastUpdated: Date.now() } },
        resolve
      );
    });
  }

  // --- ingest captured responses --------------------------------------------
  async function ingest(bodyText) {
    let json;
    try {
      json = JSON.parse(bodyText);
    } catch (_) {
      return; // not JSON we can use
    }
    const parsed = globalThis.XodusParser.parseBookmarksResponse(json);
    if (!parsed.length) return;

    const map = await getBookmarksMap();
    let added = 0;
    for (const bm of parsed) {
      if (!map[bm.tweet_id]) added++;
      // Always overwrite: a later capture may carry richer data than an earlier
      // one, and the id is stable so this never duplicates.
      map[bm.tweet_id] = bm;
    }
    await setBookmarksMap(map);

    const total = Object.keys(map).length;
    await setStatus({ count: total, state: scrolling ? 'collecting' : 'idle' });
    // Best-effort live update to an open popup (ignored if none is listening).
    chrome.runtime.sendMessage({
      type: 'XODUS_COLLECT_PROGRESS',
      count: total,
      added,
      state: scrolling ? 'collecting' : 'idle',
    }).catch(() => {});
  }

  // interceptor.js (MAIN world) posts here; we share the same DOM window.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== TAG) return;
    if (data.kind === 'graphql' && typeof data.body === 'string') {
      ingest(data.body);
    }
  });

  // --- auto-scroll collect loop ----------------------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function onBookmarksPage() {
    return /\/i\/bookmarks|\/bookmarks/.test(window.location.pathname);
  }

  async function countBookmarks() {
    const map = await getBookmarksMap();
    return Object.keys(map).length;
  }

  async function autoScroll() {
    if (scrolling) return;
    scrolling = true;
    await setStatus({ count: await countBookmarks(), state: 'collecting' });

    // We stop when the collected count hasn't grown for STABLE_LIMIT passes —
    // that means X has no more bookmark pages to load.
    const STABLE_LIMIT = 6;
    const STEP_DELAY = 1200; // ms; X lazy-loads, so give it time to fetch+render
    let lastCount = -1;
    let stable = 0;

    while (scrolling && stable < STABLE_LIMIT) {
      // Scroll a full viewport past the bottom to trigger the next fetch.
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(STEP_DELAY);

      const count = await countBookmarks();
      if (count === lastCount) {
        stable++;
      } else {
        stable = 0;
        lastCount = count;
      }
      await setStatus({ count, state: 'collecting' });
      chrome.runtime.sendMessage({
        type: 'XODUS_COLLECT_PROGRESS',
        count,
        state: 'collecting',
      }).catch(() => {});
    }

    const finalCount = await countBookmarks();
    const finishedNaturally = scrolling; // false if user pressed Stop
    scrolling = false;
    await setStatus({
      count: finalCount,
      state: finishedNaturally ? 'done' : 'stopped',
    });
    chrome.runtime.sendMessage({
      type: 'XODUS_COLLECT_PROGRESS',
      count: finalCount,
      state: finishedNaturally ? 'done' : 'stopped',
    }).catch(() => {});
  }

  // --- popup command channel -------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'XODUS_PING':
        // Popup uses this to verify a content script is present and whether the
        // user is on the bookmarks page.
        sendResponse({
          ok: true,
          onBookmarksPage: onBookmarksPage(),
          path: window.location.pathname,
        });
        return true;

      case 'XODUS_START_COLLECT':
        if (!onBookmarksPage()) {
          sendResponse({ ok: false, error: 'not_on_bookmarks_page' });
          return true;
        }
        autoScroll();
        sendResponse({ ok: true });
        return true;

      case 'XODUS_STOP_COLLECT':
        scrolling = false;
        sendResponse({ ok: true });
        return true;

      default:
        return;
    }
  });
})();
