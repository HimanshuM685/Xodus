# Graph Report - .  (2026-06-25)

## Corpus Check
- Corpus is ~6,787 words - fits in a single context window. You may not need a graph.

## Summary
- 108 nodes · 199 edges · 10 communities (9 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.83)
- Token cost: 26,280 input · 1,500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Settings, Storage & Push Orchestration|Settings, Storage & Push Orchestration]]
- [[_COMMUNITY_Popup UI & Markdown Export|Popup UI & Markdown Export]]
- [[_COMMUNITY_Extension Manifest & Permissions|Extension Manifest & Permissions]]
- [[_COMMUNITY_Project Docs & Design Rationale|Project Docs & Design Rationale]]
- [[_COMMUNITY_Notion Database Push|Notion Database Push]]
- [[_COMMUNITY_Content Bridge & Auto-Scroll|Content Bridge & Auto-Scroll]]
- [[_COMMUNITY_X GraphQL Response Parser|X GraphQL Response Parser]]
- [[_COMMUNITY_CSV Export|CSV Export]]
- [[_COMMUNITY_GraphQL FetchXHR Interceptor|GraphQL Fetch/XHR Interceptor]]

## God Nodes (most connected - your core abstractions)
1. `$()` - 29 edges
2. `$()` - 16 edges
3. `getSettings()` - 10 edges
4. `get()` - 7 edges
5. `getBookmarks()` - 7 edges
6. `handleNotionPush()` - 6 edges
7. `pushToNotion()` - 6 edges
8. `set()` - 6 edges
9. `toast()` - 6 edges
10. `normalizeTweet()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Xodus Settings Page` --conceptually_related_to--> `Local-only / Zero-telemetry Principle`  [INFERRED]
  src/options/options.html → README.md
- `Xodus Settings Page` --conceptually_related_to--> `Notion Push Integration`  [INFERRED]
  src/options/options.html → README.md
- `Xodus Popup UI` --conceptually_related_to--> `bridge.js (dedupe + storage + auto-scroll)`  [INFERRED]
  src/popup/popup.html → CONTRIBUTING.md
- `Xodus Popup UI` --conceptually_related_to--> `Notion Push Integration`  [INFERRED]
  src/popup/popup.html → README.md
- `xparser.js (GraphQL response parser)` --shares_data_with--> `Xodus Bookmark Data Model`  [INFERRED]
  CONTRIBUTING.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **X-frontend Brittle Parsing Layer** — readme_interceptor, readme_xparser, readme_brittle_files_isolation, issue_template_x_frontend_broke [EXTRACTED 1.00]
- **Bookmark Export Destinations (CSV/Markdown/Notion)** — readme_notion_push, readme_bookmark_data_model, popup_popup_popupui, options_options_settingspage [INFERRED 0.75]

## Communities (10 total, 1 thin omitted)

### Community 0 - "Settings, Storage & Push Orchestration"
Cohesion: 0.21
Nodes (20): broadcast(), handleNotionPush(), updateStatus(), get(), getBookmarks(), getBookmarksCount(), getSettings(), KEYS (+12 more)

### Community 1 - "Popup UI & Markdown Export"
Cohesion: 0.18
Nodes (19): toMarkdown(), clearBookmarks(), $(), doClear(), doCsv(), doMarkdown(), doNotion(), els (+11 more)

### Community 2 - "Extension Manifest & Permissions"
Cohesion: 0.13
Nodes (14): action, default_popup, default_title, background, service_worker, type, content_scripts, description (+6 more)

### Community 3 - "Project Docs & Design Rationale"
Cohesion: 0.26
Nodes (12): Contributing to Xodus, X frontend broke (Issue Template), Xodus Settings Page, Xodus Popup UI, Xodus Bookmark Data Model, bridge.js (dedupe + storage + auto-scroll), Brittle X-frontend File Isolation, interceptor.js (GraphQL URL matcher) (+4 more)

### Community 4 - "Notion Database Push"
Cohesion: 0.36
Nodes (11): createDatabase(), createPage(), databaseSchema(), headers(), notionFetch(), pageForBookmark(), pushToNotion(), richText() (+3 more)

### Community 5 - "Content Bridge & Auto-Scroll"
Cohesion: 0.46
Nodes (6): autoScroll(), countBookmarks(), getBookmarksMap(), ingest(), setBookmarksMap(), setStatus()

### Community 6 - "X GraphQL Response Parser"
Cohesion: 0.73
Nodes (5): extractMedia(), normalizeTweet(), parseBookmarksResponse(), safe(), unwrapTweet()

### Community 7 - "CSV Export"
Cohesion: 0.47
Nodes (4): COLUMNS, downloadCsv(), rowFor(), toCsv()

## Knowledge Gaps
- **18 isolated node(s):** `manifest_version`, `name`, `version`, `description`, `permissions` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `$()` connect `Popup UI & Markdown Export` to `Settings, Storage & Push Orchestration`, `CSV Export`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `sleep()` connect `Notion Database Push` to `Content Bridge & Auto-Scroll`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `autoScroll()` connect `Content Bridge & Auto-Scroll` to `Notion Database Push`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `manifest_version`, `name`, `version` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Extension Manifest & Permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._