# Technology Stack

**Project:** PDF Chisel
**Researched:** 2026-02-22
**Confidence note:** Training data current through August 2025. Version numbers flagged with confidence levels. Verify against npm/official releases before pinning.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron | ^34.x (see note) | Desktop shell, OS APIs, packaging | Official Electron team recommends always using latest stable for security; v34 likely current by Feb 2026 based on 8-week release cadence from v32 in mid-2025. Windows-only target simplifies compatibility concerns. |
| Svelte | ^5.x | UI framework (renderer process) | Svelte 5 stable shipped Oct 2024; runes-based reactivity is cleaner for a utility app with discrete, independent mode components. No virtual DOM = smaller bundle = faster startup. |
| Vite | ^6.x | Build tool for renderer | Standard bundler for Svelte projects; fast HMR during development. |
| electron-vite | ^3.x | Electron + Vite integration | Provides unified config, handles main/preload/renderer distinction cleanly, first-class Electron HMR. Preferred over manual Vite config wiring. |
| Node.js | LTS (22.x) | Runtime for main process | Use LTS; Electron ships its own Node version but your dev tools need a compatible host Node. |

**Confidence:** MEDIUM — Electron/Svelte/Vite major versions confirmed from training data (Aug 2025); patch versions may differ by Feb 2026.

### PDF Manipulation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pdf-lib | ^1.17.x | PDF creation/manipulation | De facto JS standard for programmatic PDF editing. Handles extract, split, merge natively in pure JS — no native binaries, no network. Pure TS/JS, works in both main and renderer process. Well-maintained. |
| pdfjs-dist | ^4.x | PDF rendering to canvas | Mozilla PDF.js distribution package — the standard for rendering PDF pages to canvas/images in JS. Required for thumbnail generation and PDF-to-image export. |

**Do NOT use:**
- `@cantoo/pdf-lib` — fork with additional features, but adds complexity and the core pdf-lib covers all required operations. Avoid unless pdf-lib proves insufficient.
- `hummus-recipe` / `node-pdftk` — native binary dependencies; create packaging complexity in Electron and violate the "pure local JS" ethos.
- Puppeteer for PDF rendering — extreme overkill (ships a full Chromium), massive bundle size, licensing complications. Use pdfjs-dist.
- `pdf2pic` — wraps GraphicsMagick/ImageMagick which requires external system installs. Unacceptable for a self-contained Windows installer.

**Confidence:** HIGH — pdf-lib and pdfjs-dist are the established, widely-documented pair for this exact use case. The "no native binaries" constraint eliminates the alternatives.

### PDF-to-Image Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pdfjs-dist | ^4.x | Render PDF pages to canvas | Render each page via `pdfjsLib.getPage(n).render({canvasContext, viewport})`, then call `canvas.toDataURL('image/png')` or `canvas.toBuffer()` for JPEG. No native deps. |
| Node canvas (`canvas` npm) | ^3.x | Server-side canvas for main process rendering | If rendering happens in main process (Node context), `node-canvas` provides a Canvas API. However, prefer rendering in renderer process where browser Canvas is native and free. |

**Architecture decision:** Render PDF pages in the renderer process using the browser's native `<canvas>` element via pdfjs-dist. Transfer resulting image data (base64 or ArrayBuffer) to main process via IPC for file I/O. This avoids the `canvas` npm package (which has native binary deps) entirely.

**Thumbnail generation:** Same approach — render at reduced viewport scale (e.g., scale: 0.3) using pdfjs-dist in renderer, display directly in `<img>` tags via data URLs.

**Confidence:** HIGH — browser Canvas + pdfjs-dist is the canonical rendering approach. Avoiding node-canvas sidesteps native binary packaging issues.

### Scaffolding and Build Tools

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-vite | ^3.x | Project scaffold + dev server | `npm create @quick-start/electron` uses electron-vite template; provides Svelte template out of the box. Recommended over electron-forge for Svelte projects. |

**electron-forge vs electron-builder vs electron-vite:**

- **electron-forge**: Official Electron team tool. Excellent for vanilla JS or Webpack-based projects. Svelte integration requires manual setup. Plugin ecosystem is good but the Svelte template is not first-class.
- **electron-builder**: Community-maintained, extremely mature, best Windows packaging support (NSIS, Squirrel, AppX), best GitHub Releases auto-update integration. Not a scaffolding tool — pairs with any dev setup.
- **electron-vite**: Scaffolding + dev tool (not packager). Has official Svelte template. Pairs with electron-builder for packaging. The right choice for this stack.

**Recommendation:** Use electron-vite for scaffolding + dev. Use electron-builder for packaging + distribution. This is the most common pairing in the 2025 community.

**Confidence:** MEDIUM — electron-vite + electron-builder pairing is well-established in training data; electron-forge's Svelte support may have improved by Feb 2026 but electron-vite remains the cleaner path.

### Packaging and Distribution

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-builder | ^25.x | Package + sign + distribute | Best-in-class Windows packaging. Produces NSIS `.exe` installers natively. Squirrel.Windows is an alternative but NSIS gives more control and is more universally compatible. |
| NSIS installer target | — | Windows installer format | Standard `.exe` installer users expect on Windows. Handles install directory, Start Menu shortcuts, uninstaller. Configured via electron-builder `nsis` block. |

**Do NOT use:**
- Squirrel.Windows — electron-builder supports it, but NSIS is more configurable and better understood. Squirrel is the legacy VS Code approach.
- AppX / MSIX — requires Microsoft Store enrollment; overkill for an open-source GitHub Releases app.
- Portable ZIP — fine as a secondary artifact but not a replacement for a proper installer.

**Confidence:** HIGH — electron-builder with NSIS is the undisputed standard for Windows Electron distribution via GitHub Releases.

### Auto-Updater

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-updater | ^6.x (from electron-builder) | Auto-update via GitHub Releases | Ships with electron-builder. Handles update check, download, and install on next launch. Works with GitHub Releases out of the box — just point `publish.provider: "github"` in electron-builder config. |

**Integration pattern:**
```javascript
// main process
import { autoUpdater } from 'electron-updater';
autoUpdater.checkForUpdatesAndNotify();
// electron-builder publishes a latest.yml alongside the installer
// autoUpdater reads it to determine if an update is available
```

**Do NOT use:**
- Electron's built-in `autoUpdater` module — requires a Squirrel-compatible update server; not suitable for GitHub Releases without additional infrastructure.
- Manual update check + shell.openExternal to GitHub releases page — acceptable fallback but removes the seamless install-on-restart UX.

**Confidence:** HIGH — electron-updater with GitHub Releases is the canonical pattern for open-source Electron apps.

### IPC Pattern (Main ↔ Renderer)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| contextBridge + ipcRenderer | Electron built-in | Secure IPC | The modern, secure pattern. Renderer never gets Node.js access directly — only explicitly exposed APIs. Required when `contextIsolation: true` (default in modern Electron). |
| ipcMain.handle | Electron built-in | Main process handler | Use `ipcMain.handle('channel', async (event, args) => result)` for request/response. Pairs with `ipcRenderer.invoke` on renderer side. |

**Pattern:**

```javascript
// preload.js (runs in renderer context with Node access)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  extractPages: (args) => ipcRenderer.invoke('pdf:extract', args),
  splitPdf:     (args) => ipcRenderer.invoke('pdf:split', args),
  mergePdfs:    (args) => ipcRenderer.invoke('pdf:merge', args),
  convertToImages: (args) => ipcRenderer.invoke('pdf:convert-images', args),
  saveFile:     (args) => ipcRenderer.invoke('fs:save-file', args),
  openFolder:   (path) => ipcRenderer.invoke('shell:open-folder', path),
  getSettings:  ()     => ipcRenderer.invoke('settings:get'),
  setSettings:  (s)    => ipcRenderer.invoke('settings:set', s),
});
```

```svelte
<!-- Svelte component -->
<script>
  async function handleExtract() {
    const result = await window.electronAPI.extractPages({ ... });
  }
</script>
```

**Do NOT use:**
- `nodeIntegration: true` — security vulnerability; gives renderer full Node.js access. Never enable for a production app, even if it feels simpler.
- `remote` module — deprecated and removed from modern Electron.
- Direct `ipcRenderer` in Svelte components without contextBridge — requires nodeIntegration which is insecure.

**Confidence:** HIGH — contextBridge + ipcMain.handle is the documented, enforced modern IPC pattern.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Svelte 5 runes ($state, $derived) | Svelte 5 built-in | Component and shared state | For a single-window utility app, Svelte's built-in reactivity is sufficient. No need for Pinia/Zustand/etc. |
| Svelte stores ($writable) | Svelte built-in | Cross-component shared state | Use writable stores for settings (output path, theme) and shared state between mode selector and active mode panel. |

**Confidence:** HIGH — this app is simple enough that store-based state is correct; a global state manager would be over-engineering.

### Persistence

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-store | ^10.x | Persist user settings | Key-value store backed by JSON file in `app.getPath('userData')`. Handles output path, auto-open toggle. Simple, zero-config, Electron-native path handling. |

**Do NOT use:**
- SQLite — overkill for flat settings storage.
- `localStorage` in renderer — not reliable for Electron (survives session resets poorly, stored in app's cache partition).
- Plain `fs.writeFileSync` to a config file — electron-store already does this correctly with atomic writes and proper path resolution.

**Confidence:** HIGH — electron-store is the standard Electron settings solution.

### Dev Tools

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | ^5.x | Type safety | Strongly recommended even for a solo project; catches IPC contract mismatches at compile time. |
| ESLint + eslint-plugin-svelte | ^9.x / ^3.x | Linting | Standard Svelte linting setup. |
| Prettier | ^3.x | Formatting | Format consistency. |
| Vitest | ^3.x | Unit testing | Vite-native test runner; can test pdf-lib manipulation logic without Electron. |
| electron-vite dev mode | — | HMR during dev | Reload renderer on change without restarting Electron process. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF manipulation | pdf-lib | hummus-recipe, node-pdftk | Native binary deps; complex Electron packaging |
| PDF rendering | pdfjs-dist + browser canvas | pdf2pic, sharp, Puppeteer | External binary deps (ImageMagick, Chromium); packaging complexity |
| Scaffolding | electron-vite | electron-forge | electron-forge Svelte support requires manual config; electron-vite has first-class Svelte template |
| Packaging | electron-builder | electron-forge makeTargets | electron-builder has superior NSIS control and better GitHub Releases updater integration |
| Auto-update | electron-updater | Electron built-in autoUpdater | Built-in requires Squirrel server; electron-updater works directly with GitHub Releases |
| Settings persistence | electron-store | localStorage, raw fs, SQLite | electron-store handles Electron path semantics correctly with atomic writes |
| State management | Svelte built-ins | Pinia, Zustand | Overkill for a single-window utility |
| Installer format | NSIS | Squirrel.Windows, AppX | NSIS is more configurable; AppX requires Store enrollment |
| IPC | contextBridge + ipcMain.handle | nodeIntegration | nodeIntegration is a security vulnerability |

---

## Installation

```bash
# Scaffold with electron-vite (Svelte template)
npm create @quick-start/electron pdf-chisel -- --template svelte-ts

# PDF processing
npm install pdf-lib pdfjs-dist

# Packaging + auto-update
npm install -D electron-builder
npm install electron-updater

# Settings persistence
npm install electron-store

# Dev tooling (adjust to taste)
npm install -D typescript eslint eslint-plugin-svelte prettier vitest
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Electron version | MEDIUM | v34.x is an estimate based on 8-week release cadence from v32 (mid-2025); verify on electronjs.org before pinning |
| Svelte 5 recommendation | HIGH | Svelte 5 stable since Oct 2024; runes are the documented forward path |
| pdf-lib for manipulation | HIGH | No viable pure-JS alternative; well-maintained, widely used |
| pdfjs-dist for rendering | HIGH | Mozilla-maintained; canonical PDF rendering library for JS |
| electron-vite scaffolding | HIGH | First-class Svelte template; actively maintained |
| electron-builder packaging | HIGH | Mature, NSIS support, GitHub Releases updater integration |
| electron-updater | HIGH | Standard for open-source Electron auto-update |
| contextBridge IPC pattern | HIGH | Documented Electron security requirement |
| electron-store | HIGH | Standard Electron settings solution |
| "No native binaries" constraint | HIGH | Fundamental to self-contained Windows installer; drives every library choice |

---

## Critical Constraint Reminder

Every library choice must satisfy: **no native binary dependencies**. Node addons requiring compilation (`.node` files) must be rebuilt for the Electron ABI at package time — this is fragile, adds CI complexity, and complicates the NSIS installer. The recommended stack is 100% pure JS/TS, avoiding this entirely.

The one exception to watch: if `node-canvas` becomes necessary (e.g., rendering in main process), it has native deps and would require `electron-rebuild` in the build pipeline. The architecture recommendation (render in renderer via browser canvas) is specifically chosen to avoid this.

---

## Sources

- Training data (Claude, current through August 2025) — MEDIUM confidence for versions, HIGH for architectural patterns
- PROJECT.md constraints (local processing, Windows-only, GitHub Releases distribution) — primary decision driver
- Electron documentation patterns: https://www.electronjs.org/docs/latest/tutorial/ipc (contextBridge + handle pattern)
- electron-vite: https://electron-vite.org/
- electron-builder: https://www.electron.build/
- pdf-lib: https://pdf-lib.js.org/
- pdfjs-dist: https://mozilla.github.io/pdf.js/
- electron-store: https://github.com/sindresorhus/electron-store
- electron-updater: https://www.electron.build/auto-update

**Note:** URLs above are from training data. Verify that these pages still exist and reflect current recommendations before committing to specific versions.
