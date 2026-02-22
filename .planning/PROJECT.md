# PDF Chisel

## What This Is

PDF Chisel is a lightweight, open-source desktop utility for reshaping existing PDF files locally on a user's machine. It provides fast, predictable file restructuring across four core modes — extract pages, split into parts, convert to images, and merge — without uploading documents to any cloud service. Built with Electron + Svelte, distributed via GitHub Releases, targeting Windows users who value privacy and simplicity over feature bloat.

## Core Value

Every operation completes locally, privately, and without friction — users pick a mode, pick files, and get results.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can extract selected pages from a PDF into a new single PDF
- [ ] User can split a PDF into evenly sized parts (by number of parts or max pages per part)
- [ ] User can convert PDF pages to images (PNG or JPEG, user's choice with format explanation)
- [ ] User can merge multiple PDFs into one, with drag-to-reorder before merging
- [ ] After PDF-to-image conversion, user can enter a review workflow: cycle through images with "Copy and Next" (copies image to clipboard, advances to next)
- [ ] Each execution produces output in a `{timestamp}-{mode}` subfolder within the user's chosen destination
- [ ] Output destination persists across uses and sessions
- [ ] App auto-updates via GitHub Releases (Electron auto-updater)
- [ ] Settings page: default output path, auto-open output folder toggle, color theme (v2), app update
- [ ] UI: top app-bar (title + settings gear), vertical mode selector on left edge, shared UI components across modes

### Out of Scope

- Cloud upload or remote processing — privacy is a core principle
- Login or accounts — no fluff
- Payments — open-source, free
- Mac/Linux support — Windows-only for v1 (simplifies packaging)
- Color theme customization — deferred to a later phase (settings placeholder in v1)
- Per-page extraction (multiple output PDFs) — extract always produces one PDF
- Default image DPI as a global setting — DPI configured per-conversion in the mode UI

## Context

- Builder is new to the Electron stack — environment setup and handholding will be needed during early phases
- Tech stack chosen: Electron + Svelte (web-based desktop, Electron for OS integration and auto-update, Svelte for lightweight UI)
- PDF processing will use JS libraries (e.g. pdf-lib for manipulation, pdfjs-dist for rendering/thumbnails)
- Image conversion from PDF requires rendering PDF pages — needs DPI/resolution configuration per conversion
- Shared UI components across modes (file picker, page range selector, output destination picker) will need to be modular from the start
- Open-source project, hosted on GitHub, distributed as Windows installer via GitHub Releases

## Constraints

- **Platform**: Windows only — simplifies packaging, testing, and distribution for v1
- **Tech Stack**: Electron + Svelte — user chose Electron for its ecosystem/documentation advantages
- **Privacy**: All operations must be entirely local — no network calls for file processing
- **Scope**: No login, no payments, no accounts — pure utility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron over Tauri | User is new to the stack; Electron has more tutorials, examples, and community resources | — Pending |
| Svelte for UI | Lightweight, minimal boilerplate — good fit for a focused utility app | — Pending |
| GitHub Releases for distribution | Standard for Electron open-source; Electron's auto-updater integrates natively | — Pending |
| Extract always produces one PDF | Simplifies UX; per-page output deferred as out-of-scope for v1 | — Pending |
| Timestamp-based output subfolders | Prevents overwriting previous runs, gives natural audit trail | — Pending |

---
*Last updated: 2026-02-22 after initialization*
