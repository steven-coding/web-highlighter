# Web-Highlighter - Projektstruktur

Erstellt um: 22. Juni 2026 13:42
Letzte Änderung um: 22. Juni 2026 13:47
Projekte: Web-Highlighter (Browser + Android) (https://app.notion.com/p/Web-Highlighter-Browser-Android-38790833b2df80e59332d328404ba0e7?pvs=21)

# Projekt-Setup & Struktur — Web-Highlighter Monorepo

> **Ein Repo, zwei unabhängig lauffähige Targets** (Chrome-Extension + Android-Capacitor-App)
plus ein **geteiltes Core-Package**. Paketverwaltung durchgängig mit **npm** (npm workspaces).
Beide Targets bauen und testen sich unabhängig — das Core-Package ist die gemeinsame
Basis, kein Zwang.
> 

---

## 0. Voraussetzungen

- **Node.js ≥ 20 LTS** und **npm ≥ 10** (npm bringt Workspaces nativ mit, kein pnpm/yarn nötig)
- Chrome (Desktop) zum Laden der Extension
- Android Studio + JDK (nur für das Mobile-Target nötig)

```bash
node -v   # v20.x oder höher
npm -v    # 10.x oder höher
```

---

## 1. Repo-Struktur

```
web-highlighter/
├── package.json                # Root: npm workspaces, gemeinsame Scripts
├── package-lock.json           # EIN Lockfile fürs ganze Repo (committen!)
├── .npmrc                      # npm-Härtung (ignore-scripts, min-release-age)
├── tsconfig.base.json          # geteilte TS-Compiler-Optionen
├── .nvmrc                      # fixiert Node-Version
├── .gitignore
├── CLAUDE.md                   # Projektregeln für Claude Code
├── README.md
│
├── packages/
│   └── core/                   # @highlighter/core — geteilte Logik
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── model.ts        # Annotation-Interface (siehe Spec §6)
│           ├── anchoring/      # Quote-Selektor + Prefix/Suffix-Fallback
│           ├── storage/        # Dexie-Wrapper (IndexedDB CRUD)
│           ├── export/         # Markdown-Generator
│           └── url.ts          # URL-Normalisierung
│
└── apps/
    ├── extension/              # @highlighter/extension — Chrome MV3
    │   ├── package.json
    │   ├── vite.config.ts      # crxjs
    │   ├── manifest.config.ts
    │   ├── tsconfig.json
    │   └── src/
    │       ├── background/
    │       ├── content/
    │       ├── popup/
    │       └── library/
    │
    └── mobile/                 # @highlighter/mobile — Capacitor
        ├── package.json
        ├── capacitor.config.ts
        ├── vite.config.ts
        ├── tsconfig.json
        ├── index.html
        ├── src/
        │   ├── main.ts
        │   ├── reader/         # Readability-Pipeline
        │   └── ui/
        └── android/            # generiert via `npx cap add android`
```

Begründung: `packages/core` enthält plattformunabhängige Logik (Modell, Anchoring,
Storage-Abstraktion, Export). `apps/*` sind die konkreten, je eigenständig
build- und testbaren Targets.

---

## 2. Initial-Setup (Schritt für Schritt, npm)

### 2.1 Repo + Root anlegen

```bash
mkdir web-highlighter && cd web-highlighter
git init
echo "20" > .nvmrc
npm init -y
```

### 2.2 Root-`package.json` als Workspace konfigurieren

```json
{
  "name": "web-highlighter",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build:core": "npm run build --workspace @highlighter/core",
    "dev:ext": "npm run dev --workspace @highlighter/extension",
    "build:ext": "npm run build --workspace @highlighter/extension",
    "dev:mobile": "npm run dev --workspace @highlighter/mobile",
    "build:mobile": "npm run build --workspace @highlighter/mobile",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

> **npm-Hinweis:** Mit Workspaces installierst du **immer aus dem Root** mit
`-w <workspace>` bzw. `--workspace`. Niemals `npm install` in einem Unterordner —
sonst entstehen mehrere `node_modules`/Lockfiles. Es gibt **ein** `package-lock.json`
im Root, und das wird committet.
> 

### 2.3 Geteilte TS-Basis

```bash
# tsconfig.base.json im Root anlegen (Inhalt siehe §4)
```

### 2.4 Root-Devtools installieren

```bash
npm install -D typescript
```

### 2.5 `.npmrc` — npm-Härtung (Root)

Im Repo-Root anlegen, **bevor** weitere Pakete installiert werden:

```
# .npmrc
ignore-scripts=true
min-release-age=21
```

- **`ignore-scripts=true`** — npm führt bei `install` keine `pre/post-install`Lifecycle-
Scripts von Dependencies aus. Das ist die wirksamste Einzelmaßnahme gegen
Supply-Chain-Trojaner, die ihre Payload über Install-Hooks ausführen.
- **`min-release-age=21`** — npm ignoriert Paketversionen, die jünger als 21 Tage sind.
Frisch kompromittierte Releases werden meist innerhalb weniger Tage entdeckt und
zurückgezogen; die Karenz fängt das ab.

> **`.npmrc` committen** — die Datei gehört ins Repo, damit die Härtung für alle gilt
(lokal wie CI).
> 

### Wichtige Konsequenz für Capacitor / native Builds

`ignore-scripts=true` unterdrückt Install-Scripts **global**, auch legitime. Einige
Pakete in diesem Stack brauchen ihre Scripts, um lauffähig zu werden — insbesondere
**Capacitor** (native Projekt-Hooks) und ggf. `esbuild` (von Vite genutzt, lädt eine
Binary per Script). Wenn nach einem Install etwas fehlt, gezielt **nur für das
betroffene Paket** die Scripts nachholen, statt die globale Regel aufzuweichen:

```bash
# Beispiel: Build-Tooling nachträglich vorbereiten
npm rebuild esbuild

# allgemein: Approve-/Rebuild gezielt pro Paket
npm rebuild <paket>
```

Grundsatz: Die Default-Sperre bleibt; Ausnahmen werden **explizit und einzeln**
freigeschaltet — analog zur Postinstall-Whitelist mit PR-Review aus deinem
Security-Konzept.

---

## 3. Packages & Apps scaffolden (alles mit npm)

### 3.1 `packages/core`

```bash
mkdir -p packages/core/src
```

`packages/core/package.json`:

```json
{
  "name": "@highlighter/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit"
  }
}
```

Abhängigkeiten des Core (vom Root aus installieren):

```bash
npm install dexie @apache-annotator/dom -w @highlighter/core
```

### 3.2 `apps/extension` (Chrome MV3)

```bash
mkdir -p apps/extension/src
```

`apps/extension/package.json`:

```json
{
  "name": "@highlighter/extension",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

Dependencies (Root → Workspace):

```bash
# Laufzeit: Core als Workspace-Dependency verlinken
npm install @highlighter/core -w @highlighter/extension

# Build/UI
npm install -D vite @crxjs/vite-plugin -w @highlighter/extension
npm install svelte @sveltejs/vite-plugin-svelte -w @highlighter/extension
```

> `npm install @highlighter/core -w @highlighter/extension` verlinkt das lokale
Core-Package via Workspaces-Symlink — keine Veröffentlichung in eine Registry nötig.
> 

### 3.3 `apps/mobile` (Capacitor)

```bash
mkdir -p apps/mobile/src
```

`apps/mobile/package.json`:

```json
{
  "name": "@highlighter/mobile",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "cap:sync": "cap sync android",
    "cap:open": "cap open android",
    "typecheck": "tsc --noEmit"
  }
}
```

Dependencies:

```bash
# Core verlinken
npm install @highlighter/core -w @highlighter/mobile

# Capacitor-Kern + Plugins
npm install @capacitor/core @capacitor/android @capacitor/filesystem @capacitor/share -w @highlighter/mobile
npm install -D @capacitor/cli vite -w @highlighter/mobile

# Reader-View + UI
npm install @mozilla/readability -w @highlighter/mobile
npm install svelte @sveltejs/vite-plugin-svelte -w @highlighter/mobile
```

Capacitor initialisieren und Android-Projekt erzeugen (im App-Ordner):

```bash
cd apps/mobile
npx cap init "Web Highlighter" "dev.steven.highlighter" --web-dir dist
npm run build            # erzeugt dist/
npx cap add android      # legt apps/mobile/android/ an
cd ../..
```

---

## 4. `tsconfig.base.json` (Root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@highlighter/core": ["packages/core/src/index.ts"]
    }
  }
}
```

Jedes Package/App hat ein eigenes `tsconfig.json`, das erweitert:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src"]
}
```

---

## 5. Tägliche Workflows

### Core entwickeln

```bash
npm run typecheck        # prüft alle Workspaces (tsc -b)
```

Da `core` per Symlink eingebunden ist und Vite die Quellen direkt auflöst, brauchst
du im Dev meist **keinen** separaten Core-Build — Änderungen sind in beiden Apps sofort sichtbar.

### Extension lokal testen

```bash
npm run dev:ext          # Vite + crxjs mit HMR
# danach: chrome://extensions → Developer Mode → "Load unpacked" → apps/extension/dist
```

### Mobile lokal testen

```bash
npm run dev:mobile       # Vite-Dev-Server (UI im Desktop-Browser testbar)

# auf Gerät/Emulator:
npm run build:mobile
npm --workspace @highlighter/mobile run cap:sync
npm --workspace @highlighter/mobile run cap:open   # öffnet Android Studio
```

Für Live-Reload aufs Gerät: in `apps/mobile/capacitor.config.ts` den Dev-Server
eintragen (`server.url` = Vite-IP), für Release wieder entfernen — Details im
Architektur-Dokument.

---

## 6. `.gitignore` (Root)

```
node_modules/
dist/
*.log

# Capacitor / Android
apps/mobile/android/app/build/
apps/mobile/android/.gradle/
apps/mobile/android/local.properties
apps/mobile/android/app/release/

# Keystore NIEMALS committen
*.keystore
*.jks

# OS
.DS_Store
```

> **Lockfile gehört committet.** `package-lock.json` im Root **nicht** ignorieren —
es ist die reproduzierbare Quelle aller Versionen (auch sicherheitsrelevant).
> 

---

## 7. Wichtige npm-Regeln für dieses Repo

1. **Immer vom Root installieren** mit `w <workspace-name>`. Beispiel:
`npm install dexie -w @highlighter/core`.
2. **Root-weite Dev-Tools** (TypeScript, Linter) ohne `w` installieren — landen im Root.
3. **Ein Lockfile**, im Root, committed. Keine Lockfiles in Unterordnern.
4. **`npm ci`** in CI/Clean-Setups statt `npm install` — installiert exakt nach Lockfile.
5. **Frische Installation des ganzen Repos:** einmal `npm install` im Root holt alle
Workspaces auf einmal.
6. **`.npmrc` ist aktiv** (`ignore-scripts`, `min-release-age`) — bei fehlenden nativen
Bestandteilen gezielt `npm rebuild <paket>` statt globalem Aufweichen (siehe §2.5).

```bash
# Komplett-Setup nach Clone:
git clone <repo> && cd web-highlighter
npm install              # installiert ALLE Workspaces
```

---

## 8. Reihenfolge für den Erstaufbau (Checkliste)

1. `node -v` / `npm -v` prüfen (§0)
2. Repo + Root-`package.json` mit Workspaces (§2.1–2.2)
3. `tsconfig.base.json` + `.gitignore` + `.nvmrc` + `.npmrc` (§4, §6, §2.5)
4. `packages/core` anlegen, Deps installieren (§3.1)
5. `apps/extension` anlegen, Deps installieren, leeres MV3-Skelett laden (§3.2)
6. `apps/mobile` anlegen, Capacitor init + `cap add android` (§3.3)
7. `npm install` im Root → alles verlinkt (§7)
8. `npm run dev:ext` testen, dann `npm run dev:mobile` testen

Danach kann die spec-driven Entwicklung (siehe Spec-Dokument, Milestone M0 ff.) starten.