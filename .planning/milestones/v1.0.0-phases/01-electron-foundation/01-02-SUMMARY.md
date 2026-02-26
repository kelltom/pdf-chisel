---
phase: 01-electron-foundation
plan: 02
subsystem: ipc
tags: [electron, contextBridge, ipcMain, pdf-lib, preload, typescript]

# Dependency graph
requires:
  - 01-01 (electron-vite scaffold with contextIsolation BrowserWindow)
provides:
  - contextBridge API: window.api.openPdf, window.api.getPathForFile, window.api.getFileInfo
  - IPC channel 'dialog:open-pdf' registered in main process
  - IPC channel 'file:get-info' registered in main process
  - PdfFileInfo TypeScript interface exported from preload and declared on Window
affects:
  - 01-03 (UI shell calls window.api.openPdf and window.api.getFileInfo)
  - All Phase 2+ plans that add IPC channels (preload pattern established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "webUtils.getPathForFile(file) is the only correct drag-drop path resolution on Electron 34 (File.path removed in Electron 32)"
    - "ipcMain.handle (not ipcMain.on) prevents listener accumulation on window recreation"
    - "IPC handlers registered after createWindow() inside app.whenReady() — prevents double-registration"
    - "Error objects returned from handlers (never throw) — renderer can check result.error safely"

key-files:
  created: []
  modified:
    - src/preload/index.ts
    - src/preload/index.d.ts
    - src/main/index.ts

key-decisions:
  - "ignoreEncryption:false in PDFDocument.load — password-protected PDFs return error field, not crash"
  - "ipcMain.handle placement: after createWindow(), before app.on('activate') — single-registration per app lifecycle"
  - "PdfFileInfo interface defined in both preload/index.ts (runtime export) and preload/index.d.ts (type declaration) — renderer sees typed window.api"

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 1 Plan 02: IPC Scaffold and File API Summary

**contextBridge API exposing openPdf/getPathForFile/getFileInfo via webUtils + ipcMain.handle handlers returning typed PdfFileInfo from pdf-lib**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T23:24:18Z
- **Completed:** 2026-02-22T23:26:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced preload stub with full contextBridge API: `openPdf`, `getPathForFile`, `getFileInfo`
- Used `webUtils.getPathForFile(file)` for drag-drop File-to-path resolution (correct Electron 34 pattern)
- Updated `src/preload/index.d.ts` to declare `Window.api` with full typed interface — renderer TypeScript has zero `any` for file API calls
- Added `ipcMain.handle('dialog:open-pdf')` in main: opens native file picker filtered to `.pdf`, reads bytes via `fs/promises`, loads with `pdf-lib`, returns `{ filePath, fileName, pageCount }`
- Added `ipcMain.handle('file:get-info')` in main: same metadata read for a known path (used by drag-drop flow after `getPathForFile` resolves the path)
- Both handlers return `{ error: String(err) }` on failure — never throw, renderer can safely check `result?.error`
- TypeScript clean: both `tsconfig.node.json` and `tsconfig.web.json` pass `--noEmit` with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement preload contextBridge API** — `1fc4bee` (feat)
2. **Task 2: Add IPC handlers for PDF file operations** — `ccb5389` (feat)

## Preload API Surface

| Method | IPC Channel | Return Type |
|--------|-------------|-------------|
| `window.api.openPdf()` | `dialog:open-pdf` (invoke) | `Promise<PdfFileInfo \| null>` |
| `window.api.getPathForFile(file)` | n/a (webUtils, synchronous) | `string` |
| `window.api.getFileInfo(filePath)` | `file:get-info` (invoke) | `Promise<PdfFileInfo \| null>` |

`null` is returned when dialog is canceled (openPdf) or when file is not provided.

## Main Process Handlers

| Channel | Trigger | Returns |
|---------|---------|---------|
| `dialog:open-pdf` | Native file picker (`.pdf` filter) | `PdfFileInfo` or `null` (canceled) |
| `file:get-info` | Known path (drag-drop) | `PdfFileInfo` (with `error` field on failure) |

`PdfFileInfo` shape: `{ filePath: string, fileName: string, pageCount: number, error?: string }`

## TypeScript Version Note

- `@electron-toolkit/preload`: 3.0.2 (from Plan 01 install)
- `pdf-lib`: 1.17.1 — `PDFDocument.load()` accepts `Uint8Array` from `fs/promises` `readFile`
- `webUtils` is available as a named import from `'electron'` in preload context (Electron 34 confirmed)

## Decisions Made

- `ignoreEncryption: false` — password-protected PDFs throw during `PDFDocument.load`, caught and returned as `{ error: "..." }`. Full error UI is Phase 2 scope; Plan 03 renderer checks `result?.error`.
- `ipcMain.handle` (not `ipcMain.on`) — enforces single-handler contract, prevents listener accumulation on macOS window recreation cycle.
- IPC handlers placed after `createWindow()` — handlers are registered once per app lifecycle, not per window.

## Deviations from Plan

None - plan executed exactly as written. Both TypeScript configs passed cleanly with zero errors.

## Requirements Completed

- FILE-01: Native file dialog filtered to .pdf, returns page count and file metadata
- FILE-02: Drag-drop path resolution via webUtils.getPathForFile (Electron 34 only correct approach)
- FILE-03: getFileInfo IPC handler provides page count for a known path

## Next Phase Readiness

- Plan 03 (UI shell) can call `window.api.openPdf()` and `window.api.getFileInfo()` immediately
- `window.api` is fully typed in renderer TypeScript — no type assertions needed
- Error pattern established: check `result?.error` before accessing `result.fileName` / `result.pageCount`

---
*Phase: 01-electron-foundation*
*Completed: 2026-02-22*

## Self-Check: PASSED

- FOUND: src/preload/index.ts (contains webUtils.getPathForFile, contextBridge.exposeInMainWorld('api'))
- FOUND: src/preload/index.d.ts (declares Window.api with openPdf, getPathForFile, getFileInfo)
- FOUND: src/main/index.ts (contains ipcMain.handle('dialog:open-pdf') and ipcMain.handle('file:get-info'))
- COMMIT 1fc4bee: feat(01-02): implement preload contextBridge API with openPdf, getPathForFile, getFileInfo
- COMMIT ccb5389: feat(01-02): add IPC handlers for PDF file operations in main process
