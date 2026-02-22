# Architecture Patterns

**Domain:** Electron + Svelte PDF desktop utility
**Researched:** 2026-02-22
**Confidence:** HIGH for Electron process model and IPC patterns (stable across Electron v20-v34); MEDIUM for Svelte-specific structuring (based on community conventions)

---

## Recommended Architecture

### Process Boundary Overview

```
┌─────────────────────────────────────────────────────────────┐
│  MAIN PROCESS (Node.js)                                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ app        │  │ PDF Workers  │  │ Auto-Updater        │  │
│  │ lifecycle  │  │ (Worker      │  │ (electron-updater)  │  │
│  │            │  │  Threads)    │  │                     │  │
│  └────────────┘  └──────────────┘  └─────────────────────┘  │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ ipcMain    │  │ File I/O     │  │ Settings store      │  │
│  │ handlers   │  │ (fs/path)    │  │ (electron-store)    │  │
│  └────────────┘  └──────────────┘  └─────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ contextBridge (preload.js)
                         │ exposes typed API surface only
┌────────────────────────┴────────────────────────────────────┐
│  RENDERER PROCESS (Chromium + Svelte)                        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  App Shell (App.svelte)                              │    │
│  │  ┌─────────────┐   ┌────────────────────────────┐   │    │
│  │  │ AppBar      │   │ ModeSidebar                │   │    │
│  │  │ (title,     │   │ (Extract / Split /         │   │    │
│  │  │  settings)  │   │  Convert / Merge)          │   │    │
│  │  └─────────────┘   └────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │  View Area (one active mode at a time)       │   │    │
│  │  │  ┌──────────┐ ┌───────┐ ┌─────────┐ ┌────┐  │   │    │
│  │  │  │ Extract  │ │ Split │ │ Convert │ │Merge│  │   │    │
│  │  │  │  View    │ │ View  │ │  View   │ │View │  │   │    │
│  │  │  └──────────┘ └───────┘ └─────────┘ └────┘  │   │    │
│  │  │                                              │   │    │
│  │  │  Shared Components (used by all views):      │   │    │
│  │  │  FilePicker | PageRangeInput |               │   │    │
│  │  │  OutputDestPicker | ProgressBar |            │   │    │
│  │  │  ResultPanel                                 │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │  Settings View (overlay/page)                │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────┘    │    │
└─────────────────────────────────────────────────────────────┘
```

---

### Component Boundaries

| Component | Process | Responsibility | Communicates With |
|-----------|---------|---------------|-------------------|
| `main.js` | Main | App lifecycle, window creation, BrowserWindow config | ipcMain, auto-updater, workers |
| `preload.js` | Main (loaded in renderer context) | Expose typed API to renderer via `contextBridge` | main.js (ipcRenderer), renderer (window.api) |
| `workers/pdfWorker.js` | Main — Worker Thread | All CPU-bound PDF processing (pdf-lib, pdfjs-dist) | main.js via worker_threads message passing |
| `ipcHandlers.js` | Main | Register all `ipcMain.handle()` calls, delegate to workers | pdfWorker.js, electron-store, fs |
| `updater.js` | Main | electron-updater logic, check/download/install, notify renderer | ipcMain (push events to renderer) |
| `App.svelte` | Renderer | Root shell, layout, mode routing | Svelte stores, child components |
| `ModeSidebar.svelte` | Renderer | Mode selection navigation | `activeMode` store |
| `AppBar.svelte` | Renderer | Title, settings gear button | `activeMode` store |
| `Extract/Split/Convert/MergeView.svelte` | Renderer | Mode-specific form and logic | Shared components, `window.api`, operation store |
| `ReviewView.svelte` | Renderer | Post-convert image review workflow (copy & next) | `window.api.clipboard`, Convert store |
| `SettingsView.svelte` | Renderer | Default output path, auto-open toggle, update status | `window.api`, `settings` store |
| `FilePicker.svelte` | Renderer | File open dialog trigger + display selected paths | `window.api.openFileDialog` |
| `PageRangeInput.svelte` | Renderer | Parse and validate page range strings | No IPC — pure UI logic |
| `OutputDestPicker.svelte` | Renderer | Output folder selection + persist | `window.api.openDirectoryDialog`, `settings` store |
| `ProgressBar.svelte` | Renderer | Progress display during operations | `operation` store |
| `ResultPanel.svelte` | Renderer | Success/error display + open folder button | `window.api.openFolder` |

---

### Main Process vs Renderer Split

**What belongs in Main process:**
- Window management (creating, configuring `BrowserWindow`)
- All file system access (`fs`, `path`) — renderer has no direct fs access
- PDF processing library calls (pdf-lib, pdfjs-dist rendering) — CPU-bound, must not block renderer
- `dialog.showOpenDialog` / `dialog.showSaveDialog` — native OS dialogs are main-only
- `shell.openPath` — opening output folders in Explorer
- `electron-store` reads/writes — settings persistence
- Auto-updater (`electron-updater`) — network access, installer execution
- All `ipcMain.handle()` registrations

**What belongs in Renderer process:**
- All Svelte UI — components, stores, reactive state
- Form validation logic (page range parsing, input validation)
- UI state management (which mode is active, what files are selected)
- Display of progress, results, errors
- Clipboard operations via Electron API exposed through preload (not raw `navigator.clipboard` for file images)

**The rule:** If it touches the OS, filesystem, or does CPU work, it lives in main. If it drives what the user sees, it lives in the renderer.

---

### IPC Communication Patterns

#### Pattern: Preload + contextBridge (the only correct approach)

`contextBridge` exposes a typed, minimal API surface to the renderer. The renderer never gets access to Node.js or raw Electron internals.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // File operations
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:openFolder', folderPath),

  // PDF operations (all invoke = two-way, renderer awaits result)
  extractPages: (params) => ipcRenderer.invoke('pdf:extract', params),
  splitPdf: (params) => ipcRenderer.invoke('pdf:split', params),
  convertToImages: (params) => ipcRenderer.invoke('pdf:convertImages', params),
  mergePdfs: (params) => ipcRenderer.invoke('pdf:merge', params),

  // Progress events (one-way: main pushes to renderer)
  onProgress: (callback) => {
    ipcRenderer.on('pdf:progress', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('pdf:progress')
  },

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Auto-update
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update:available', (_, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update:available')
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Clipboard (for review workflow)
  copyImageToClipboard: (imagePath) => ipcRenderer.invoke('clipboard:copyImage', imagePath),
})
```

```javascript
// In Svelte component
const result = await window.api.extractPages({ inputPath, pages, outputDir })

// Subscribe to progress
const unsubscribe = window.api.onProgress((data) => {
  progressStore.set(data.percent)
})
onDestroy(unsubscribe)
```

**IPC channel naming convention:** `domain:action` (e.g., `pdf:extract`, `dialog:openFile`, `settings:get`). Consistent naming avoids collision as the app grows.

**Two-way vs one-way:**
- `ipcRenderer.invoke` + `ipcMain.handle` = two-way (renderer sends, awaits response). Use for all operations where renderer needs result or confirmation.
- `webContents.send` (main → renderer) = one-way push. Use for progress events and update notifications where main needs to push state the renderer didn't request.

---

### PDF Processing: Where It Lives

**Recommendation: Worker Threads in the Main process.**

```
Renderer → ipcMain.handle('pdf:extract') → pdfWorker (Worker Thread) → resolves back to ipcMain → returns to renderer
```

**Why Worker Threads over alternatives:**

| Approach | Why Not |
|----------|---------|
| Directly in main process (blocking) | Blocks all IPC — UI freezes, progress events can't be sent |
| `child_process.fork()` | Higher overhead, harder to pass Buffer data, requires separate module |
| Web Workers in renderer | Can't access filesystem; pdf-lib is designed for Node.js |
| Worker Threads in main | Node.js native, shared memory possible, can post progress messages, clean teardown |

**Worker Thread pattern:**

```javascript
// main/workers/pdfWorker.js
const { parentPort, workerData } = require('worker_threads')
const { extractPages } = require('../lib/pdfOperations')

parentPort.on('message', async ({ operation, params }) => {
  try {
    // Send progress updates as work proceeds
    const onProgress = (percent) => parentPort.postMessage({ type: 'progress', percent })
    const result = await extractPages(params, onProgress)
    parentPort.postMessage({ type: 'done', result })
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: err.message })
  }
})
```

```javascript
// main/ipcHandlers.js — spinning up a worker per operation
const { Worker } = require('worker_threads')

ipcMain.handle('pdf:extract', (event, params) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/pdfWorker.js')
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        event.sender.send('pdf:progress', { percent: msg.percent })
      } else if (msg.type === 'done') {
        resolve(msg.result)
      } else if (msg.type === 'error') {
        reject(new Error(msg.message))
      }
    })
    worker.postMessage({ operation: 'extract', params })
  })
})
```

**pdf-lib** handles creation/manipulation. **pdfjs-dist** handles rendering (required for Convert mode — turning PDF pages into rasterized images). Both run in the worker thread, not the renderer.

---

### Svelte Application Structure

#### Mode Routing (no URL router needed)

With only 4 modes + settings, a simple Svelte store drives which view is rendered. No need for `svelte-routing` or `svelte-navigator` — conditional rendering is sufficient and simpler.

```javascript
// src/stores/activeMode.js
import { writable } from 'svelte/store'

export const MODES = ['extract', 'split', 'convert', 'merge']
export const activeMode = writable('extract')
export const showSettings = writable(false)
```

```svelte
<!-- App.svelte -->
{#if $showSettings}
  <SettingsView />
{:else if $activeMode === 'extract'}
  <ExtractView />
{:else if $activeMode === 'split'}
  <SplitView />
{:else if $activeMode === 'convert'}
  <ConvertView />
{:else if $activeMode === 'merge'}
  <MergeView />
{/if}
```

#### Store Strategy

Each mode has its own operation store (isolates state between modes). Shared state (settings, active mode) lives in global stores.

```
src/stores/
  activeMode.js       — which mode is shown, settings open/closed
  settings.js         — output path, auto-open preference (synced to main via IPC on load)
  extractState.js     — file selection, page range, operation status for Extract mode
  splitState.js       — file, split config, operation status for Split mode
  convertState.js     — file, format, DPI, operation status, review images list
  mergeState.js       — file list (ordered), operation status for Merge mode
  operation.js        — shared: { running: bool, progress: 0-100, error: null, result: null }
```

The `operation` store is reset at the start of each operation and consumed by `ProgressBar.svelte` and `ResultPanel.svelte`. Each mode view subscribes to its own state store plus the shared operation store.

#### File/Directory Layout

```
src/
  App.svelte                    — root shell, layout
  main.js                       — Electron main process entry
  preload.js                    — contextBridge API surface

  components/
    AppBar.svelte
    ModeSidebar.svelte
    shared/
      FilePicker.svelte          — single or multi-file picker
      PageRangeInput.svelte      — "1-3, 5, 7-9" parser/validator
      OutputDestPicker.svelte    — folder picker + persisted path display
      ProgressBar.svelte         — percent-based progress
      ResultPanel.svelte         — success/error + open folder button

  views/
    ExtractView.svelte
    SplitView.svelte
    ConvertView.svelte
    MergeView.svelte
    ReviewView.svelte            — post-convert image review
    SettingsView.svelte

  stores/
    activeMode.js
    settings.js
    extractState.js
    splitState.js
    convertState.js
    mergeState.js
    operation.js

  lib/
    pdfOperations.js             — pure functions: extractPages, splitPdf, convertToImages, mergePdfs
    pageRangeParser.js           — parse "1-3, 5" → [1, 2, 3, 5]
    outputNaming.js              — generate {timestamp}-{mode} folder names

  workers/
    pdfWorker.js                 — Worker Thread that runs pdfOperations

  ipcHandlers.js                — all ipcMain.handle() registrations
  updater.js                    — electron-updater wrapper
```

---

### Shared UI Component Strategy

All four mode views share these components. They communicate via props + Svelte's `createEventDispatcher` (not stores, to keep them reusable).

| Component | Props In | Events Out | Persists State? |
|-----------|----------|------------|-----------------|
| `FilePicker` | `multiple`, `accept`, `label` | `filesSelected: File[]` | No |
| `PageRangeInput` | `totalPages`, `value` | `change: string`, `valid: boolean` | No |
| `OutputDestPicker` | (reads settings store) | `pathChanged: string` | Yes — writes settings store |
| `ProgressBar` | `percent`, `visible` | None | No |
| `ResultPanel` | `result`, `error`, `outputPath` | `openFolder` | No |

`OutputDestPicker` is the one exception — it reads/writes the `settings` store directly because the output path is global and persisted. All other shared components are stateless props/events.

---

### Handling Large PDF Files Without Blocking the UI

Three-layer approach:

**Layer 1 — Worker Thread isolation:** All PDF processing runs in a Worker Thread (see above). The main process event loop stays free to handle IPC, so the renderer remains responsive.

**Layer 2 — Progress events:** Worker posts progress messages at natural checkpoints (page-by-page). Main forwards these to renderer via `webContents.send('pdf:progress', { percent })`. ProgressBar updates reactively.

**Layer 3 — Cancellation (deferred, v2):** For v1, operations run to completion. Cancellation can be added by tracking the Worker instance and calling `worker.terminate()` on a cancel IPC call.

**What NOT to do:** Never call pdf-lib or pdfjs-dist directly in the renderer process. Never use synchronous IPC. Never run PDF operations directly in the `ipcMain.handle` callback (blocks main process event loop).

---

### Auto-Update Architecture

```
updater.js (main process)
  ├── autoUpdater.checkForUpdatesAndNotify()   — called on app ready (+ periodically)
  ├── autoUpdater.on('update-available')       → webContents.send('update:available', info)
  ├── autoUpdater.on('download-progress')      → webContents.send('update:progress', percent)
  ├── autoUpdater.on('update-downloaded')      → webContents.send('update:ready')
  └── ipcMain.handle('update:install')         → autoUpdater.quitAndInstall()
```

`electron-updater` (from `electron-builder`) is the standard library for this. It reads from `package.json`'s `publish` field pointing at GitHub Releases. The main process handles all update logic; the renderer only displays state and provides an "Install Now" button.

**Settings view responsibilities for update:**
- Display current app version (`app.getVersion()`)
- Show "Update available" / "Up to date" state (from `update:available` event)
- Show "Restart to update" when download completes (from `update:ready` event)
- "Install Now" button triggers `window.api.installUpdate()`

---

### Data Flow

```
User action in Renderer
  → Svelte event handler
    → window.api.{operation}(params)          [contextBridge call]
      → ipcRenderer.invoke(channel, params)   [IPC invoke]
        → ipcMain.handle(channel)             [main process]
          → new Worker(pdfWorker.js)          [worker thread spawned]
            → pdfOperations.{fn}(params)      [pdf-lib / pdfjs-dist]
              → parentPort.postMessage(progress) [per-page progress]
                → ipcMain receives progress
                  → event.sender.send('pdf:progress') [push to renderer]
                    → onProgress callback in Svelte
                      → progressStore.set(percent)
                        → ProgressBar updates
              → parentPort.postMessage(done/error)
                → ipcMain resolves/rejects invoke
                  → renderer receives result
                    → resultStore.set(result) or errorStore.set(err)
                      → ResultPanel shows success or error
```

**Settings data flow (simpler):**
```
App startup
  → window.api.getSetting('outputPath')
    → ipcMain → electron-store.get('outputPath')
      → returned to renderer → settings store initialized

User changes setting in SettingsView
  → window.api.setSetting('outputPath', newPath)
    → ipcMain → electron-store.set('outputPath', newPath)
      → settings store updated locally (optimistic)
```

---

### Suggested Build Order

Build in dependency order — lower layers first, then compose upward.

**Phase 1 — Foundation (Main process + IPC scaffolding)**
1. Electron app skeleton (`main.js`, `BrowserWindow` config, `nodeIntegration: false`, `contextIsolation: true`)
2. `preload.js` with `contextBridge` — define the full API surface even as stubs
3. `ipcHandlers.js` stub — all channels registered, returning mock data
4. Vite + Svelte dev setup integrated with Electron (hot reload in renderer)
5. App shell (`App.svelte`, `ModeSidebar.svelte`, `AppBar.svelte`) — layout only

This gives a working skeleton where renderer and main talk to each other before any real PDF work.

**Phase 2 — Shared Components + State**
6. Svelte stores (`activeMode`, `settings`, `operation`)
7. `FilePicker.svelte`, `OutputDestPicker.svelte`, `PageRangeInput.svelte`
8. `ProgressBar.svelte`, `ResultPanel.svelte`
9. Mode switching working end-to-end (sidebar clicks change active view)

**Phase 3 — PDF Operations (one at a time)**
10. `pdfOperations.js` — pure functions (no Electron dependency, testable in isolation)
11. `pdfWorker.js` — Worker Thread wrapper with progress reporting
12. Extract mode: ipcMain handler → worker → Svelte view wired up
13. Split mode: same pattern
14. Merge mode: same pattern (adds drag-to-reorder in UI)
15. Convert mode: same pattern (pdfjs-dist rendering, DPI param, image output)
16. Review workflow (post-convert image cycling)

**Phase 4 — Settings + Persistence**
17. `electron-store` integration for settings
18. `SettingsView.svelte` wired to IPC
19. Output path persistence working across restart

**Phase 5 — Auto-update + Distribution**
20. `updater.js` + `electron-updater` configuration
21. `electron-builder` config for Windows NSIS installer
22. GitHub Releases publish config in `package.json`
23. Update status in `SettingsView.svelte`
24. End-to-end test of update flow

**Why this order:**
- Phases 1-2 unblock all UI development — designer/builder can work on all 4 views once the shell exists
- PDF operations (Phase 3) are independent of each other — each mode can be built and shipped independently
- Settings persistence (Phase 4) is easier to add after the modes work — avoids over-engineering early
- Auto-update (Phase 5) is last because it requires a built artifact and real GitHub Releases to test

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: nodeIntegration enabled
**What:** Setting `nodeIntegration: true` in `BrowserWindow` to skip preload/contextBridge.
**Why bad:** Gives renderer direct access to Node.js — any malicious PDF content can execute arbitrary system code. Electron's security model is designed around contextIsolation.
**Instead:** Always use `contextIsolation: true` + `contextBridge`. Write a preload script.

### Anti-Pattern 2: PDF processing in the renderer
**What:** Running pdf-lib or pdfjs-dist imports directly in Svelte components.
**Why bad:** Blocks the rendering thread, UI freezes during processing, no progress reporting possible, file system access unavailable.
**Instead:** All PDF work in main process Worker Threads, progress via IPC events.

### Anti-Pattern 3: Monolithic ipcMain handler
**What:** One giant function in `main.js` handling all IPC channels.
**Why bad:** Untestable, hard to navigate, grows without bound.
**Instead:** Separate `ipcHandlers.js` that registers handlers and delegates to `pdfOperations.js`. main.js stays focused on window lifecycle.

### Anti-Pattern 4: Synchronous IPC
**What:** Using `ipcRenderer.sendSync` for any operation.
**Why bad:** Blocks the renderer process until main responds — UI completely freezes.
**Instead:** Always `ipcRenderer.invoke` (async/await). Main always uses `ipcMain.handle`.

### Anti-Pattern 5: Global operation state in mode-local stores
**What:** Storing progress/error state inside per-mode stores.
**Why bad:** ProgressBar and ResultPanel would need to know which mode is active to subscribe to the right store. Adds coupling.
**Instead:** Shared `operation` store that all modes write to at operation start. Reset on new operation. Components just read from `operation`.

### Anti-Pattern 6: Multiple BrowserWindows for modes
**What:** Opening a new window per mode or per operation.
**Why bad:** Each BrowserWindow has its own renderer process — state sharing becomes IPC. Overkill for a utility app.
**Instead:** Single BrowserWindow, mode switching is purely UI state (Svelte store).

---

## Scalability Considerations

This is a local utility with no backend. "Scale" means file size and page count, not user count.

| Concern | Approach |
|---------|----------|
| Large PDFs (500+ pages) | Worker Thread keeps UI responsive; progress per page |
| High-DPI image conversion | DPI param passed to pdfjs-dist canvas renderer; user chooses (72/96/150/300) |
| Many files in Merge mode | File list in Svelte store; drag-reorder is pure UI |
| Long-running operations | Worker Thread + progress events; cancellation deferred to v2 |
| App update while operation running | Defer install to `quitAndInstall()` — only triggered by user action |

---

## Sources

**Confidence notes on key claims:**

- Electron process model (main/renderer split, contextIsolation requirement): HIGH — core Electron architecture, unchanged since Electron v12. Official docs at electronjs.org/docs/latest/tutorial/process-model confirm contextBridge is the required approach.
- Worker Threads in main process for CPU work: HIGH — Node.js `worker_threads` module is stable since Node.js 12; this is the standard Electron pattern for blocking operations. electron.atom.io forums and official Electron security guidance confirm.
- `ipcRenderer.invoke` / `ipcMain.handle` as the async IPC pattern: HIGH — introduced Electron v7, supersedes `ipcRenderer.send` + `ipcRenderer.on` for two-way communication.
- `electron-updater` via `electron-builder`: HIGH — the de facto standard for Electron auto-update with GitHub Releases. Documented at electron.build.
- Svelte store-based routing vs URL router: MEDIUM — community convention for single-window apps. No single authoritative source; consistent across Svelte community examples.
- Worker Thread per-operation (vs persistent worker pool): MEDIUM — reasonable for a utility app with infrequent operations. A worker pool would be preferred for high-frequency operations but adds complexity not warranted here.
