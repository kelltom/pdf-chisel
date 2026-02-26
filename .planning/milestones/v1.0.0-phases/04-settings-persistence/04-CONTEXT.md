# Phase 4: Settings + Persistence - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A settings page (global state only) where users configure output path and auto-open behavior, persisting via electron-store across app restarts. Per-mode last-used values (Split method/value, Convert format/DPI) also persist silently in the background — but are NOT surfaced in the Settings UI. Feature state and global state are kept separate.

Required: SETT-01 (output path), SETT-02 (auto-open toggle), SETT-03 (version display).

</domain>

<decisions>
## Implementation Decisions

### Per-mode persistence
- Split mode: remembers last-used method (by-parts vs max-pages) AND value
- Convert mode: remembers last-used format (PNG/JPEG) AND DPI preset
- Extract mode: page range always starts blank — not remembered
- Merge mode: no persistent state (drag order is per-file, not per-session)
- Per-mode state is stored silently via electron-store — no settings UI for it
- Feature state (per-mode) is completely separate from global settings

### Output path
- User sets path via: text field (manual entry) + Browse button (native folder picker dialog)
- Default path when never configured: `~/Documents/PDF Chisel`
- If the configured path doesn't exist at operation time: auto-create it silently, no prompt
- No reset button — user can retype or re-browse to change

### Settings page layout
- Opening: replaces main content area — same navigation pattern as other modes (gear icon in AppBar)
- Structure: grouped sections, not a flat list
  - **Output** section: output path field + browse button, auto-open toggle
  - **About** section: app version number + link to GitHub releases
- Changes apply immediately (live save) — no Save/Apply button needed
- Settings is global state only; per-mode persistence is transparent

### Auto-open behavior
- Default on fresh install: **off**
- When enabled: opens File Explorer immediately after operation completes (not on dismiss)
- Opens the **timestamped subfolder** specifically (e.g. `2026-02-24-extract`), not the parent
- Toggle label: "Auto-open output folder"

### Claude's Discretion
- Exact electron-store key schema and structure
- How the Browse button opens the native folder picker (IPC channel design)
- Visual styling of the settings sections (spacing, typography, dividers)
- How the GitHub releases link opens (shell.openExternal)

</decisions>

<specifics>
## Specific Ideas

- Default output path is `~/Documents/PDF Chisel` (not Desktop, not source folder)
- Settings page fits into the existing mode navigation pattern — no modal, no side panel
- "Auto-open output folder" is the exact label copy for the toggle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-settings-persistence*
*Context gathered: 2026-02-24*
