# Contributing to Xodus

Thanks for helping keep Xodus alive! Because Xodus reads X's web frontend, the
project's health depends mostly on **keeping up with X's changes**. This guide
focuses on exactly that.

## Project layout

```
manifest.json                  MV3 manifest
src/
  content/
    interceptor.js   ⚠ BRITTLE  MAIN-world fetch/XHR patch; matches the GraphQL URL
    xparser.js       ⚠ BRITTLE  parses X's GraphQL response shape → data model
    bridge.js                   dedupe + storage + auto-scroll (shape-agnostic)
  background/
    service-worker.js           runs the Notion push
  export/
    csv.js                      CSV export
    markdown.js                 Markdown export
    notion.js                   Notion create-database + push
  lib/
    storage.js                  chrome.storage wrappers + key constants
  popup/                        popup UI
  options/                      settings page
```

There is **no build step** — it's plain ES modules and vanilla JS. Edit, then
reload the unpacked extension at `chrome://extensions`.

## ⚠ The two brittle files

Anything that knows about X's frontend lives in exactly two files:

1. **`src/content/interceptor.js`** — the substring (`XODUS_BOOKMARKS_MATCH`)
   used to recognize the bookmarks GraphQL request URL.
2. **`src/content/xparser.js`** — the code that walks the GraphQL response into
   the Xodus data model.

**Please keep X-specific assumptions out of every other file.** If you find
yourself reaching into `data.bookmark_timeline_v2...` anywhere else, move it
into `xparser.js`.

## Fixing collection after an X change

When the count stays at 0 or stops growing:

1. Open **DevTools → Network** on `x.com/i/bookmarks`.
2. Filter for `graphql` and scroll the page to trigger a load.
3. Find the bookmarks request:
   - **URL still contain `Bookmarks`?** If renamed, update
     `XODUS_BOOKMARKS_MATCH` in `interceptor.js`.
   - **Response shape changed?** Copy a response body and adjust the access
     paths in `xparser.js`. Every access there is wrapped in `safe()`, so add a
     new fallback path rather than removing the old one when you can — that
     keeps Xodus working across rollouts/A-B tests.
4. Reload the extension and re-test a fresh Collect run.

When you open a PR, please note **which browser/version** and roughly **when**
you observed the change, so others can correlate.

## Style

- Vanilla JS, ES modules, no frameworks, no dependencies, no bundler.
- Keep it dependency-free and backend-free — those are core promises of Xodus.
- Comment the *why*, especially around anything X- or Notion-specific.

## Ground rules

- Keep Xodus **local-only**: no telemetry, no external servers, no new outbound
  hosts beyond `x.com` and `api.notion.com`.
- Be honest in docs about the ToS/fragility tradeoffs.

By contributing you agree your contributions are licensed under the project's
[MIT License](LICENSE).
