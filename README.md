# web-highlighter

A Chrome extension for highlighting text on any webpage, adding notes, and exporting annotations as Markdown. Built as a monorepo with a shared core library and an early-stage Android app.

---

## 1. Setup & Start

### Prerequisites

- Node.js v20 (see `.nvmrc`)
- npm (workspaces)
- Chrome browser

### Installation

```bash
# Install all workspace dependencies
npm install
```

### Extension (Chrome) — Development

```bash
# Start dev server with Hot Module Reload
npm run dev:ext
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `apps/extension/dist/`

Source changes are picked up automatically via HMR — no manual reload needed.

### Extension (Chrome) — Production Build

```bash
npm run build:ext
```

Output lands in `apps/extension/dist/`. Load it in Chrome the same way as above.

### Mobile App (Android)

> Status: scaffolded, not yet feature-complete.

```bash
npm run build:mobile   # Build web assets
npm run dev:mobile     # Start local dev server (browser preview)
# Then sync to Android and open Android Studio:
cd apps/mobile
npx cap sync android
npx cap open android
```

### Type-check all workspaces

```bash
npm run typecheck
```

---

## 2. Features

All milestones M0–M6 of the PoC spec are implemented and working.

| Feature | Description |
|---|---|
| **Text highlighting** | Select any text on a page → a floating "✏ Highlight" button appears → click to save the highlight |
| **Persistent storage** | Highlights survive page reloads via IndexedDB (Dexie) |
| **Note-taking** | Each highlight can have a plain-text note; edit via a popover that appears on click |
| **Library panel** | Right-side sidebar shows all highlights for the current page with inline editing |
| **Delete highlights** | Remove individual highlights from the library panel |
| **Scroll to highlight** | Click a quote in the library panel → page smooth-scrolls to the marked text |
| **Robust anchoring** | Uses `TextQuoteSelector` (with prefix/suffix context) and falls back to `TextPositionSelector` so highlights survive minor DOM changes |
| **SPA support** | Detects client-side navigation (React, Vue, Angular) via `MutationObserver` + History API; re-anchors highlights automatically |
| **Markdown export** | Popup → Export button generates a `.md` file with YAML frontmatter and one block per highlight |

### Export format

```markdown
---
url: https://example.com/article
title: Article Title
date: 2026-06-26
tags: []
---

> The highlighted quote goes here

Optional note for this highlight

---

> A second highlighted quote
```

---

## 3. Project Areas

```
web-highlighter/
├── packages/
│   └── core/                   # Shared, platform-agnostic library
├── apps/
│   ├── extension/              # Chrome extension (Manifest V3)
│   └── mobile/                 # Android app via Capacitor (WIP)
└── docs/                       # Project specs and setup notes
```

### `packages/core` — Shared Library

Platform-agnostic code shared between the extension and the mobile app.

| File | Responsibility |
|---|---|
| `src/model.ts` | `Annotation` data type, typed message contracts (`MsgPayloads`, `ExtMsg`) |
| `src/url.ts` | `normalizeUrl()` — strips hash and tracking params (`utm_*`, `fbclid`, etc.) |

### `apps/extension` — Chrome Extension

Manifest V3 extension. Three entry points, each with a clear role:

| Area | Path | Responsibility |
|---|---|---|
| **Content script** | `src/content/index.ts` | Main orchestrator: detects text selection, injects highlight UI, re-anchors on load, listens for SPA navigation |
| | `src/content/anchor.ts` | Anchoring strategies using `@apache-annotator/dom` |
| | `src/content/NotePopover.svelte` | Popover UI for editing a note attached to a highlight |
| | `src/content/LibraryPanel.svelte` | Right-side panel listing all highlights for the current page |
| **Background worker** | `src/background/worker.ts` | Service Worker: routes all messages, handles CRUD operations |
| | `src/background/db.ts` | Dexie/IndexedDB wrapper (`create`, `update`, `delete`, `listByUrl`) |
| | `src/background/export.ts` | Generates the Markdown export file |
| **Popup** | `src/popup/Popup.svelte` | Toolbar popup: shows highlight count, triggers export |

### `apps/mobile` — Android App (WIP)

Capacitor-based Android app. Shares the `@highlighter/core` package. UI and features not yet implemented — currently placeholder only.

### `docs/` — Specifications

| File | Content |
|---|---|
| `poc-dev.spec.md` | Full PoC spec: goals, non-goals, data model, architecture, message contract, milestones M0–M6, manual integration test |
| `project-setup.md` | Monorepo rationale, initial scaffolding steps, daily dev workflows |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| UI components | Svelte |
| Build | Vite + `@crxjs/vite-plugin` |
| Text anchoring | `@apache-annotator/dom` |
| Storage | Dexie (IndexedDB) |
| Mobile | Capacitor + Android |
| Monorepo | npm workspaces |
