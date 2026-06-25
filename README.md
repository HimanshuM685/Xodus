# Xodus — X Bookmark Exporter

Export your [X (Twitter)](https://x.com) bookmarks to **CSV**, **Markdown**, or
**Notion** — turning your bookmarks from a leaky pseudo-todo list into a real,
searchable archive.

Xodus is an open-source **Manifest V3** browser extension (Chrome/Edge). It runs
entirely in your browser:

- 🔑 **No X API keys.** It reads your *own* logged-in bookmarks session.
- 🔒 **Local-only.** Nothing leaves your machine except the explicit push to
  *your own* Notion workspace, using a token *you* provide.
- 📡 **Zero telemetry.** No backend, no analytics, no phone-home. Ever.
- 🧩 **MIT licensed.** Use it, fork it, ship it.

---

## ⚠️ Disclaimer (please read)

Xodus works by reading the data X's own web frontend loads into your logged-in
session. That means:

- It uses **your own session** — for **personal archival** of **your own**
  bookmarks.
- It relies on X's web frontend, which **changes without notice**. When X ships
  a change, collection may break until the parsing layer is updated (see
  [Contributing](CONTRIBUTING.md)).
- Automated reading of X's frontend is **arguably against X's Terms of
  Service**. Practical risk for personal, read-only, local use is low, but it is
  **your call** — use at your own discretion.

There is no official, free X API path for this; the official Bookmarks endpoint
is gated behind paid API tiers. Xodus deliberately avoids that.

---

## Install (load unpacked)

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the repository folder (the one containing
   `manifest.json`).
5. Pin **Xodus** to your toolbar.

> Requires a Chromium browser that supports MV3 `world: "MAIN"` content scripts
> (Chrome/Edge 111+).

---

## Usage

### 1. Collect your bookmarks

1. Go to **[x.com/i/bookmarks](https://x.com/i/bookmarks)** and make sure you're
   logged in.
2. Click the **Xodus** toolbar icon → **Collect bookmarks**.
3. Xodus auto-scrolls the timeline and captures each batch your browser loads,
   showing a live count. It stops automatically when no new bookmarks appear, or
   you can press **Stop**.

Collected bookmarks are saved in the extension's local storage, so you can close
the popup and resume later — duplicates are removed by tweet ID.

Each bookmark is normalized to:

| Field | Notes |
|-------|-------|
| `tweet_id` | canonical ID |
| `url` | `https://x.com/{handle}/status/{id}` |
| `author_handle`, `author_name` | |
| `text` | full tweet text |
| `created_at` | original timestamp |
| `media_urls[]` | image / best-bitrate video URLs |
| `is_thread` | part of a self-thread? |
| `quoted_tweet_url` | quoted tweet, if any |

### 2. Export

- **Download CSV** — UTF-8, properly escaped. The always-works fallback.
- **Copy as Markdown** — a bulleted `- [@author — snippet](url)` list.
- **Push to Notion** — see below.

#### Google Sheets

There's no live Sheets integration by design (it would need OAuth and add little
value). Instead: **Download CSV**, then in Google Sheets use
**File → Import → Upload** and pick the CSV. Done.

### 3. Push to Notion

Xodus can **auto-create** a Notion database with the right schema and push every
bookmark into it.

**One-time setup:**

1. Create an internal integration at
   **[notion.so/my-integrations](https://www.notion.so/my-integrations)** and
   copy its **Internal Integration Token**.
2. Pick (or create) a Notion **page** to hold the archive. Open it, click
   **•••  → Connections → Connect to** and choose your integration. *(Notion's
   API can't create a top-level database on its own — it must live under a page
   the integration can access.)*
3. Copy that page's link. The **parent page ID** is the 32-character hex chunk
   at the end of the URL.
4. In Xodus → **Settings**, paste the **token** and **parent page ID**, then
   **Save**.

**Pushing:**

- Click **Push to Notion**. On the first push, Xodus creates a database titled
  **“Xodus — X Bookmarks”** under your parent page with this schema:

  | Property | Type | Content |
  |----------|------|---------|
  | Title | title | tweet snippet (~60 chars) |
  | Author | rich_text | `@handle · Display Name` |
  | Date | date | tweet `created_at` |
  | Tweet Link | url | canonical tweet URL |
  | Text | rich_text | full tweet text |
  | Media | url | first media URL |
  | Thread | checkbox | `is_thread` |

- The created **database ID is saved**, so later pushes **append** to the same
  database instead of creating duplicates.
- Pushes are rate-limited to respect Notion's ~3 requests/second and retry on
  HTTP 429. You'll see a success/failure count.
- Want a fresh database? Settings → **Forget database**, then push again.

---

## Privacy

Xodus has **no backend**. The only network requests it makes are:

- Reading bookmark data your browser *already* loads from X (no extra requests
  to X are initiated beyond auto-scrolling the page you're on).
- The Notion push you explicitly trigger, to `api.notion.com`, with your token.

Your Notion token and bookmarks are stored only in your browser's extension
storage.

---

## How it works (architecture)

```
x.com page (MAIN world)        x.com page (ISOLATED world)        extension
┌─────────────────────┐        ┌──────────────────────────┐      ┌──────────────┐
│ interceptor.js      │  post  │ xparser.js (parse shape)  │      │ popup.js     │
│  patches fetch/XHR  │──────▶ │ bridge.js  (dedupe+store, │◀────▶│ options.js   │
│  copies Bookmarks   │ message│            auto-scroll)   │ msgs │ service-     │
│  GraphQL responses  │        │                           │      │  worker.js   │
└─────────────────────┘        └──────────────────────────┘      └──────────────┘
                                          │                              │
                                   chrome.storage.local ◀───────────────┘
                                                            Notion push (api.notion.com)
```

**The two brittle, X-frontend-specific files are isolated on purpose:**

- [`src/content/interceptor.js`](src/content/interceptor.js) — matches the
  bookmarks GraphQL request URL.
- [`src/content/xparser.js`](src/content/xparser.js) — parses the response
  shape into the Xodus data model.

If X changes its frontend and collection breaks, **those are the only files you
should need to touch.** See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Contributing

PRs welcome — especially fixes when X changes its frontend. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the **“X frontend broke”** issue template.

## License

[MIT](LICENSE)
