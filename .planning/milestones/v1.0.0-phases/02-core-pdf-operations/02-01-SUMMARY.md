---
phase: 02-core-pdf-operations
plan: 01
subsystem: main-process-backend
tags: [ipc, worker-thread, pdf-lib, extract, split, merge, preload, typescript]
dependency_graph:
  requires: [01-02-SUMMARY.md]
  provides: [pdf:extract, pdf:split, pdf:merge, dialog:open-pdfs-multi, shell:open-folder, window.api.extractPages, window.api.splitPdf, window.api.mergePdfs, window.api.openPdfsDialog, window.api.openOutputFolder, window.api.onProgress]
  affects: [02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 02-05-PLAN.md]
tech_stack:
  added: [worker_threads (Node built-in)]
  patterns: [nodeWorker import via electron-vite ?nodeWorker suffix, error classification with cause+fix shape, progress events forwarded from worker through main to renderer, cleanup-returning onProgress for Svelte onDestroy]
key_files:
  created:
    - src/main/workers/pdf-worker.ts
  modified:
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
decisions:
  - "Output folder path computed in main (makeOutputFolder) — worker receives pre-computed outputFolder via workerData; no __dirname in worker"
  - "Split zero-padding: 1 digit for <=9 parts, 2 digits for >9 parts — computed before writing any file by pre-calculating numChunks"
  - "Worker spawned fresh per operation via ?nodeWorker factory — no shared worker state between operations"
  - "onProgress returns cleanup function — callers MUST invoke in Svelte onDestroy to prevent ipcRenderer listener accumulation"
  - "Progress messages are indeterminate steps (reading/processing/writing) — no percentages per locked Phase 1 decision"
metrics:
  duration: "~3 min"
  completed_date: "2026-02-23"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 2 Plan 1: PDF Worker Thread and IPC Backend Summary

**One-liner:** Worker Thread PDF engine (extract/split/merge) with error classification, timestamped output folders, and full preload API for Phase 2 UI plans.

## What Was Built

The complete main-process backend for all Phase 2 PDF operations. A single unified Worker Thread (`pdf-worker.ts`) handles Extract, Split, and Merge using pdf-lib, executing off the main event loop. Five IPC handlers in `main/index.ts` spawn the worker with pre-computed timestamped output folders and forward progress events to the renderer. Six new methods on `window.api` give the UI plans a clean, typed surface to call.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create pdf-worker.ts — unified Worker Thread | 5efbe3d | src/main/workers/pdf-worker.ts (created) |
| 2 | Add IPC handlers and extend preload API | 0a45e07 | src/main/index.ts, src/preload/index.ts, src/preload/index.d.ts |

## Key Architecture

**Worker Thread flow:**
```
window.api.extractPages(args)
  → ipcRenderer.invoke('pdf:extract', args)
    → ipcMain.handle('pdf:extract') in main/index.ts
      → makeOutputFolder() computes timestamped folder
      → createPdfWorker({ workerData: { ...args, outputFolder } })
        → pdf-worker.ts: mkdir + readFile + pdf-lib + writeFile
        → parentPort.postMessage({ type: 'progress', step: 'reading|processing|writing' })
        → parentPort.postMessage({ type: 'complete', result: { outputFiles, outputFolder } })
      → event.sender.send('pdf:progress', msg) — forwarded to renderer
      → Promise resolves with { outputFiles, outputFolder } or { error: { cause, fix } }
```

**Output folder naming:** `{Documents}/PDF Chisel/YYYYMMDD-HHmmss-{mode}` — timestamped, one folder per operation execution.

**Error classification** handles: EncryptedPDFError, corrupted PDF ("Failed to parse"), permission denied (EACCES/EPERM), disk full (ENOSPC), and an unknown fallback.

## Verification Results

All 5 verification criteria passed:
1. `npx tsc --noEmit -p tsconfig.node.json` — zero errors
2. `npm run typecheck` (includes svelte-check) — 0 errors, 0 warnings, 219 files
3. `src/main/workers/pdf-worker.ts` contains all required symbols: EncryptedPDFError, classifyError, extract, split, merge, parentPort, postMessage
4. `src/main/index.ts` contains: pdf:extract, pdf:split, pdf:merge, dialog:open-pdfs-multi, shell:open-folder, makeOutputFolder
5. `src/preload/index.ts` contains: extractPages, splitPdf, mergePdfs, openPdfsDialog, openOutputFolder, onProgress, OperationResult

## Deviations from Plan

None - plan executed exactly as written.

The split operation padding logic required knowing total chunk count before writing files; implemented by pre-computing `numChunks = Math.ceil(totalPages / chunkSize)` before the write loop. This matches the plan's stated behavior without adding complexity.

## Self-Check

**Files exist:**
- src/main/workers/pdf-worker.ts — created
- src/main/index.ts — modified
- src/preload/index.ts — modified
- src/preload/index.d.ts — modified

**Commits exist:**
- 5efbe3d — feat(02-01): create pdf-worker.ts
- 0a45e07 — feat(02-01): add IPC handlers and extend preload API

## Self-Check: PASSED
