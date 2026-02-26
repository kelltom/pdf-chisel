# Milestones

## v1.0.0 MVP (Shipped: 2026-02-26)

**Phases completed:** 7 phases (1, 2, 3, 4, 04.1, 5, 6), 20 plans
**Git range:** b63f6bf (init) → 855a238 (latest)
**Timeline:** 4 days (2026-02-22 → 2026-02-26)
**LOC:** ~3,225 TypeScript + Svelte across 111 files

**Delivered:** A fully functional local PDF utility for Windows with Extract, Split, Merge, and Convert-to-Images modes, complete with settings persistence and a copy-and-review workflow.

**Key accomplishments:**
1. Secure Electron + Svelte app shell with contextBridge IPC, custom title bar, mode navigation, and drag-drop file input
2. Full PDF operations (Extract, Split, Merge) built on Worker Thread pattern with timestamped output subfolders and progress feedback
3. PDF-to-image conversion (PNG/JPEG, 72/96/150/300 DPI) with live page-by-page progress via pdfjs-dist
4. Copy-and-Next review workflow with clipboard integration, keyboard shortcuts (Space/Enter), back navigation, and completion screen
5. electron-conf settings persistence: output path, auto-open toggle, and per-mode last-used values survive restarts
6. Developer README, UI polish (overflow fixes, Reset consolidation, shared CSS/types), and review image scaling fix via CSS-only conditional class

### Known Gaps

- **SETT-04**: Auto-update via GitHub Releases (electron-updater) — not implemented; requires OV code signing certificate not yet procured. Deferred to v1.1.

---

