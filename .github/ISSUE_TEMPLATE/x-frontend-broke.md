---
name: "X frontend broke 💥"
about: "Xodus stopped collecting bookmarks after an X (Twitter) change"
title: "[X broke] Collection stopped working"
labels: ["x-frontend", "bug"]
---

<!--
Thanks for reporting! Xodus reads X's web frontend, which X changes without
notice. The info below helps a maintainer (or you!) patch the brittle files:
  src/content/interceptor.js  (request URL match)
  src/content/xparser.js      (response shape)
-->

## What happens
<!-- e.g. "Count stays at 0", "stops after ~40", "popup shows content script not active" -->


## Environment
- Browser & version: <!-- e.g. Chrome 126 -->
- OS: <!-- e.g. macOS 14 / Windows 11 -->
- Xodus version: <!-- from manifest.json, e.g. 0.1.0 -->
- Date observed:

## DevTools check (very helpful)
On `x.com/i/bookmarks`, open DevTools → Network → filter `graphql`, then scroll.

- Is there a request whose URL contains `Bookmarks`?  ☐ yes ☐ no
- If renamed, what is the new operation name in the URL?

```
<!-- paste the request URL (you can redact the auth/cookie headers) -->
```

## Response shape (optional but ideal)
If you can, paste a **redacted** snippet of the bookmarks GraphQL response so we
can fix `xparser.js`. Remove anything private; we mostly need the structure
around `data → ... → instructions → entries → ... → tweet_results.result`.

```json

```

## Anything else
<!-- console errors, screenshots, etc. -->
