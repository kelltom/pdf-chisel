# PDF Chisel

## What This Is

PDF Chisel is a lightweight, open-source Windows desktop utility for reshaping existing PDF files locally. It ships four core modes — extract pages, split into parts, merge multiple PDFs, and convert pages to images — plus a copy-and-review workflow for stepping through converted images. Built with Electron 34 + Svelte 5, distributed via GitHub Releases, targeting Windows users who value privacy and simplicity over feature bloat. v1.0.0 shipped as a fully working desktop app with settings persistence and an electron-vite + electron-builder packaging pipeline.

## Core Value

Every operation completes locally, privately, and without friction — users pick a mode, pick files, and get results.

## Requirements

### Validated

- ✓ App displays top app-bar with "PDF Chisel" title and settings gear icon — v1.0.0
- ✓ Vertical mode selector on left edge with icons for Extract, Split, Convert, Merge — v1.0.0
- ✓ Selecting a mode renders that mode's view in the main area — v1.0.0
- ✓ User can select PDF file(s) via native file dialog or drag-and-drop — v1.0.0
- ✓ App displays file name and page count after loading — v1.0.0
- ✓ Extract: page range syntax (e.g. "1-5, 8, 12-15") produces one new PDF — v1.0.0
- ✓ Split by number of parts or max pages per part — v1.0.0
- ✓ Merge multiple PDFs with drag-to-reorder — v1.0.0
- ✓ Convert PDF pages to images (PNG or JPEG, 72/96/150/300 DPI) — v1.0.0
- ✓ Copy-and-Next review workflow: clipboard write, back navigation, keyboard shortcuts, completion screen — v1.0.0
- ✓ Timestamped `{timestamp}-{mode}` output subfolders — v1.0.0
- ✓ Success summary lists created files after each operation — v1.0.0
- ✓ Output folder auto-opens after execution (if auto-open enabled) — v1.0.0
- ✓ Settings: default output path, auto-open toggle, app version display — v1.0.0
- ✓ Settings persist across restarts (electron-conf) — v1.0.0
- ✓ Per-mode last-used values restored on launch — v1.0.0
- ✓ Progress indicator during PDF processing — v1.0.0
- ✓ Human-readable error messages for corrupt/password-protected PDFs — v1.0.0

### Active

- [ ] App auto-updates via GitHub Releases (electron-updater) — SETT-04, requires OV code signing certificate
- [ ] Thumbnail strip showing page previews for page range selection (pdfjs-dist) — VISU-01
- [ ] Page thumbnail click to jump to specific page reference — VISU-02
- [ ] Unlock and process password-protected PDFs by entering password — FILE-04

### Out of Scope

- Cloud upload or remote processing — privacy is a core principle
- Login, accounts, payments — no fluff, open-source free
- Mac/Linux support — Windows-only for v1 (simplifies packaging)
- Color theme customization — deferred to a later milestone (settings placeholder exists)
- Per-page extraction to separate PDFs — extract always produces one combined PDF
- Default image DPI as a global setting — DPI configured per-conversion in the mode UI
- PDF editing (text, annotations, forms) — not a PDF editor
- PDF viewer/reader — out of product scope
- OCR — high complexity, not core
- Batch job queue — over-engineering for v1 usage patterns

## Context

- v1.0.0 shipped 2026-02-26: ~3,225 LOC TypeScript + Svelte, 111 files, 7 phases, 20 plans
- Tech stack: Electron 34 + Svelte 5, electron-vite, electron-builder (NSIS), electron-conf
- PDF libs: pdf-lib (manipulation), pdfjs-dist v4 (rendering) — both pure JS, no native binaries
- pdfjs-dist pinned to v4 (v4.10.38): v5 calls `Uint8Array.prototype.toHex()` unconditionally in worker context (ES2024, absent in Electron's Chromium V8 at build time)
- All PDF processing runs in Worker Threads; main process handles file I/O only
- Renderer process handles pdfjs rendering (browser canvas); IPC crosses process boundary via contextBridge
- Auto-update (SETT-04) blocked on OV code signing certificate — must procure before v1.1

## Constraints

- **Platform**: Windows only — simplifies packaging, testing, and distribution
- **Tech Stack**: Electron + Svelte — chosen for ecosystem/documentation advantages and minimal boilerplate
- **Privacy**: All operations entirely local — no network calls for file processing
- **Scope**: No login, payments, or accounts — pure utility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | User is new to the stack; Electron has more tutorials, examples, and community resources | ✓ Good — scaffolding was smooth, ecosystem worked as expected |
| Svelte for UI | Lightweight, minimal boilerplate — good fit for a focused utility app | ✓ Good — Svelte 5 runes patterns (`$state({})` object export) worked cleanly |
| GitHub Releases for distribution | Standard for Electron open-source; auto-updater integrates natively | — Pending (SETT-04 blocked on code signing) |
| Extract always produces one PDF | Simplifies UX; per-page output deferred as out-of-scope for v1 | ✓ Good — no user pushback |
| Timestamp-based output subfolders | Prevents overwriting previous runs, gives natural audit trail | ✓ Good — clean UX, no conflicts |
| Worker Thread per operation | Prevents main thread blocking; fresh spawn per op avoids shared state | ✓ Good — no state leakage issues |
| pdfjs-dist v4 (not v5) | v5 calls `Uint8Array.prototype.toHex()` unconditionally (ES2024, absent in Electron's Chromium) | ✓ Good — v4 guards the call; no workaround needed |
| electron-conf for persistence | electron-store was the original plan; electron-conf is its modern successor with identical API | ✓ Good — drop-in, cleaner |
| CSS-only fix for review image overflow | Class directive toggle on `.mode-view`; no JS sizing logic | ✓ Good — reactive, zero JS overhead |

---
*Last updated: 2026-02-26 after v1.0.0 milestone*
