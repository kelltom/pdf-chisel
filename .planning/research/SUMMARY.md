# Project Research Summary

**Project:** PDF Chisel
**Domain:** Electron + Svelte desktop PDF manipulation utility (Windows)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

PDF Chisel is a Windows-only desktop PDF utility built with Electron + Svelte, delivering four structural operations — Extract, Split, Convert to Images, and Merge — entirely locally with no network calls for file content. The established pattern for this class of tool is a strict process boundary: Svelte components in the renderer handle all UI state, pdf-lib handles PDF manipulation in a Worker Thread on the main process, pdfjs-dist handles PDF rendering (thumbnails and image export) via its own worker, and contextBridge/ipcMain.handle forms the sole communication channel between the two worlds. This separation is not optional — it is the security and performance model of Electron, and deviating from it causes either security vulnerabilities (nodeIntegration shortcuts) or UI freezes (blocking main or renderer threads with CPU work). The recommended stack is 100% pure JavaScript/TypeScript with no native binary dependencies, which is both a technical constraint (critical for a self-contained Windows NSIS installer) and a firm architectural filter that eliminates several otherwise tempting libraries.

The product's differentiating angle is privacy-first local processing combined with the Copy-and-Next image review workflow, which has no equivalent in free desktop tools. Table stakes are well-defined by the competitive landscape: page range text input with "1-5, 8" syntax, page count on load, password-protected PDF detection, determinate progress for image conversion, and a success state with Open Folder are all expected in any serious PDF utility. The highest-complexity differentiator — a visual thumbnail strip for page selection — is correctly identified as a v1 deferral; the text range input with preview is sufficient for v1 and carries far less implementation risk.

The dominant risks fall into two categories. At scaffold time, incorrect Electron security configuration (nodeIntegration, contextIsolation, raw ipcRenderer exposure) creates vulnerabilities that are expensive to retrofit and can undermine the privacy value proposition. At distribution time, Windows code signing for the auto-updater is a hard requirement that must be procured before v1 ships — unsigned installers cause SmartScreen blocks and silent auto-update failures. Both risks are fully preventable with upfront attention during their respective phases.

---

## Key Findings

### Recommended Stack

The stack is anchored by Electron (latest stable, ~v34), Svelte 5 with runes, electron-vite for scaffolding + dev, and electron-builder for packaging. This pairing is the most common 2025 community combination and has first-class support for all three elements. The PDF layer uses two distinct libraries for two distinct jobs: pdf-lib for structural manipulation (extract, split, merge) and pdfjs-dist for rendering (thumbnails, image conversion). The constraint that eliminates all alternatives is the no-native-binaries requirement: the entire dependency tree must be pure JS/TS so the NSIS installer is self-contained. This constraint drives every library choice and rules out node-pdftk, hummus-recipe, pdf2pic, node-canvas, and Puppeteer.

**Core technologies:**
- **Electron ~v34:** Desktop shell, OS APIs, packaging — Windows-only target simplifies compatibility
- **Svelte 5:** Renderer UI with runes-based reactivity — smaller bundle, faster startup, cleaner for independent mode components
- **electron-vite ~v3:** Scaffold + dev server — first-class Svelte template, handles main/preload/renderer HMR cleanly
- **electron-builder ~v25:** Windows packaging — NSIS installer, GitHub Releases publish config, best-in-class Windows support
- **pdf-lib ~v1.17:** PDF manipulation — extract, split, merge in pure JS; no native deps
- **pdfjs-dist ~v4:** PDF rendering — page-to-canvas rasterization for image export and thumbnails; no native deps
- **electron-updater ~v6:** Auto-update via GitHub Releases — ships with electron-builder, reads latest.yml from release assets
- **electron-store ~v10:** Settings persistence — key-value store in userData, atomic writes, correct path semantics
- **contextBridge + ipcMain.handle:** IPC — the only correct modern Electron communication pattern; never nodeIntegration

See `.planning/research/STACK.md` for full alternatives analysis.

### Expected Features

The competitive bar is set by ilovepdf, smallpdf, PDFsam, and PDF24. Users who manipulate PDFs daily know exactly what they expect; missing table stakes features read as amateur work.

**Must have (table stakes for v1):**
- Page range text input with "1-5, 8, 12-15" syntax — click-only pickers are unusable for long documents
- Page count displayed immediately on file load — required for all subsequent decisions
- Password-protected PDF detection at load time with a clear, friendly message
- Drag-and-drop file loading — required by modern desktop utility conventions
- Output path shown before the operation runs — prevents "where did it go?" confusion
- Determinate progress bar for image conversion (page N of M) — long operations need real feedback
- Success state with Open Folder button — required regardless of auto-open setting
- Specific error messages distinguishing password-protected, corrupt, and write-failure cases
- Split: part-count preview text ("4 parts of 10 pages, 1 part of 7 pages") before running
- Merge: file list with drag-to-reorder, per-file page count, individual remove button
- Convert: DPI preset selector (72/96/150/300), PNG/JPEG choice with inline format explanation
- Review workflow (Copy-and-Next) with Space/Enter keyboard shortcut
- Per-mode last-used settings persistence (DPI, format, split strategy)
- Timestamp-based output subfolders — no overwrites across multiple runs

**Should have (differentiators for v1):**
- "100% local — no upload" trust signal in UI footer or About screen — zero code cost, high value for target audience
- Page range preview text ("Pages selected: 6") updating as user types — client-side, no PDF library needed
- Merge: page count per file shown in the file list alongside filename

**Defer (v2+):**
- Thumbnail strip for visual page selection — highest-complexity UI feature; requires pdfjs-dist rendering, virtual scroll, and click-selection state. Validate text range input first
- Dark/light theme toggle — placeholder in Settings; implementation deferred per PROJECT.md

**Anti-features (do not build):**
- PDF text/annotation editing, PDF viewer/reader, OCR, cloud sync, batch folder processing, page rotation, undo/history, custom output filename templates

See `.planning/research/FEATURES.md` for full feature dependency graph.

### Architecture Approach

The application has a clear three-layer architecture: a renderer process (Chromium + Svelte) responsible exclusively for UI; a main process (Node.js) responsible for all OS interaction, file I/O, and Worker Thread management; and a preload script (contextBridge) that forms the explicit, typed API surface between them. All CPU-bound PDF work runs in Worker Threads spawned from main — never in the renderer and never blocking the main process event loop. Progress events flow from Worker Thread → ipcMain → webContents.send → Svelte store → ProgressBar, enabling responsive UI during long operations. Mode routing uses a single Svelte writable store (no URL router needed for four modes). Each mode has its own isolated state store; shared operation state (progress, error, result) lives in a shared `operation` store consumed by ProgressBar and ResultPanel.

**Major components:**
1. **main.js + ipcHandlers.js** — Window lifecycle and all ipcMain.handle() registrations, delegates to workers; never does PDF work directly
2. **preload.js (contextBridge)** — Typed, minimal API surface exposed to renderer; exposes named functions only, never raw ipcRenderer
3. **pdfWorker.js (Worker Thread)** — All pdf-lib and pdfjs-dist execution; posts progress messages per page, resolves done/error
4. **pdfOperations.js** — Pure functions (extractPages, splitPdf, mergePdfs, convertToImages); no Electron dependency; independently testable with Vitest
5. **App.svelte + view components** — Svelte shell with conditional mode rendering; ExtractView, SplitView, ConvertView, MergeView, ReviewView, SettingsView
6. **Shared components** — FilePicker, PageRangeInput, OutputDestPicker, ProgressBar, ResultPanel — composed into every mode view
7. **Svelte stores** — activeMode, settings, operation (shared), plus per-mode state stores
8. **updater.js** — electron-updater wrapper; renderer gets update state via IPC push events, triggers install via invoke

See `.planning/research/ARCHITECTURE.md` for complete data flow diagrams and file layout.

### Critical Pitfalls

1. **nodeIntegration: true / contextIsolation: false at scaffold time** — Creates a severe security vulnerability that is expensive to retrofit and destroys the privacy value proposition. Prevention: use electron-vite scaffold defaults, never override nodeIntegration or contextIsolation, verify webPreferences explicitly before any feature work.

2. **Exposing raw ipcRenderer through contextBridge** — Defeats the isolation model; renderer can invoke any registered IPC channel. Prevention: expose only named, typed wrapper functions in preload.js; never expose the ipcRenderer object itself.

3. **PDF processing on the main thread or renderer thread** — Blocks the entire event loop; UI shows "Not Responding" on Windows with large files. Prevention: all pdf-lib and pdfjs-dist work in Worker Threads; use ipcMain.handle to delegate, never to execute.

4. **pdfjs-dist worker misconfiguration in Electron** — workerSrc pointing to CDN URL or wrong local path causes silent fallback to main-thread rendering (no error thrown). Prevention: spike the pdfjs-dist + electron-vite worker setup (the `?url` import pattern) as the first task in the Convert mode phase, before any UI work.

5. **DPI/scale mismatch in PDF-to-image conversion** — pdfjs-dist uses scale not DPI; scale = DPI/72. At 300 DPI, a full A4 page is ~26MB uncompressed; 100-page PDF = 2.6GB in memory. Prevention: use DPI presets (not free-form), process pages sequentially (not Promise.all), add a file size warning for large PDFs.

6. **Code signing required for Windows auto-update** — Unsigned NSIS installers trigger SmartScreen and cause silent auto-update failures. Prevention: procure a code signing certificate (OV minimum, EV preferred) before v1 ship; store credentials in GitHub Actions secrets; test full update flow in a clean Windows VM.

7. **IPC progress listener accumulation** — ipcRenderer.on() is additive; 10 operations = 10 listeners firing per tick. Prevention: call removeAllListeners before registering each progress listener; provide a cleanup function from preload; call it in Svelte onDestroy.

See `.planning/research/PITFALLS.md` for full pitfall catalog with code examples.

---

## Implications for Roadmap

Based on the architectural dependency order in ARCHITECTURE.md and the pitfall phase warnings in PITFALLS.md, the following phase structure is recommended. The highest-risk pitfalls (security configuration, IPC contract, worker threading pattern) must all be addressed before any PDF feature work begins, making a dedicated foundation phase non-negotiable.

### Phase 1: Electron Foundation + IPC Scaffold

**Rationale:** Security configuration and IPC contract shape every subsequent phase. Getting these wrong at setup means retrofitting across all mode implementations. The architecture recommendation is explicit: build a working skeleton where renderer and main talk to each other before any real PDF work. This phase also establishes the component library so all mode views can be composed cleanly rather than each reinventing shared UI.

**Delivers:** Working Electron app with mode switching, correct security config, full preload API surface (stubs), Svelte shell with sidebar navigation, all shared components (FilePicker, PageRangeInput, OutputDestPicker, ProgressBar, ResultPanel), and Svelte stores scaffolded.

**Addresses:** File load (drag-drop + picker), output path display, mode navigation skeleton.

**Avoids:**
- Pitfall 1: nodeIntegration/contextIsolation misconfiguration
- Pitfall 2: contextIsolation disabled to "fix" bridge issues
- Pitfall 3: Raw ipcRenderer exposure
- Pitfall 11: Monolithic mode components (shared components defined here)
- Pitfall 15: Native module compile failures (audit dependencies now)
- Pitfall 16: Dialog in renderer (IPC pattern established here)
- Pitfall 19: Hard-coded paths (use app.getPath() from the start)

**Research flag:** Standard patterns — electron-vite scaffold + contextBridge is extensively documented. No phase research needed.

---

### Phase 2: Core PDF Operations (Extract, Split, Merge)

**Rationale:** These three modes share a common data flow: load PDF → operate on page structure → write output PDF. They all use pdf-lib only (no pdfjs-dist rendering), which makes them implementable as a group. Building them together establishes the Worker Thread pattern once and reuses it three times. The IPC progress listener lifecycle pattern (Pitfall 14) must be established here and reused by all subsequent operations.

**Delivers:** Fully functional Extract (page range text input with preview), Split (by-parts and max-pages with part-count preview), and Merge (file list with reorder, per-file page count, remove button) modes. Password-protected PDF detection. Specific error messages. Progress spinner. Success state with Open Folder.

**Uses:** pdf-lib, worker_threads (pdfWorker.js), ipcMain.handle, ipcRenderer.invoke.

**Implements:** pdfWorker.js Worker Thread pattern, pdfOperations.js pure functions, per-mode state stores, shared operation store.

**Avoids:**
- Pitfall 4: PDF processing on main/renderer thread (Worker Thread pattern established here)
- Pitfall 12: Encrypted PDF crash (error handling pattern established here)
- Pitfall 13: Font embedding limitations (documented, not worked around)
- Pitfall 14: IPC listener accumulation (removeAllListeners pattern established here)
- Pitfall 17: Large PDF memory footprint (sequential loading, file size warnings)

**Research flag:** Standard patterns — pdf-lib extract/split/merge are well-documented with examples. Worker Thread pattern for Electron is established. No phase research needed, but spike encrypted PDF detection early in the phase.

---

### Phase 3: Convert to Images + Review Workflow

**Rationale:** This mode requires pdfjs-dist in addition to pdf-lib, introducing the rendering worker configuration challenge (Pitfall 6) and the DPI/memory calculation challenge (Pitfall 7). It also introduces the clipboard IPC for the Copy-and-Next review workflow (Pitfall 20). Isolating this phase allows focused attention on these distinct technical challenges without them tangling with the structural PDF operations.

**Delivers:** Convert to Images mode with DPI presets (72/96/150/300), PNG/JPEG format choice with inline explanation, determinate page-by-page progress. ReviewView (Copy-and-Next) with keyboard shortcut (Space/Enter). Native clipboard integration for image copy.

**Uses:** pdfjs-dist + electron-vite worker bundling (?url import), OffscreenCanvas, Electron clipboard module via IPC.

**Implements:** pdfjs-dist GlobalWorkerOptions.workerSrc configuration, sequential page rendering loop, DPI-to-scale calculation (scale = DPI / 72), ReviewView.svelte, convertState.js store.

**Avoids:**
- Pitfall 6: pdfjs-dist worker misconfiguration — spike worker setup first, verify no "Setting up fake worker" console warning
- Pitfall 7: DPI scale mismatch and OOM — use presets, sequential await loop, calculate memory budget
- Pitfall 20: Browser clipboard API unreliable for images — use Electron native clipboard via IPC

**Research flag: Needs phase research.** pdfjs-dist worker bundling with electron-vite's Vite configuration (the `?url` import syntax) has low confidence on exact syntax. Verify against current pdfjs-dist and electron-vite docs before implementation. Also verify pdfjs-dist version compatibility with current Electron's Chromium version.

---

### Phase 4: Settings + Persistence

**Rationale:** Settings persistence is simpler to add after modes work. Adding it earlier creates over-engineering risk and adds a dependency that complicates iterating on mode UIs. By Phase 4, all mode behavior is defined and persisting per-mode last-used values (DPI, format, split strategy) can be implemented without guessing what needs to be stored.

**Delivers:** electron-store integration for output path, auto-open toggle, and per-mode last-used settings. SettingsView.svelte wired to IPC. Settings persisted across restarts. App version display in Settings.

**Uses:** electron-store, app.getPath() for default output directory.

**Implements:** settings.js store synchronized with main via IPC on startup, SettingsView.svelte, per-mode settings keys in electron-store.

**Avoids:**
- Pitfall 19: Hard-coded paths (already prevented in Phase 1; confirmed here)

**Research flag:** Standard patterns — electron-store is well-documented and straightforward. No phase research needed.

---

### Phase 5: Distribution + Auto-Update

**Rationale:** Auto-update requires a built artifact and real GitHub Releases to test end-to-end. It is last because it depends on everything else working correctly, and the code signing procurement process has a lead time that should be started in Phase 4 or earlier. This phase is the highest-risk for non-technical blockers (certificate procurement, CI configuration, SmartScreen behavior).

**Delivers:** NSIS installer via electron-builder, GitHub Releases publish config, electron-updater integrated with update status in SettingsView, "Install Now" button, code-signed installer. CI pipeline for building and publishing releases.

**Uses:** electron-builder NSIS target, electron-updater, GitHub Actions with WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD secrets.

**Implements:** updater.js with electron-updater event handling, SettingsView update status, GitHub Actions release workflow.

**Avoids:**
- Pitfall 8: Unsigned installer blocks auto-update — procure certificate before this phase starts
- Pitfall 9: publish config mismatch — use releaseType: release (not draft), verify latest.yml in release assets
- Pitfall 10: Dev dependencies bloating installer — use npm ci --production in CI, check installer size against 120MB threshold
- Pitfall 21: Installer filename with spaces in CI — set explicit artifactName in electron-builder.yml
- Pitfall 22: Draft release invisible to updater — never publish as draft in production CI

**Research flag:** Partially needs research. Code signing configuration and SmartScreen behavior may have changed. Verify current electron-builder signing config syntax and test the full update flow in a clean Windows VM (not the dev machine) before declaring Phase 5 complete.

---

### Phase Ordering Rationale

- **Security before features:** Pitfalls 1-3 are retrofit-expensive. Foundation first is non-negotiable.
- **Worker Thread pattern established in Phase 2:** All subsequent PDF work reuses the same pattern. Establishing it once on simpler operations (no rendering complexity) means Phase 3 can focus on the pdfjs-dist-specific challenges.
- **Convert isolated in Phase 3:** The pdfjs-dist worker configuration, DPI/memory math, and clipboard IPC are all specific to this mode. Mixing them into Phase 2 would create scope that's harder to test and debug.
- **Settings after modes:** Avoids over-designing persistence before knowing exactly what each mode needs to remember.
- **Distribution last:** Requires all other phases working, plus external dependencies (certificate, CI, GitHub org setup) that have real-world lead time.

### Research Flags

**Needs phase research before implementation:**
- **Phase 3 (Convert to Images):** pdfjs-dist worker bundling with electron-vite + Vite's `?url` import syntax has low confidence on exact configuration. Verify against current pdfjs-dist docs and electron-vite release notes before starting implementation. Estimated 1-2 hours of targeted research.
- **Phase 5 (Distribution):** Code signing configuration syntax and SmartScreen behavior should be verified against current electron-builder docs before starting. Start code signing certificate procurement at the beginning of Phase 4 to avoid blocking Phase 5.

**Standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** contextBridge + electron-vite scaffold is extensively documented with stable patterns.
- **Phase 2 (Core PDF Ops):** pdf-lib extract/split/merge and Worker Thread patterns are well-established.
- **Phase 4 (Settings):** electron-store is simple, well-documented, and stable.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core library choices (pdf-lib, pdfjs-dist, electron-vite, electron-builder) are stable and well-documented. Only Electron version number is MEDIUM (v34 estimated; verify on electronjs.org before pinning). |
| Features | HIGH for table stakes / MEDIUM for differentiators | Table stakes reflect consistent patterns across 5+ established tools. Competitive differentiator analysis drawn from training knowledge without web verification. |
| Architecture | HIGH | Electron process model (main/renderer split, contextBridge requirement, Worker Threads for CPU work) is stable across Electron v20-v34 and documented as the required pattern. |
| Pitfalls | HIGH for Electron/security/packaging pitfalls / MEDIUM for pdfjs-dist specifics | Electron security, IPC, and packaging pitfalls are extensively documented. pdfjs-dist Electron worker setup has some LOW-confidence specifics (exact Vite ?url import syntax) requiring verification. |

**Overall confidence:** HIGH

### Gaps to Address

- **pdfjs-dist + electron-vite worker bundling syntax:** The exact Vite configuration for bundling the pdfjs-dist worker in an electron-vite project (the `?url` import pattern) has low confidence on current syntax. Address with targeted research at the start of Phase 3. Check for "Setting up fake worker" console warning as the validation signal.

- **Electron current sandbox default:** The PITFALLS research flags that Electron's sandbox default was changed to `true` in Electron 20+. Verify the exact behavior in the version being used during Phase 1 setup.

- **pdf-lib ParseSpeeds API:** ParseSpeeds (for large-file optimization) may have changed in recent pdf-lib versions. Verify during Phase 2 before using it for large-file handling.

- **Electron version number:** v34.x is estimated based on release cadence from v32 in mid-2025. Verify the current stable version on electronjs.org before pinning in package.json.

- **Code signing certificate lead time:** OV/EV certificates require business verification and have procurement lead times (days to weeks). This is a project management gap, not a technical gap. Begin procurement no later than the start of Phase 4.

---

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md` — authoritative project constraints (local processing, Windows-only, GitHub Releases distribution, confirmed feature set)
- Electron official docs (contextBridge, process model, IPC) — stable since Electron v12; electronjs.org/docs/latest
- electron-builder docs (NSIS, GitHub Releases publish, auto-update) — electron.build/
- pdf-lib library — pdf-lib.js.org/ — canonical JS PDF manipulation
- pdfjs-dist (Mozilla PDF.js) — mozilla.github.io/pdf.js/
- electron-store — github.com/sindresorhus/electron-store
- electron-updater — electron.build/auto-update

### Secondary (MEDIUM confidence)
- Training data analysis of ilovepdf, smallpdf, PDFsam, PDF24, Adobe Acrobat UX patterns — informs feature table stakes and differentiators
- Community conventions for Svelte store-based routing in single-window apps
- electron-vite + electron-builder pairing prevalence in 2025 community

### Tertiary (LOW confidence, needs verification)
- pdfjs-dist + electron-vite worker import syntax (`?url` pattern) — verify during Phase 3
- Current pdf-lib ParseSpeeds API surface — verify during Phase 2
- Current Electron sandbox default behavior — verify during Phase 1

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
