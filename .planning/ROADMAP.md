# Roadmap: PDF Chisel

## Overview

PDF Chisel is built in five phases that follow a strict dependency order. The security model and IPC architecture must be correct before any PDF work begins — retrofitting these later is expensive and undermines the privacy value proposition. Core structural operations (Extract, Split, Merge) share a Worker Thread pattern and are built as a group. Image conversion and the review workflow are isolated in their own phase because pdfjs-dist introduces distinct rendering complexity. Settings and persistence are added last, after all mode behavior is known. Distribution is the final gate — it depends on everything else working and has real-world external dependencies (code signing certificate).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Electron Foundation** - Secure app shell with mode navigation, file input, and shared UI components
- [ ] **Phase 2: Core PDF Operations** - Extract, Split, and Merge modes fully functional with Worker Thread pattern
- [ ] **Phase 3: Convert to Images + Review** - PDF-to-image conversion with pdfjs-dist and Copy-and-Next review workflow
- [ ] **Phase 4: Settings + Persistence** - electron-store integration, settings page, and per-mode persistence
- [ ] **Phase 5: Distribution + Auto-Update** - NSIS installer, GitHub Releases, code-signed auto-updater

## Phase Details

### Phase 1: Electron Foundation
**Goal**: Users can launch the app, navigate between modes, and load PDF files — all running on a correctly secured Electron scaffold
**Depends on**: Nothing (first phase)
**Requirements**: APP-01, APP-02, APP-03, APP-04, FILE-01, FILE-02, FILE-03
**Success Criteria** (what must be TRUE):
  1. App launches with top app-bar showing "PDF Chisel" title and a settings gear icon
  2. User can click any of the 4 mode icons in the vertical left-edge nav and see that mode's view replace the main body area
  3. User can select a PDF via native file browser dialog or drag-and-drop onto the file input area
  4. After loading a PDF, the app displays the file name and page count
  5. Browser DevTools show contextIsolation is enabled and nodeIntegration is disabled — no console warnings about fake workers or insecure configs
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold electron-vite project, pin Electron 34, configure secure BrowserWindow with custom title bar
- [ ] 01-02-PLAN.md — Wire contextBridge preload API and main-process IPC handlers for PDF file dialog and metadata
- [ ] 01-03-PLAN.md — Build renderer UI: AppBar, NavRail, app state, mode stubs, FileInput with drag-drop + visual verification checkpoint

### Phase 2: Core PDF Operations
**Goal**: Users can extract pages, split, and merge PDFs — all operations complete locally with progress feedback, specific error messages, and timestamped output
**Depends on**: Phase 1
**Requirements**: EXTR-01, EXTR-02, SPLT-01, SPLT-02, SPLT-03, MERG-01, MERG-02, MERG-03, OUTP-01, OUTP-02, OUTP-03, OUTP-04, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can type a page range like "1-5, 8, 12-15" in Extract mode and receive a single new PDF containing only those pages in the output subfolder
  2. User can split a PDF either by number of parts or max pages per part, and receive the correct number of output PDFs in a timestamped subfolder
  3. User can drag-to-reorder multiple PDFs in Merge mode and receive a single combined PDF reflecting that order
  4. After any operation, a success summary lists the created file names; the output subfolder name follows the `{timestamp}-{mode}` pattern
  5. When an operation fails (corrupt file, password-protected PDF), the app shows a human-readable message identifying the specific cause; a progress indicator is visible during processing
**Plans**: TBD

### Phase 3: Convert to Images + Review
**Goal**: Users can convert PDF pages to images at a chosen DPI and format, then cycle through results with clipboard copy via the review workflow
**Depends on**: Phase 2
**Requirements**: CONV-01, CONV-02, CONV-03, REVW-01, REVW-02, REVW-03, REVW-04, REVW-05
**Success Criteria** (what must be TRUE):
  1. User can choose PNG or JPEG format with an inline explanation of the difference, select a DPI preset (72/96/150/300), and receive one image file per PDF page in the output subfolder
  2. During conversion, a determinate progress indicator shows "Page N of M" updating in real time
  3. After conversion completes, user can enter the review workflow and see the first image displayed with their position shown (e.g. "1 / 12")
  4. User can click "Copy and Next" (or press Space/Enter) to copy the current image to clipboard and advance; user can also go back one image; the workflow ends naturally after the last image
**Plans**: TBD

### Phase 4: Settings + Persistence
**Goal**: Users have a working settings page where output path, auto-open preference, and per-mode last-used values persist across app restarts
**Depends on**: Phase 3
**Requirements**: SETT-01, SETT-02, SETT-03
**Success Criteria** (what must be TRUE):
  1. User can open settings via the gear icon, set a default output destination path, and that path is pre-filled on next launch without re-entry
  2. User can toggle auto-open output folder on/off; the toggle state persists across restarts and the correct behavior follows (folder opens or does not open after operations)
  3. Settings page displays the current app version number
**Plans**: TBD

### Phase 5: Distribution + Auto-Update
**Goal**: PDF Chisel ships as a code-signed Windows NSIS installer via GitHub Releases and silently auto-updates itself when new versions are published
**Depends on**: Phase 4
**Requirements**: SETT-04
**Success Criteria** (what must be TRUE):
  1. A user on a clean Windows machine can download and install PDF Chisel from a GitHub Release without a SmartScreen block
  2. The app checks for updates on launch; when a new GitHub Release is published, the app downloads and installs it automatically
  3. The Settings page shows the current app version and update status (checking / up to date / update available)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Electron Foundation | 0/3 | Not started | - |
| 2. Core PDF Operations | 0/? | Not started | - |
| 3. Convert to Images + Review | 0/? | Not started | - |
| 4. Settings + Persistence | 0/? | Not started | - |
| 5. Distribution + Auto-Update | 0/? | Not started | - |
