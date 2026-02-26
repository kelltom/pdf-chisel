# Phase 1: Electron Foundation - Research

**Researched:** 2026-02-22
**Domain:** Electron + Svelte 5 + electron-vite scaffolding, IPC security, file input
**Confidence:** HIGH (verified against npm registry, official Electron docs, official electron-vite docs, and official Svelte docs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| APP-01 | App displays top app-bar with "PDF Chisel" title on the left | Custom title bar via `titleBarStyle: 'hidden'` + `titleBarOverlay: true` + `-webkit-app-region: drag` CSS; Svelte component renders title text |
| APP-02 | App displays a settings gear icon in the top-right of the app-bar that navigates to the settings page | Svelte `$state` currentMode variable in `.svelte.ts` module; gear icon click sets mode to 'settings'; no external router needed |
| APP-03 | App displays a vertical mode selector on the left edge with icons for all 4 modes (Extract, Split, Convert, Merge) | Svelte `{#if}` blocks switching between mode components; icon SVGs in static assets; vertical nav is pure CSS |
| APP-04 | Selecting a mode from the vertical nav renders that mode's view in the main body area | `$state` currentMode variable drives `{#if}` conditional rendering in App.svelte root; components are unmounted/mounted on switch |
| FILE-01 | User can select PDF file(s) via a native file browser dialog | `dialog.showOpenDialog()` in main process exposed via `ipcMain.handle('dialog:open-pdf', ...)` and `ipcRenderer.invoke` in preload |
| FILE-02 | User can drag-and-drop PDF file(s) onto the file input area | HTML5 drag events in renderer; `webUtils.getPathForFile(file)` called in preload (exposed via contextBridge) to convert File objects to paths — required in Electron 32+ |
| FILE-03 | App displays the selected file name and page count after a file is loaded | `pdf-lib` `PDFDocument.load(bytes)` + `.getPageCount()` in main process (Worker Thread); result sent back via IPC to renderer state |
</phase_requirements>

---

## Summary

Phase 1 builds the Electron application shell: a correctly secured Electron window, a Svelte 5 UI with mode navigation, and PDF file loading with basic metadata reading. The stack is well-defined — `electron-vite` 5.0 scaffolds the three-process Electron architecture (main / preload / renderer) and handles HMR during development. All security constraints (contextIsolation, nodeIntegration disabled) are Electron defaults since v12/v20 and are explicitly confirmed in the scaffold template.

The most important non-obvious finding is the **drag-and-drop file path change in Electron 32+**: the `.path` property on `File` objects was removed and replaced with `webUtils.getPathForFile()`, which must be called from the preload script. Any implementation that uses `event.dataTransfer.files[0].path` directly in the renderer will silently return `undefined` on Electron 34. The correct pattern calls `webUtils.getPathForFile(file)` in a preload-exposed function and passes the resolved path to the main process via IPC.

The UI architecture is straightforward: a `$state`-backed `currentMode` variable in a shared `.svelte.ts` module drives conditional rendering via `{#if}` blocks in `App.svelte`. No router library is needed for a 4-mode tool. Svelte 5 runes (`$state`, `$derived`) replace the old writable store pattern and are the correct approach for Electron + Svelte 5 in 2026.

**Primary recommendation:** Scaffold with `npm create @quick-start/electron@latest -- --template svelte-ts`, pin Electron to ~34 (downgrade from template default of ~39), then implement the IPC scaffold, custom title bar, mode nav, and file input in sequence.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | ~34.5.8 | Desktop app runtime | Project-specified version; LTS-era release |
| electron-vite | 5.0.0 | Build tool: bundles main/preload/renderer, HMR | Official build tool for electron-vite ecosystem; replaces manual vite + electron setup |
| svelte | 5.x (^5.53.2 latest) | Renderer UI framework | Project-specified; runes-based reactivity, no virtual DOM, minimal bundle |
| @sveltejs/vite-plugin-svelte | ^4.0.0 (stable) or ^6.x | Svelte HMR in Vite renderer | Official Vite integration for Svelte; included in electron-vite scaffold |
| electron-builder | ^26.8.1 | Packaging + NSIS installer | Most mature Electron packager; native Windows NSIS support |
| @electron-toolkit/preload | ^3.0.2 | Preload boilerplate: exposes ipcRenderer, webFrame, process | Eliminates contextBridge boilerplate; handles contextIsolation/no-isolation branching |
| @electron-toolkit/utils | ^4.0.0 | Dev shortcuts (F12 DevTools), is-dev check | Standard utility from electron-vite ecosystem |
| pdf-lib | ^1.17.1 | PDF loading + page count in Phase 1; full manipulation in Phase 2+ | Pure JS, no native binaries; project-specified |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | ^5.x | Type safety across all three processes | Project uses TypeScript variant of scaffold |
| vite | ^7.x | Underlying bundler (transitive via electron-vite) | Managed by electron-vite; do not configure independently |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-vite | electron-forge | electron-forge is more opinionated, heavier; electron-vite is lighter and has better HMR story |
| pdf-lib for page count | pdfjs-dist | pdfjs-dist is renderer-side rendering library; using it for metadata in Phase 1 is over-engineering; save for Phase 3 |
| $state in .svelte.ts | svelte/store writable | Svelte stores work in Svelte 5 but are the legacy pattern; runes are the current idiom |

**Installation:**
```bash
# Scaffold (run once)
npm create @quick-start/electron@latest pdf-chisel -- --template svelte-ts

# After scaffold, pin Electron to 34 in package.json devDependencies:
# "electron": "~34.5.8"

# pdf-lib is added in Phase 1 (for page count); install in main process context:
npm install pdf-lib
```

---

## Architecture Patterns

### Recommended Project Structure
```
pdf-chisel/
├── src/
│   ├── main/
│   │   └── index.ts          # BrowserWindow, ipcMain.handle, app lifecycle
│   ├── preload/
│   │   └── index.ts          # contextBridge.exposeInMainWorld, webUtils
│   └── renderer/
│       └── src/
│           ├── App.svelte     # Root component: app-bar + nav + mode body
│           ├── lib/
│           │   ├── stores/
│           │   │   └── app.svelte.ts   # $state currentMode, currentFile
│           │   └── components/
│           │       ├── AppBar.svelte
│           │       ├── NavRail.svelte
│           │       ├── FileInput.svelte
│           │       └── modes/
│           │           ├── ExtractMode.svelte
│           │           ├── SplitMode.svelte
│           │           ├── ConvertMode.svelte
│           │           ├── MergeMode.svelte
│           │           └── SettingsMode.svelte
│           └── main.ts
├── resources/
│   └── icon.png
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── tsconfig.node.json  (main + preload)
└── tsconfig.web.json   (renderer)
```

### Pattern 1: IPC Channel Contract — Renderer-to-Main with Response
**What:** Renderer invokes a named channel; main handles it asynchronously and returns a value.
**When to use:** Any operation requiring Node.js/filesystem access (file dialog, PDF reading).

```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/ipc

// --- src/main/index.ts ---
import { ipcMain, dialog } from 'electron'
import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'

ipcMain.handle('dialog:open-pdf', async (_event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return null

  const bytes = await readFile(filePaths[0])
  const doc = await PDFDocument.load(bytes)
  return {
    filePath: filePaths[0],
    fileName: filePaths[0].split(/[\\/]/).pop(),
    pageCount: doc.getPageCount()
  }
})

// --- src/preload/index.ts ---
import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openPdf: () => ipcRenderer.invoke('dialog:open-pdf'),
  // webUtils.getPathForFile MUST be called in preload (Electron 32+)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
})

// --- renderer: FileInput.svelte ---
// <script lang="ts">
//   import { fileState } from '../lib/stores/app.svelte.ts'
//
//   async function openFile() {
//     const result = await window.electronAPI.openPdf()
//     if (result) fileState.current = result
//   }
//
//   async function onDrop(e: DragEvent) {
//     e.preventDefault()
//     const files = [...(e.dataTransfer?.files ?? [])]
//     if (files.length === 0) return
//     const path = window.electronAPI.getPathForFile(files[0])
//     // send path to main to read metadata
//     const result = await window.electronAPI.getFileInfo(path)
//     if (result) fileState.current = result
//   }
// </script>
```

### Pattern 2: Svelte 5 Global State in `.svelte.ts` Module
**What:** Shared reactive state using `$state` rune in a module file — imported by any component.
**When to use:** Any state that must survive component unmount/remount (current mode, loaded file).

```typescript
// Source: https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/
// src/renderer/src/lib/stores/app.svelte.ts

export type Mode = 'extract' | 'split' | 'convert' | 'merge' | 'settings'

export interface FileInfo {
  filePath: string
  fileName: string
  pageCount: number
}

// Plain object with $state — Svelte proxies it automatically
export const appState = $state({
  currentMode: 'extract' as Mode,
  currentFile: null as FileInfo | null,
})
```

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { appState, type Mode } from './lib/stores/app.svelte.ts'
  import AppBar from './lib/components/AppBar.svelte'
  import NavRail from './lib/components/NavRail.svelte'
  import ExtractMode from './lib/components/modes/ExtractMode.svelte'
  import SplitMode from './lib/components/modes/SplitMode.svelte'
  import ConvertMode from './lib/components/modes/ConvertMode.svelte'
  import MergeMode from './lib/components/modes/MergeMode.svelte'
  import SettingsMode from './lib/components/modes/SettingsMode.svelte'
</script>

<div class="app-shell">
  <AppBar />
  <div class="body">
    <NavRail currentMode={appState.currentMode} onModeChange={(m: Mode) => appState.currentMode = m} />
    <main class="content">
      {#if appState.currentMode === 'extract'}
        <ExtractMode />
      {:else if appState.currentMode === 'split'}
        <SplitMode />
      {:else if appState.currentMode === 'convert'}
        <ConvertMode />
      {:else if appState.currentMode === 'merge'}
        <MergeMode />
      {:else if appState.currentMode === 'settings'}
        <SettingsMode />
      {/if}
    </main>
  </div>
</div>
```

### Pattern 3: Custom App Bar (Windows — titleBarStyle hidden)
**What:** Hide native title bar; render custom HTML bar; use CSS `app-region: drag` for drag; `titleBarOverlay: true` keeps native window controls.
**When to use:** When the design calls for a custom app bar with the app title and custom icons.

```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar

// src/main/index.ts
const mainWindow = new BrowserWindow({
  width: 1100,
  height: 700,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#1e1e2e',       // match app background
    symbolColor: '#cdd6f4', // match text color
    height: 40              // match app-bar height
  },
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,           // required to use @electron-toolkit/preload
    contextIsolation: true,   // default in Electron 12+, must be explicit
    nodeIntegration: false,   // default since Electron 5, must be explicit
  }
})
```

```svelte
<!-- AppBar.svelte -->
<style>
  .app-bar {
    height: 40px;
    /* -webkit- prefix required in Electron renderer (uses Chromium) */
    -webkit-app-region: drag;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: #1e1e2e;
  }
  /* Buttons inside the bar must opt OUT of dragging */
  .settings-btn {
    -webkit-app-region: no-drag;
  }
</style>

<div class="app-bar">
  <span class="title">PDF Chisel</span>
  <button class="settings-btn" onclick={() => appState.currentMode = 'settings'}>
    <!-- gear icon SVG -->
  </button>
</div>
```

### Pattern 4: Drag-and-Drop File Input (Electron 32+ Safe)
**What:** HTML5 drop zone in renderer; `webUtils.getPathForFile()` in preload resolves real filesystem paths.
**When to use:** FILE-02 — any drag-and-drop file input in the app.

```typescript
// CRITICAL: File.path was removed in Electron 32. Use webUtils.getPathForFile in preload.
// Source: https://www.electronjs.org/docs/latest/api/web-utils

// src/preload/index.ts (addition to contextBridge API)
import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ... other methods
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('file:get-info', filePath),
})
```

```svelte
<!-- FileInput.svelte drop handler -->
<script lang="ts">
  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer?.files ?? [])
    const pdfFiles = files.filter(f => f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) return

    // webUtils.getPathForFile resolves absolute path in preload context
    const filePath = window.electronAPI.getPathForFile(pdfFiles[0])
    const result = await window.electronAPI.getFileInfo(filePath)
    if (result) appState.currentFile = result
  }
</script>

<div
  class="drop-zone"
  role="region"
  ondragover={(e) => e.preventDefault()}
  ondrop={handleDrop}
>
  Drop PDF here or <button onclick={openDialog}>Browse</button>
</div>
```

### Pattern 5: IPC Channel for File Info (Path Already Known)
**What:** Main process handler that reads a file by path and returns metadata. Used when path comes from drag-drop (vs dialog).
**When to use:** When the renderer already has a file path (from drag-drop) and needs metadata.

```typescript
// src/main/index.ts
ipcMain.handle('file:get-info', async (_event, filePath: string) => {
  try {
    const bytes = await readFile(filePath)
    const doc = await PDFDocument.load(bytes)
    return {
      filePath,
      fileName: filePath.split(/[\\/]/).pop() ?? filePath,
      pageCount: doc.getPageCount()
    }
  } catch (err) {
    return { error: String(err) }
  }
})
```

### Anti-Patterns to Avoid

- **`nodeIntegration: true`**: Never use this. It exposes the full Node.js API to renderer — a major security vulnerability. All Node.js work goes through IPC.
- **`file.path` in drag-drop handler**: Removed in Electron 32. Returns `undefined` silently on Electron 34. Use `webUtils.getPathForFile(file)` in preload instead.
- **`ipcRenderer.removeAllListeners()` without channel name**: Breaks Electron internals. Always specify the channel: `ipcRenderer.removeAllListeners('my-channel')`.
- **Accumulating `ipcMain.on` listeners**: If `createWindow()` is called more than once (macOS re-focus pattern), `ipcMain.on` handlers stack up. Use `ipcMain.handle` (single handler) or guard with `ipcMain.removeHandler` before re-registering.
- **PDF loading in renderer process**: pdf-lib's `PDFDocument.load()` blocks the event loop. Always run it in the main process (or Worker Thread for heavy files). In Phase 1, basic load + getPageCount in main process is acceptable; Phase 2 migrates to Worker Thread.
- **Using Svelte 4 writable stores for new code**: Works in Svelte 5 but is the legacy pattern. Use `$state` in `.svelte.ts` files for all new shared state.
- **Hash router dependency for Electron**: Not needed — the project uses Svelte store-based mode switching, no router. Hash routers are only needed if you want URL-like navigation in the renderer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preload contextBridge boilerplate | Custom exposeInMainWorld wrapper | `@electron-toolkit/preload` | Handles contextIsolation-on and -off branching, typed API surface |
| Dev shortcuts (F12, reload) | Custom event listeners | `@electron-toolkit/utils` `optimizer.watchWindowShortcut` | One-line setup, handles platform differences |
| PDF page count | Manual PDF header parsing | `pdf-lib` `PDFDocument.load().getPageCount()` | Handles encrypted headers, malformed PDFs, cross-reference tables |
| File dialog | Custom HTML file input | `dialog.showOpenDialog()` in main process | Native OS dialog, correct file type filtering, multi-file selection |
| Window dragging | Custom mouse event tracking | `-webkit-app-region: drag` CSS | Chromium-native, handles snap/maximize, no JS needed |

**Key insight:** The electron-vite scaffold template generates almost all the boilerplate needed — main/preload/renderer wiring, HMR, TypeScript configs. The primary work in Phase 1 is replacing the template's placeholder content with the app's actual UI structure.

---

## Common Pitfalls

### Pitfall 1: `file.path` Removed in Electron 32 for Drag-and-Drop
**What goes wrong:** Drag-and-drop handler in renderer does `event.dataTransfer.files[0].path` — returns `undefined` on Electron 34. File dialog still works via `dialog.showOpenDialog`. Only drag-and-drop is affected.
**Why it happens:** Chromium security changes removed the non-standard `.path` property from `File` objects in drag events (issue #44370, fixed in Electron 32 release notes).
**How to avoid:** Use `webUtils.getPathForFile(file)` in the preload script exposed via contextBridge. `webUtils` is importable from `'electron'` in preload context.
**Warning signs:** Drop handler appears to fire but `filePath` is an empty string `""`.

### Pitfall 2: Preload Sandbox Mode Blocks Module Imports
**What goes wrong:** `require('fs')` or `require('path')` in a preload script throws `Module not found` in production.
**Why it happens:** Since Electron 20, preload scripts are sandboxed by default. Sandboxed preloads can only access: `contextBridge`, `ipcRenderer`, `webFrame`, `webUtils`, `crashReporter`, `nativeImage` — not full Node.js.
**How to avoid:** Set `sandbox: false` in `BrowserWindow.webPreferences`. The electron-vite svelte-ts scaffold does this by default. Alternatively, bundle all preload dependencies.
**Warning signs:** Works in dev (`electron-vite dev`) but fails after `electron-vite build`.

### Pitfall 3: IPC Listener Accumulation on Window Recreation
**What goes wrong:** App uses `ipcMain.on('channel', handler)` — on macOS, when the window is closed and reopened (app stays running), a new `on` listener stacks on top of the old one. Handler fires multiple times per invocation.
**Why it happens:** `ipcMain.on` adds an additional listener each call. `ipcMain.handle` only allows one handler and throws if you try to register a second.
**How to avoid:** Use `ipcMain.handle` for all request/response IPC (the `invoke/handle` pattern). For one-way notifications, call `ipcMain.removeHandler('channel')` before re-registering.
**Warning signs:** Console shows duplicate log entries; callbacks fire N times where N = number of window creations.

### Pitfall 4: `$state` Object Exported Directly Cannot Be Reassigned
**What goes wrong:** `export let currentMode = $state('extract')` — importing module tries to do `currentMode = 'split'` — fails because exported bindings are read-only.
**Why it happens:** ES module exports are live bindings but cannot be reassigned by importers. `$state` at module level is a reactive variable, but importers only see a reference.
**How to avoid:** Export a `$state` **object** and mutate its properties: `export const appState = $state({ currentMode: 'extract' })`. Then `appState.currentMode = 'split'` works everywhere.
**Warning signs:** Mode switches appear to not update UI; no error thrown.

### Pitfall 5: `titleBarOverlay` Height Must Match App Bar CSS Height
**What goes wrong:** Native window controls (minimize/maximize/close) appear at wrong vertical position relative to custom app bar — either clipped or floating above it.
**Why it happens:** `titleBarOverlay.height` in `BrowserWindow` options must exactly match the CSS `height` of the custom `.app-bar` element in pixels.
**How to avoid:** Define app bar height as a CSS variable AND pass the same numeric value to `titleBarOverlay`. Keep them in sync when changing design.
**Warning signs:** Window controls appear misaligned; app bar extends under/over them.

### Pitfall 6: electron-vite Requires Node.js 20.19+ or 22.12+
**What goes wrong:** `electron-vite dev` fails immediately with Node.js version error.
**Why it happens:** electron-vite 5.0 dropped support for older Node.js versions (Vite 7 requirement).
**How to avoid:** Verify Node.js version before starting: `node --version`. Developer's current Node.js is v24.13.1 (confirmed — compatible).
**Warning signs:** Install works but `npm run dev` fails with a cryptic version error.

---

## Code Examples

Verified patterns from official sources:

### electron.vite.config.ts (Svelte-TS Scaffold)
```typescript
// Source: https://electron-vite.org/guide/ + official template inspection
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [svelte()]
  }
})
```

### BrowserWindow Creation (Secure + Custom Title Bar)
```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
// Source: https://www.electronjs.org/docs/latest/tutorial/security
import { join } from 'path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e2e',
      symbolColor: '#cdd6f4',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,         // Required for @electron-toolkit/preload
      contextIsolation: true, // Default since Electron 12; explicit for clarity
      nodeIntegration: false  // Default since Electron 5; explicit for DevTools verification
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
```

### Preload Script (contextBridge with webUtils)
```typescript
// Source: https://www.electronjs.org/docs/latest/api/web-utils
// Source: https://www.electronjs.org/docs/latest/tutorial/ipc
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // File dialog (FILE-01)
  openPdf: (): Promise<PdfFileInfo | null> =>
    ipcRenderer.invoke('dialog:open-pdf'),

  // Drag-drop path resolution (FILE-02) — MUST be in preload, not renderer
  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  // File info from known path (FILE-02 + FILE-03 secondary path)
  getFileInfo: (filePath: string): Promise<PdfFileInfo | null> =>
    ipcRenderer.invoke('file:get-info', filePath),
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
```

### pdf-lib Page Count
```typescript
// Source: https://pdf-lib.js.org/docs/api/classes/pdfdocument
import { readFile } from 'fs/promises'
import { PDFDocument } from 'pdf-lib'

async function getPdfInfo(filePath: string) {
  const bytes = await readFile(filePath)
  const doc = await PDFDocument.load(bytes)
  return {
    pageCount: doc.getPageCount(),    // number
    title: doc.getTitle(),            // string | undefined
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `file.path` on drag-drop File | `webUtils.getPathForFile(file)` in preload | Electron 32 (2024) | Breaking — must update or drag-drop silently breaks |
| `ipcRenderer.send` + `ipcMain.on` + reply | `ipcRenderer.invoke` + `ipcMain.handle` | Electron 7 (2019), now idiomatic | Use invoke/handle for all request/response IPC |
| Svelte 4 `writable()` stores | Svelte 5 `$state()` rune in `.svelte.ts` | Svelte 5 GA (Oct 2024) | Old stores still work but are legacy; runes are idiomatic |
| `nodeIntegration: true` | preload + contextBridge | Best practice since Electron 5 | nodeIntegration: true is a security failure |
| Electron 20 sandbox off by default | sandbox on by default since Electron 20 | Electron 20 (2022) | Preload scripts need `sandbox: false` to use Node.js modules (or fully bundle deps) |
| electron-builder 24.x | electron-builder 26.x | 2024 | v26 is current stable for Windows NSIS builds |

**Deprecated/outdated:**
- `File.path`: Removed in Electron 32 for drag-drop contexts. Do not use.
- `remote` module: Removed in Electron 14. Use IPC.
- `nodeIntegration: true`: Never acceptable in new code.
- Svelte `writable` stores for new Svelte 5 code: Works but is legacy idiom.

---

## Open Questions

1. **Should the app bar use `titleBarStyle: 'hidden'` + native overlay, or `frame: false` + fully custom controls?**
   - What we know: `titleBarStyle: 'hidden'` with `titleBarOverlay: true` keeps native Win32 controls (minimize/maximize/close) with native behavior (snap, drag-resize); `frame: false` requires re-implementing all controls.
   - What's unclear: Whether the designer wants the native Windows control icons or fully custom ones.
   - Recommendation: Use `titleBarStyle: 'hidden'` + `titleBarOverlay`. Native controls are correct behavior for a Windows utility; avoids implementing window management.

2. **Mode state: unmount vs hide (CSS `display: none`) for non-active modes?**
   - What we know: Svelte `{#if}` unmounts components (loses state, cheaper memory); CSS hide keeps components alive (retains state, higher memory). Phase 1 modes have no persistent per-mode state yet.
   - What's unclear: Whether Phase 2 will need to preserve in-progress per-mode state across mode switches (e.g., preserve page range input when user switches to settings and back).
   - Recommendation: Use `{#if}` (unmount) in Phase 1 — simpler. Phase 4 (electron-store) adds persistence anyway, so in-memory preservation is unnecessary.

3. **PDF loading for page count: direct in main process or Worker Thread from the start?**
   - What we know: Worker Threads are the correct long-term pattern (Phase 2 uses them for all PDF processing). For Phase 1, `PDFDocument.load()` on a PDF just to get page count is I/O + parsing — could block main for large files.
   - What's unclear: How large PDFs users will load in Phase 1 testing.
   - Recommendation: Run directly in main process for Phase 1 (acceptable for metadata-only). Establish Worker Thread pattern in Phase 2 when actual PDF mutations begin.

---

## Sources

### Primary (HIGH confidence)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc) — ipcMain.handle, contextBridge patterns
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) — contextIsolation, nodeIntegration, sandbox defaults
- [Electron webUtils API](https://www.electronjs.org/docs/latest/api/web-utils) — webUtils.getPathForFile usage
- [Electron Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) — titleBarStyle, titleBarOverlay patterns
- [electron-vite Getting Started](https://electron-vite.org/guide/) — scaffold command, project structure, Node.js requirements
- [electron-vite Development Guide](https://electron-vite.org/guide/dev) — preload sandbox, HMR, worker threads
- npm registry — verified versions: electron-vite@5.0.0, electron@34.5.8, svelte@5.53.2, pdf-lib@1.17.1, electron-builder@26.8.1
- [pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument) — load(), getPageCount()

### Secondary (MEDIUM confidence)
- [Mainmatter: Global State in Svelte 5](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/) — $state in .svelte.ts modules, object mutation pattern — verified against Svelte 5 migration guide
- [SummerTown: Drag-Drop File Paths in Electron](https://jiaopucun.com/2025/04/04/drag-drop-files-electron-file-paths/) — webUtils.getPathForFile in preload, verified against official API docs
- [electron-vite worker example](https://github.com/alex8088/electron-vite-worker-example) — ?nodeWorker import syntax, verified against electron-vite feature list

### Tertiary (LOW confidence)
- [Electron issue #47284](https://github.com/electron/electron/issues/47284) — File.path removed for drag-drop in v36.3.1+ (issue states specific version — LOW because issue may predate actual release; confirmed the removal happened in Electron 32 range via release notes reference)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via npm registry; scaffold template inspected via GitHub raw files
- Architecture: HIGH — IPC patterns from official Electron docs; Svelte 5 state from official migration guide
- Pitfalls: HIGH for items 1-4 (official sources); MEDIUM for items 5-6 (based on docs + common sense)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days — stack is stable; electron-vite 5.0 is current release)
