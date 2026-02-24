---
phase: 03-convert-to-images-review
plan: 01
subsystem: pdf-rendering-infrastructure
tags: [pdfjs-dist, ipc, rendering, clipboard, file-io]
dependency_graph:
  requires: []
  provides: [pdf-renderer-utility, file-read-bytes-ipc, pdf-write-image-ipc, pdf-make-convert-folder-ipc, clipboard-write-image-ipc]
  affects: [ConvertMode-plan-03-02, ReviewMode-plan-03-03]
tech_stack:
  added: [pdfjs-dist@5.4.624]
  patterns: [new-URL-worker-config, canvas-render-cleanup, data-url-base64-decode, nativeImage-clipboard]
key_files:
  created:
    - src/renderer/src/lib/utils/pdf-renderer.ts
  modified:
    - package.json
    - package-lock.json
    - src/main/index.ts
    - src/preload/index.ts
    - src/preload/index.d.ts
decisions:
  - pdfjs-dist v5.4.624 used (latest) — Chromium V8 handles Promise.withResolvers natively; no v4 downgrade needed
  - new URL() worker config used (not static file fallback) — electron-vite build passed cleanly with no fake-worker warnings
  - Dynamic imports used inside IPC handlers (fs/promises, path) to avoid top-level import conflicts with existing static imports
metrics:
  duration: ~6 min
  completed: 2026-02-24
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 03 Plan 01: PDF Rendering Infrastructure Summary

pdfjs-dist v5.4.624 installed with new URL() worker config; four IPC channels wired in main and preload for conversion and review workflows.

## What Was Built

### Task 1: pdfjs-dist Installation + pdf-renderer.ts

Installed pdfjs-dist v5.4.624 as a runtime dependency. Created `src/renderer/src/lib/utils/pdf-renderer.ts` with:

- `renderPageToDataUrl(pdfBytes, pageNumber, dpi, format)` — renders a single PDF page to a data URL
- Worker config via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` — the new URL pattern is more reliable than `?url` imports in electron-vite production builds
- DPI-to-scale conversion: `scale = dpi / 72` (PDF internal resolution is 72 DPI)
- Canvas cleanup after render (`canvas.width = 0`) to prevent memory leaks on large PDFs

**pdfjs-dist version:** 5.4.624 (v5 latest)

**Worker config approach used:** `new URL()` pattern (primary, no fallback needed)

The build completed without fake-worker warnings. The renderer bundle does not yet include pdfjs code since `pdf-renderer.ts` is not imported by any component yet — this is expected; Plan 03-02 will import it when ConvertMode is built.

**pdfjs v5 note:** v5 uses `Promise.withResolvers` internally. This requires Node >=22 in a Node context, but the renderer runs in Chromium V8 which supports it natively. No v4 downgrade was needed.

### Task 2: Four IPC Channels

Added four `ipcMain.handle` registrations to `src/main/index.ts`:

| Channel | Purpose |
|---|---|
| `file:read-bytes` | Reads raw PDF bytes from disk; renderer cannot access filesystem directly |
| `pdf:write-image` | Decodes data URL base64 and writes image file to output folder |
| `pdf:make-convert-folder` | Creates timestamped `{documents}/PDF Chisel/{ts}-convert/` folder |
| `clipboard:write-image` | Reads image file and writes to system clipboard via `nativeImage.createFromBuffer` |

Dynamic imports (`fs/promises`, `path`) are used inside the handlers to avoid conflicts with the existing top-level static `readFile` import.

Preload additions:
- `readFileBytes(filePath)` → `file:read-bytes`
- `makeConvertOutputFolder()` → `pdf:make-convert-folder`
- `writeImageFile(args)` → `pdf:write-image`
- `copyImageToClipboard(filePath)` → `clipboard:write-image`

All four methods declared on `Window.api` in `src/preload/index.d.ts`.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.node.json` | PASS — 0 errors |
| `npx svelte-check --tsconfig ./tsconfig.json` | PASS — 0 errors, 0 warnings |
| `npx electron-vite build` | PASS — all 3 targets built successfully |
| pdfjs-dist in package.json dependencies | PASS |
| pdf-renderer.ts exports renderPageToDataUrl | PASS |
| 4 IPC channels in main/index.ts | PASS |
| 4 API methods in preload/index.ts | PASS |
| 4 type declarations in preload/index.d.ts | PASS |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note on dynamic imports:** The plan used direct `await import(...)` patterns inside handlers. The existing main/index.ts already has a top-level `import { readFile } from 'fs/promises'`, so the handler-level imports were renamed (e.g., `readFileBytes`, `readFileClip`) to avoid shadowing the top-level binding. This is a minor naming choice, not a deviation.

## Production Build Spike Result

The `electron-vite build` completed cleanly with the `new URL()` worker config. The static fallback (copying worker to `src/renderer/public/`) was not needed. The pre-existing a11y ARIA warning in MergeMode.svelte appeared but is unrelated to this plan.

## Self-Check: PASSED

| Item | Status |
|---|---|
| `src/renderer/src/lib/utils/pdf-renderer.ts` | FOUND |
| `.planning/phases/03-convert-to-images-review/03-01-SUMMARY.md` | FOUND |
| Commit d3530ae (Task 1: pdfjs-dist + pdf-renderer.ts) | FOUND |
| Commit 79a6944 (Task 2: IPC channels) | FOUND |
