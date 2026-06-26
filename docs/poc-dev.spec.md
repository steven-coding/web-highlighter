# Web-Highlighter (Browser) - Spec

Erstellt um: 22. Juni 2026 13:40
Letzte Änderung um: 22. Juni 2026 13:40
Projekte: Web-Highlighter (Browser + Android) (https://app.notion.com/p/Web-Highlighter-Browser-Android-38790833b2df80e59332d328404ba0e7?pvs=21)

# Spec: Web-Highlighter Chrome Extension (PoC)

> **Zweck dieses Dokuments**
Spezifikation für eine KI (z. B. Claude Code), die diese Chrome-Extension
**spec-driven** bis zur **PoC-Reife** entwickelt. Das Dokument ist die Source of
Truth. Jede Implementierungsentscheidung leitet sich hieraus ab. Bei Konflikten
zwischen Code und Spec gewinnt die Spec — oder die Spec wird zuerst geändert.
> 

---

## 0. Arbeitsanweisung für die KI

1. **Lies die gesamte Spec, bevor du Code schreibst.** Stelle Rückfragen nur zu
echten Mehrdeutigkeiten, nicht zu Entscheidungen, die hier getroffen sind.
2. **Arbeite milestone-weise** (siehe §8). Jeder Milestone ist eigenständig lauffähig
und manuell testbar. Kein Milestone wird begonnen, bevor der vorige die
Akzeptanzkriterien erfüllt.
3. **PoC-Disziplin:** Ziel ist ein funktionierender Durchstich, kein Produkt.
Nicht-Ziele (§3) sind bewusst ausgeschlossen. Keine vorzeitige Abstraktion.
4. **Nach jedem Milestone:** kurze Notiz, was umgesetzt wurde, wie man es testet,
welche Annahmen getroffen wurden.
5. **Halte dich an den definierten Tech-Stack (§4).** Keine zusätzlichen Libraries
ohne Begründung gegen die Constraints (§5).

---

## 1. Produkt-Use-Case

Eine Chrome-Extension, mit der man beim Lesen **Textpassagen direkt auf beliebigen
Webseiten markiert** und zu jedem Highlight eine **Notiz** verfasst. Highlights und
Notizen werden **lokal** gespeichert und überleben das Neuladen der Seite. Später
exportierbar als **Markdown** (Notion-Export ist Folgestufe, hier nur vorbereitet).

**Analogie:** Glasp / Hypothesis, reduziert auf den Kern.

---

## 2. Ziele (PoC)

| # | Ziel | Messbar erfüllt, wenn … |
| --- | --- | --- |
| Z1 | Text markieren | Nutzer selektiert Text → klickt „Highlight" → Passage ist farbig hinterlegt |
| Z2 | Notiz pro Highlight | Zu jedem Highlight kann Text erfasst & gespeichert werden |
| Z3 | Persistenz | Nach Reload sind Highlights + Notizen wieder sichtbar/angeheftet |
| Z4 | Übersicht | Eine Liste aller Highlights der aktuellen Seite ist einsehbar |
| Z5 | Markdown-Export | Highlights+Notizen der Seite als `.md`-Datei downloadbar |

---

## 3. Nicht-Ziele (bewusst ausgeschlossen im PoC)

- Kein Notion-Sync (nur Datenmodell so wählen, dass es später passt).
- Keine Cloud-Sync, kein Login, kein Konto.
- Kein Android / Firefox (separater Stack).
- Keine Multi-Color-Verwaltung, kein Tagging-UI (Feld im Modell erlaubt, kein UI nötig).
- Keine perfekte Anchoring-Robustheit gegen alle dynamischen Seiten — „good enough"
für statische Artikel-Seiten reicht.
- Kein Editor-Reichtum (kein Markdown im Notizfeld, reiner Text genügt).
- Keine Tests-Suite verpflichtend (manuelle Akzeptanztests pro Milestone reichen).

---

## 4. Tech-Stack (verbindlich)

- **Manifest V3** WebExtension (Chrome, Desktop)
- **TypeScript** (strict)
- **Vite** + **`@crxjs/vite-plugin`** (Build, HMR)
- **Svelte** für UI-Teile (Popover, Library-Panel). Bewusst leichtgewichtig.
- **Dexie.js** über **IndexedDB** als Storage
- **`@apache-annotator/dom`** für Anchoring (Quote-Selektor + Prefix/Suffix-Fallback).
Falls Integration zu aufwändig: Fallback auf `web-highlighter`. Begründung dokumentieren.

---

## 5. Constraints

- **MV3 Service Worker** ist nicht persistent — kein State im Speicher halten, immer
aus Dexie lesen/schreiben.
- **Content-Script-Bundle klein halten** — schwere Frameworks meiden, Svelte-Komponenten
nur für UI-Overlays.
- **Kein `<form>`Submit-Verhalten** in injizierten Overlays, das die Host-Seite stört.
- **Kein localStorage/sessionStorage** für Annotationsdaten — Dexie/IndexedDB.
- **CSS-Isolation:** injizierte UI darf das Layout der Host-Seite nicht brechen
(Shadow DOM oder eindeutig geprefixte Styles).
- **Permissions minimal:** `storage`, `activeTab`, `scripting`. Keine `<all_urls>`Host-Permission, wenn `activeTab` reicht.

---

## 6. Datenmodell

```tsx
interface Annotation {
  id: string;            // uuid
  url: string;           // normalisierte Seiten-URL (ohne Hash/Tracking-Params)
  pageTitle: string;
  quote: string;         // markierter Text (exact)
  prefix: string;        // ~32 Zeichen Kontext davor  (Anchoring-Fallback)
  suffix: string;        // ~32 Zeichen Kontext danach
  textPosition?: { start: number; end: number }; // Fallback 2
  note: string;          // freier Text, PoC: plain text
  tags: string[];        // PoC: immer [], kein UI
  color: string;         // PoC: fester Default-Wert
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}
```

- **URL-Normalisierung:** Hash und gängige Tracking-Parameter (`utm_*`, `fbclid` …)
entfernen, damit Reload/Wiederbesuch dieselben Highlights findet.
- **Anchoring-Strategie (Reihenfolge):** (1) Quote-Selector mit Prefix/Suffix,
(2) TextPosition, (3) wenn nichts greift: Annotation als „orphaned" markieren,
in Library-Liste trotzdem mit Notiz anzeigen.

---

## 7. Architektur

```
┌──────────────────────────────────────────────┐
│ Content Script  (in Host-Seite injiziert)     │
│  - Selektion erkennen → Floating "Highlight"-  │
│    Button am Selektionsende                    │
│  - Highlight rendern (Anchoring)               │
│  - Note-Popover (Svelte, in Shadow DOM)        │
│  - bestehende Annotationen beim Load re-anchoren│
│  - Messages an/von Background                  │
└───────────────┬────────────────────────────────┘
                │ runtime.sendMessage
┌───────────────▼────────────────────────────────┐
│ Background  (Service Worker)                    │
│  - CRUD-API gegen Dexie                         │
│  - Markdown-Export-Generator                    │
│  - Download anstoßen (chrome.downloads)         │
└───────────────┬────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────┐
│ Storage: Dexie (IndexedDB)                      │
│  table annotations, index auf [url], [createdAt]│
└─────────────────────────────────────────────────┘

Popup (Toolbar-Icon)
  - Anzahl Highlights der aktiven Seite
  - Button "Library für diese Seite öffnen"
  - Button "Als Markdown exportieren"

Library-Panel (im Content-Script-Overlay oder eigenem Tab)
  - Liste aller Annotationen der Seite
  - Notiz inline editierbar
  - Klick auf Eintrag → scrollt zum Highlight
  - Löschen pro Eintrag
```

### Nachrichten-Contract (Content ↔ Background)

| Message | Payload | Antwort |
| --- | --- | --- |
| `annotation/create` | `Omit<Annotation,'id'|'createdAt'|'updatedAt'>` | `Annotation` |
| `annotation/update` | `{ id, note }` | `Annotation` |
| `annotation/delete` | `{ id }` | `{ ok: true }` |
| `annotation/listByUrl` | `{ url }` | `Annotation[]` |
| `export/markdown` | `{ url }` | `{ filename, markdown }` |

---

## 8. Milestones (DAG, sequenziell lauffähig)

### M0 — Projekt-Skelett

**Liefert:** Vite + crxjs + TS + Svelte-Setup, leere MV3-Extension lädt in Chrome.
**Akzeptanz:** „Load unpacked" zeigt Icon, Popup öffnet mit Platzhaltertext, keine Konsolenfehler.

### M1 — Storage-Layer

**Liefert:** Dexie-Schema, CRUD-Funktionen, Message-Handler im Background.
**Akzeptanz:** Über die DevTools-Konsole lässt sich eine Annotation anlegen, lesen,
löschen; übersteht Service-Worker-Neustart.

### M2 — Highlight setzen (ohne Persistenz-Anzeige)

**Liefert:** Content-Script erkennt Selektion, zeigt Floating-Button, markiert Passage
visuell, schreibt Annotation via M1.
**Akzeptanz:** Text markieren → Button → Passage farbig + Eintrag liegt in Dexie.

### M3 — Re-Anchoring beim Load

**Liefert:** Beim Seiten-Load werden gespeicherte Annotationen geladen und wieder
hervorgehoben (Anchoring-Strategie §6).
**Akzeptanz:** Reload der Seite → Highlights erscheinen wieder an korrekter Stelle.
Orphans werden nicht gerendert, aber nicht gelöscht.

### M4 — Notizen

**Liefert:** Note-Popover (Shadow DOM) zum Erfassen/Editieren der Notiz pro Highlight.
**Akzeptanz:** Notiz schreiben → speichern → Reload → Notiz noch da.

### M5 — Library-Panel

**Liefert:** Liste aller Highlights der Seite, Inline-Edit der Notiz, Klick→Scroll,
Löschen.
**Akzeptanz:** Alle vier Aktionen funktionieren; Löschen entfernt Highlight + Eintrag.

### M6 — Markdown-Export

**Liefert:** Export-Generator + Download via `chrome.downloads`.
**Akzeptanz:** Button → `.md`-Datei im Downloads-Ordner im Format §9, korrekt befüllt.

**Abhängigkeiten:** M0 → M1 → M2 → M3 → M4 → M5 → M6.
M3 hängt an M2 (Annotationen müssen existieren); M6 hängt an M1 (liest Storage).

---

## 9. Markdown-Export-Format (verbindlich)

```markdown
---
url: https://example.com/artikel
title: Artikel-Titel
date: 2026-06-22
tags: []
---

> Markierte Passage als Quote-Block.

Meine Notiz zu dieser Passage.

---

> Nächste markierte Passage.

Notiz dazu. (Leerer Notiztext → Absatz weglassen.)
```

- Eine Datei pro Seite. Dateiname: `<slug-aus-titel>-<YYYY-MM-DD>.md`.
- Reihenfolge der Highlights: nach `createdAt` aufsteigend.
- Frontmatter exakt diese Felder. `tags` im PoC immer `[]`.

---

## 10. Akzeptanz-Gesamttest (Definition of Done für PoC)

Ein durchgehender manueller Durchlauf auf einer echten Artikel-Seite:

1. Drei Passagen markieren.
2. Zu zweien eine Notiz schreiben.
3. Seite neu laden → alle drei Highlights + beide Notizen wieder da.
4. Library öffnen → eine Notiz editieren, ein Highlight löschen.
5. Reload → Änderungen persistent.
6. Markdown exportieren → Datei entspricht §9, enthält die verbliebenen zwei Highlights.

Sind alle sechs Schritte ohne Konsolenfehler erfüllt, gilt der PoC als abgeschlossen.

---

## 11. Offene Punkte / bewusste Annahmen

- **Anchoring auf SPA-/dynamischen Seiten** ist im PoC nicht garantiert. Annahme:
Zielseiten sind weitgehend statische Artikel.
- **Shadow-DOM vs. geprefixte Styles** für das Overlay: KI entscheidet pragmatisch,
Entscheidung dokumentieren.
- **`activeTab` vs. Host-Permission:** zunächst mit `activeTab` versuchen; falls
Re-Anchoring beim automatischen Load das nicht zulässt, minimal nötige
Host-Permission ergänzen und begründen.
- **Notion-Export** ist Nicht-Ziel, aber Datenmodell + Markdown-Format sind so gewählt,
dass ein späterer Notion-Block-Mapper (Quote-Block + Paragraph) direkt darauf aufsetzt.