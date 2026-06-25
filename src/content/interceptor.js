/* =============================================================================
 * Xodus — interceptor.js  (runs in the page's MAIN world)
 * -----------------------------------------------------------------------------
 * BRITTLE X-FRONTEND TOUCHPOINT #1 of 2 (the other is xparser.js).
 *
 * WHAT THIS DOES
 *   X's own web app talks to its private GraphQL API to render your bookmarks.
 *   We do NOT make those requests ourselves and we do NOT use any X API key.
 *   Instead we monkey-patch `fetch` and `XMLHttpRequest` so that, when X's
 *   frontend fetches a page of bookmarks, we get a *copy* of the response body
 *   and forward it to the isolated-world bridge via window.postMessage.
 *
 * WHY MAIN WORLD
 *   Content scripts normally run in an "isolated world" and cannot see or patch
 *   the page's real `window.fetch`. Manifest V3's `"world": "MAIN"` lets this
 *   file run in the page context so the patch actually intercepts X's traffic.
 *   It is injected at document_start so we patch fetch BEFORE X uses it.
 *
 * IF XODUS STOPS COLLECTING
 *   1. Confirm the bookmarks GraphQL operation is still named "Bookmarks".
 *      Open DevTools → Network → filter "graphql" → scroll the bookmarks page →
 *      look at the request URLs. Update XODUS_BOOKMARKS_MATCH below if renamed.
 *   2. The response *shape* is parsed in src/content/xparser.js — fix that too.
 * ===========================================================================*/
(function () {
  'use strict';

  // The substring that identifies the bookmarks GraphQL operation in the URL.
  // X embeds the operation name in the GraphQL path, e.g.
  //   https://x.com/i/api/graphql/<hash>/Bookmarks?variables=...
  // >>> If X renames this operation, change it here. <<<
  const XODUS_BOOKMARKS_MATCH = 'Bookmarks';

  // Tag used on every postMessage so the bridge can ignore unrelated messages.
  const TAG = '__XODUS__';

  function isBookmarksUrl(url) {
    return (
      typeof url === 'string' &&
      url.includes('/graphql/') &&
      url.includes(XODUS_BOOKMARKS_MATCH)
    );
  }

  function forward(url, bodyText) {
    try {
      window.postMessage(
        { source: TAG, kind: 'graphql', url: url, body: bodyText },
        window.location.origin
      );
    } catch (_) {
      /* never let our instrumentation break the page */
    }
  }

  // --- patch fetch -----------------------------------------------------------
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function patchedFetch() {
      const args = arguments;
      const promise = originalFetch.apply(this, args);
      try {
        const input = args[0];
        const url =
          typeof input === 'string'
            ? input
            : input && input.url
            ? input.url
            : '';
        if (isBookmarksUrl(url)) {
          promise
            .then(function (response) {
              // Clone so we don't consume the body the page itself needs.
              response
                .clone()
                .text()
                .then(function (text) {
                  forward(url, text);
                })
                .catch(function () {});
            })
            .catch(function () {});
        }
      } catch (_) {}
      return promise;
    };
  }

  // --- patch XMLHttpRequest --------------------------------------------------
  // Some X traffic still uses XHR; cover both transports to be safe.
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__xodusUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    xhr.addEventListener('load', function () {
      try {
        if (isBookmarksUrl(xhr.__xodusUrl) && xhr.responseText) {
          forward(xhr.__xodusUrl, xhr.responseText);
        }
      } catch (_) {}
    });
    return originalSend.apply(this, arguments);
  };

  // Let the bridge know interception is live (useful for debugging).
  window.postMessage({ source: TAG, kind: 'ready' }, window.location.origin);
})();
