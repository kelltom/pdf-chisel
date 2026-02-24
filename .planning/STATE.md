# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Every operation completes locally, privately, and without friction — users pick a mode, pick files, and get results.
**Current focus:** Phase 4.1 complete — Developer README added. Ready to resume Phase 4 plan 03 (auto-update scaffold, SETT-04).

## Current Position

Phase: 4.1 of 4 (Add Developer README) — COMPLETE
Plan: 1 of 1 in phase 04.1 (plan 04.1-01 complete)
Status: README.md created at repository root. All 6 required content strings verified. Phase 4.1 complete. Next: Phase 4 plan 03 — auto-update scaffold (SETT-04).
Last activity: 2026-02-24 — Plan 04.1-01 complete: developer README with nvm-windows setup, Node 22 LTS, dev/build commands, inline warnings

Progress: [█████████░] 92%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~4.5 min
- Total execution time: ~0.67 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-electron-foundation | 3 | ~21 min | ~7 min |
| 02-core-pdf-operations | 4 | ~13 min | ~3.3 min |
| 03-convert-to-images-review | 2 | ~8 min | ~4 min |
| 04-settings-persistence | 2 | ~7 min | ~3.5 min |

**Recent Trend:**
- Last 5 plans: 2 min, 6 min, 2 min, ~15 min, ~5 min
- Trend: Accelerating

*Updated after each plan completion*
| Phase 04.1-add-developer-readme P01 | 1 | 1 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Electron + Svelte chosen; builder is new to Electron stack — handholding expected in Phase 1
- [Setup]: contextBridge/ipcMain.handle is the only permitted IPC pattern — nodeIntegration must be disabled from scaffold
- [Setup]: All PDF work runs in Worker Threads — never on main or renderer thread
- [01-01]: Scaffolded manually from npm cache (CLI interactive-only, no --yes flag) — identical output to CLI scaffold
- [01-01]: electron-builder.yml stripped to Windows/NSIS only — Mac and Linux targets removed per Windows-only scope
- [01-01]: Catppuccin Mocha palette (#1e1e2e / #cdd6f4) chosen for titleBarOverlay — dark theme consistency
- [01-02]: ignoreEncryption:false in PDFDocument.load — password-protected PDFs return error field, not crash
- [01-02]: ipcMain.handle used (not ipcMain.on) to prevent listener accumulation on window recreation
- [01-02]: webUtils.getPathForFile is the only correct drag-drop path API on Electron 34 (File.path removed in Electron 32)
- [01-03]: appState exported as $state({}) object — exported $state primitives are read-only from importers in Svelte 5; object reference allows mutations to propagate
- [01-03]: Mode stubs all import FileInput — consistent file-load UX in every mode from day one
- [01-03]: handleDragOver must call e.preventDefault() to allow ondrop to fire — browser blocks drop without this
- [02-01]: Output folder path computed in main (makeOutputFolder) — worker receives pre-computed outputFolder via workerData; no __dirname in worker
- [02-01]: Split zero-padding: 1 digit for <=9 parts, 2 digits for >9 parts — pre-computed from numChunks before write loop
- [02-01]: Worker spawned fresh per operation via ?nodeWorker factory — no shared worker state between operations
- [02-01]: onProgress returns cleanup function — callers MUST invoke in Svelte onDestroy to prevent ipcRenderer listener accumulation
- [02-01]: Progress messages are indeterminate steps (reading/processing/writing) — no percentages per locked Phase 1 decision
- [02-02]: OperationResult interface redeclared locally in renderer components — preload types cross process boundaries; renderer TypeScript does not import from main/preload
- [02-02]: Reset button rendered unconditionally in ResultsSummary — always visible per locked Phase 2 decision
- [02-02]: Execute button lives in the actions snippet slot owned by the mode component — keeps label (Extract/Split/Merge) mode-controlled, not layout-controlled
- [02-05]: crypto.randomUUID() for stable FileItem id — keyed {#each} uses (file.id) not index to prevent Svelte DOM tracking bugs during drag-to-reorder
- [02-05]: Dual drag handlers (list item reorder + external drop zone) do not conflict — list drag has empty dataTransfer.files; Explorer drag has null dragIndex
- [03-01]: pdfjs-dist v5.4.624 used (v5, not v4) — Chromium V8 supports Promise.withResolvers natively; no downgrade needed
- [03-01]: new URL() worker config chosen over static file fallback — electron-vite build passed cleanly; no fake-worker warnings
- [03-01]: Dynamic imports used inside IPC handlers to avoid shadowing top-level readFile import
- [03-02]: Custom results section used instead of OperationLayout ResultsSummary — OperationLayout has no slot for Start Review; custom section is self-contained without modifying shared components
- [03-02]: Buffer-to-Uint8Array instanceof guard applied at IPC boundary — plain object fallback via Object.values prevents silent renderPageToDataUrl failures
- [03-02]: DPI selector uses two-line segmented buttons (value + hint stacked) matching Split mode CSS pattern extended with flex-column dpi-btn layout
- [03-03]: pdfjs-dist downgraded v5→v4 (v4.10.38) — v5 calls Uint8Array.prototype.toHex() unconditionally in worker context (ES2024, absent in Electron's Chromium); v4 guards the call with a manual fallback
- [03-03]: PDF loaded once per conversion via loadPdfDocument() + renderPageFromDoc() — pdfjs transfers ArrayBuffer to worker on getDocument(), detaching the original; calling getDocument() in a loop caused 'ArrayBuffer already detached' crash on page 2+
- [03-03]: file:// image src with backslash-to-forward-slash conversion for Windows paths — path.replace(/\\/g, '/') applied in $derived currentImagePath before 'file://' prefix
- [03-03]: svelte:window onkeydown guarded by reviewState === 'reviewing' — no focus management required; e.preventDefault() suppresses page scroll (Space) and form submit (Enter)
- [04-01]: electron-conf Conf instances declared at module scope outside app.whenReady() — single shared instance accessible from all IPC handlers without closure coupling
- [04-01]: getOutputBase() reads settings.get('outputPath') at call time (not cached) — always reflects live user preference without restart
- [04-01]: settings:set accepts Partial<AppSettings> patch — live-save UI pattern can write individual fields without a full settings object
- [04-02]: settingsState exported as $state object (not primitives) — Svelte 5 exported $state primitives are read-only from importers; object reference allows mutations to propagate across components
- [04-02]: auto-open gated in both ResultsSummary and ConvertMode — both code paths need the guard; manual Open Folder button always available regardless of toggle
- [04-02]: per-mode persistence uses onMount load + execute() save — transparent to user; last-used values silently restored each launch without dedicated UI
- [Phase 04.1-add-developer-readme]: Node 22 LTS pinned via nvm-windows — satisfies electron-vite requirement of ^20.19.0 || >=22.12.0
- [Phase 04.1-add-developer-readme]: GitHub-flavored [!WARNING] and [!NOTE] callouts chosen — renders natively on GitHub with colored badges

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4: Add Developer README — document prerequisites and steps to clone, install, and run in dev on Windows. (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

- [Resolved — 03-01]: pdfjs-dist worker bundling resolved — new URL() pattern works in electron-vite builds without fake-worker warnings
- [Phase 5 ahead]: Code signing certificate (OV minimum) must be procured before Phase 5 begins; start procurement at Phase 4 kickoff to avoid blocking delay

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 04.1-add-developer-readme-01-PLAN.md. Next: Phase 4 plan 03 — auto-update scaffold (SETT-04).
Resume file: None
