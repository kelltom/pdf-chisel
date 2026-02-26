# Phase 4: Settings + Persistence - Research

**Researched:** 2026-02-24
**Domain:** Electron persistence (electron-conf), settings UI, IPC integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Per-mode persistence
- Split mode: remembers last-used method (by-parts vs max-pages) AND value
- Convert mode: remembers last-used format (PNG/JPEG) AND DPI preset
- Extract mode: page range always starts blank — not remembered
- Merge mode: no persistent state (drag order is per-file, not per-session)
- Per-mode state is stored silently via electron-store — no settings UI for it
- Feature state (per-mode) is completely separate from global settings

#### Output path
- User sets path via: text field (manual entry) + Browse button (native folder picker dialog)
- Default path when never configured: `~/Documents/PDF Chisel`
- If the configured path doesn't exist at operation time: auto-create it silently, no prompt
- No reset button — user can retype or re-browse to change

#### Settings page layout
- Opening: replaces main content area — same navigation pattern as other modes (gear icon in AppBar)
- Structure: grouped sections, not a flat list
  - **Output** section: output path field + browse button, auto-open toggle
  - **About** section: app version number + link to GitHub releases
- Changes apply immediately (live save) — no Save/Apply button needed
- Settings is global state only; per-mode persistence is transparent

#### Auto-open behavior
- Default on fresh install: **off**
- When enabled: opens File Explorer immediately after operation completes (not on dismiss)
- Opens the **timestamped subfolder** specifically (e.g. `2026-02-24-extract`), not the parent
- Toggle label: "Auto-open output folder"

### Claude's Discretion
- Exact electron-store key schema and structure
- How the Browse button opens the native folder picker (IPC channel design)
- Visual styling of the settings sections (spacing, typography, dividers)
- How the GitHub releases link opens (shell.openExternal)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETT-01 | User can set a default output destination path in settings | electron-conf `conf.get/set('outputPath')` + IPC for folder picker dialog + text field; main process reads stored path for all operations |
| SETT-02 | User can toggle auto-open output folder on/off in settings | electron-conf `conf.get/set('autoOpen')` with default `false`; all operation handlers in main check this before calling `shell.openPath()` |
| SETT-03 | Settings page displays the current app version | `app.getVersion()` in main, exposed via IPC to renderer; reads package.json version at runtime |
</phase_requirements>

## Summary

Phase 4 implements settings persistence using **electron-conf** — a TypeScript-native Electron persistence library that supports both CJS and ESM, making it compatible with this project's electron-vite CJS-bundled main process without any build configuration changes. The alternative (electron-store v11) is pure ESM only and causes known TypeScript/module resolution issues with electron-vite; the electron-vite maintainer explicitly recommends electron-conf instead.

The architecture change this phase introduces is significant: the current codebase hardcodes `~/Documents/PDF Chisel` as the base output directory in every IPC handler in `main/index.ts`. Phase 4 must refactor all five operation handlers (`pdf:extract`, `pdf:split`, `pdf:merge`, `pdf:make-convert-folder`, `pdf:write-image`) to read the user-configured output path from the store at operation time. This is the single most impactful structural change in the phase.

The UI work is straightforward — `SettingsMode.svelte` is a placeholder stub, ready to be replaced. The settings page follows the existing mode pattern exactly: same layout wrapper, same CSS variables, no router changes needed. Per-mode persistence (Split + Convert) is additive — those components read from the store on mount, write on user interaction, with no UI changes.

**Primary recommendation:** Use electron-conf for persistence. Follow the established project IPC pattern (explicit ipcMain.handle + contextBridge api object) rather than electron-conf's `exposeConf()` renderer shortcut — this keeps the API surface consistent and auditable.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron-conf | ^1.3.0 | Persistent key-value config for Electron | CJS+ESM dual support, recommended by electron-vite maintainer as electron-store v11 replacement, ~100x faster than store (single disk read), TypeScript generics |

### Supporting (already in project, no new installs)

| API | Location | Purpose | Notes |
|-----|----------|---------|-------|
| `app.getVersion()` | main process (Electron) | Read app version from package.json | Synchronous, available before `ready` |
| `app.getPath('documents')` | main process (Electron) | Compute default output path default | Already used; `join(app.getPath('documents'), 'PDF Chisel')` |
| `dialog.showOpenDialog` | main process (Electron) | Native folder picker for Browse button | `properties: ['openDirectory']` — already used for file pickers |
| `shell.openExternal(url)` | main process (Electron) | Open GitHub releases link in browser | Already wired: `setWindowOpenHandler` intercepts renderer links |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-conf | electron-store v11 | electron-store v11 is pure ESM; requires `"type": "module"` in package.json + tsconfig changes; known TypeScript module resolution errors in electron-vite ecosystem |
| electron-conf | Manual JSON read/write with `fs` | Eliminates a dependency but loses: atomic writes, defaults, schema validation, dot-notation — not worth it for trivial complexity gain |
| electron-conf | `electron.safeStorage` | Encryption overkill for non-sensitive config (paths, toggles) |

**Installation:**
```bash
npm install electron-conf
```

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Changes are additive:

```
src/
├── main/
│   └── index.ts          # +electron-conf import, store init, new IPC handlers, refactor hardcoded paths
├── preload/
│   └── index.ts          # +settings get/set/browse/version IPC wrappers in api object
└── renderer/src/lib/
    ├── stores/
    │   └── app.svelte.ts  # +settingsState $state object for reactive settings
    └── components/modes/
        ├── SettingsMode.svelte   # Replace placeholder stub with full settings UI
        ├── SplitMode.svelte      # +read split mode state from conf on mount
        └── ConvertMode.svelte    # +read convert mode state from conf on mount
```

### Pattern 1: Store Initialization in Main Process

Initialize the store once when the app starts, before `createWindow()`. Create it at module level so all IPC handlers share the same instance.

```typescript
// Source: electron-conf README (https://github.com/alex8088/electron-conf)
import { Conf } from 'electron-conf/main'

interface AppSettings {
  outputPath: string
  autoOpen: boolean
}

interface FeatureState {
  split: { mode: 'parts' | 'maxPages'; value: number }
  convert: { format: 'png' | 'jpeg'; dpi: number }
}

const settings = new Conf<AppSettings>({
  name: 'settings',
  defaults: {
    outputPath: '',   // empty string = use default at runtime
    autoOpen: false,
  }
})

const featureState = new Conf<FeatureState>({
  name: 'feature-state',
  defaults: {
    split: { mode: 'parts', value: 2 },
    convert: { format: 'png', dpi: 96 },
  }
})
```

**Note:** Use empty string `''` as default for outputPath — resolve to `~/Documents/PDF Chisel` at operation time in main, not at store initialization time. This avoids stale path issues if `app.getPath('documents')` changes between installs.

### Pattern 2: IPC Handlers for Settings (Consistent with Project Style)

Follow the established project IPC pattern. Do NOT use electron-conf's `exposeConf()` / `registerRendererListener()` renderer shortcut — it adds a hidden IPC namespace that conflicts with the project's explicit `api` object and makes the surface area harder to audit.

```typescript
// Source: established project pattern (preload/index.ts + main/index.ts)

// In main/index.ts — inside app.whenReady().then():
ipcMain.handle('settings:get', () => settings.store)
ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>) => {
  settings.set(patch)
})
ipcMain.handle('settings:browse-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Output Folder',
    properties: ['openDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})
ipcMain.handle('app:get-version', () => app.getVersion())

// Feature state handlers
ipcMain.handle('feature-state:get-split', () => featureState.get('split'))
ipcMain.handle('feature-state:set-split', (_event, val) => featureState.set('split', val))
ipcMain.handle('feature-state:get-convert', () => featureState.get('convert'))
ipcMain.handle('feature-state:set-convert', (_event, val) => featureState.set('convert', val))

// In preload/index.ts — add to api object:
getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
setSettings: (patch: Partial<AppSettings>): Promise<void> => ipcRenderer.invoke('settings:set', patch),
browseFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:browse-folder'),
getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
getSplitState: (): Promise<{ mode: 'parts' | 'maxPages'; value: number }> => ipcRenderer.invoke('feature-state:get-split'),
setSplitState: (val: { mode: 'parts' | 'maxPages'; value: number }): Promise<void> => ipcRenderer.invoke('feature-state:set-split', val),
getConvertState: (): Promise<{ format: 'png' | 'jpeg'; dpi: number }> => ipcRenderer.invoke('feature-state:get-convert'),
setConvertState: (val: { format: 'png' | 'jpeg'; dpi: number }): Promise<void> => ipcRenderer.invoke('feature-state:set-convert', val),
```

### Pattern 3: Refactor Hardcoded Output Path in Main Process

**Critical:** Five handlers currently hardcode the base output path. All must read from the store.

```typescript
// BEFORE (current pattern, in each handler):
const baseDir = join(app.getPath('documents'), 'PDF Chisel')

// AFTER (shared helper, called at operation time):
function getOutputBase(): string {
  const stored = settings.get('outputPath')
  return stored && stored.length > 0
    ? stored
    : join(app.getPath('documents'), 'PDF Chisel')
}

// Used in pdf:extract, pdf:split, pdf:merge, pdf:make-convert-folder
const baseDir = getOutputBase()
```

**Affected handlers:** `pdf:extract`, `pdf:split`, `pdf:merge`, `pdf:make-convert-folder`. Handler `pdf:write-image` receives `outputFolder` from renderer (which already called `pdf:make-convert-folder`) — not affected directly.

### Pattern 4: Conditional Auto-Open

All operation handlers that currently call `shell.openPath(outputFolder)` in `ResultsSummary` or are called from `ConvertMode` must check the `autoOpen` setting before opening.

**Important nuance from CONTEXT.md:** Auto-open behavior is currently implemented in the **renderer** (`ConvertMode.svelte` calls `window.api.openOutputFolder(folder)` unconditionally; `ResultsSummary` has similar logic). The settings phase must wire auto-open to control this. Two valid approaches:

**Option A (recommended):** Keep auto-open check in renderer — settings are loaded into reactive `$state` on mount, each mode checks `settingsState.autoOpen` before calling `openOutputFolder`. No main-process change needed; consistent with live-save UX.

**Option B:** Move auto-open check to main — each IPC operation handler calls `shell.openPath` only if `settings.get('autoOpen')` is true. Simpler but less testable from renderer.

**Recommendation: Option A** — keeps renderer responsible for UX decisions (when to open folder), main responsible for I/O. Matches existing architecture where renderer controls the post-operation UX flow.

### Pattern 5: Settings Reactive State in Renderer

Load settings once on app mount, store in reactive Svelte `$state`. Live-save on each change.

```typescript
// In app.svelte.ts or a new settings.svelte.ts store:
export const settingsState = $state({
  outputPath: '',
  autoOpen: false,
  appVersion: '',
})

// Load on app init (in App.svelte or SettingsMode onMount):
onMount(async () => {
  const s = await window.api.getSettings()
  settingsState.outputPath = s.outputPath
  settingsState.autoOpen = s.autoOpen
  settingsState.appVersion = await window.api.getAppVersion()
})
```

### Pattern 6: shell.openExternal for GitHub Link

The project already intercepts window.open in main (`setWindowOpenHandler` calls `shell.openExternal`). For the GitHub releases link in Settings About section, use an `<a href>` tag or trigger `shell.openExternal` via a dedicated IPC handler:

```typescript
// Add to preload api object:
openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

// In main:
ipcMain.handle('shell:open-external', (_event, url: string) => {
  shell.openExternal(url)
})
```

**Alternative:** Use `<a href="https://github.com/..." target="_blank">` — the existing `setWindowOpenHandler` already calls `shell.openExternal(details.url)` and returns `{ action: 'deny' }`, so anchor tags with `target="_blank"` already route through `shell.openExternal` without any new IPC needed. **Use this — zero new code.**

### Anti-Patterns to Avoid

- **Don't use electron-conf's `exposeConf()` renderer shortcut:** It exposes a separate IPC namespace that bypasses the project's established `api` contextBridge object, making the API surface inconsistent and harder to audit.
- **Don't initialize the store inside `app.whenReady()`:** Initialize at module scope so the store exists before any IPC handler accesses it.
- **Don't read the store in every single operation with a new Conf() instance:** Create one instance per store file at module level. electron-conf explicitly does not support multiple instances reading the same file simultaneously.
- **Don't store the resolved default path:** Store empty string or the user-chosen path only. Resolve `app.getPath('documents')` at operation time to avoid stale values.
- **Don't call `mkdir` for the output path in the settings handler:** Only auto-create when an operation actually runs, not when the user browses/types a path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON config persistence | Custom `fs.readFile/writeFile` with locking | electron-conf | Atomic writes, defaults system, type safety, dot-notation, established Electron pattern |
| Default value fallback | Custom null-checking everywhere | `conf.get('key', defaultValue)` | Built-in default support, single source of truth |
| Version display | Custom package.json parsing | `app.getVersion()` | Electron built-in, reads packaged version correctly in both dev and production |
| Folder picker dialog | Custom file system tree UI | `dialog.showOpenDialog({ properties: ['openDirectory'] })` | Native OS dialog, already used in project for file pickers |

**Key insight:** electron-conf loads the entire config file once into memory on first access. All subsequent `get()` calls are synchronous in-memory reads (~100x faster than disk). This means settings reads in operation handlers have zero I/O overhead.

## Common Pitfalls

### Pitfall 1: electron-store v11 ESM Incompatibility
**What goes wrong:** Installing `electron-store` (v10+) in this project causes TypeScript module resolution errors because it's pure ESM but electron-vite bundles main/preload as CJS.
**Why it happens:** electron-store v10+ dropped CommonJS. The project's tsconfig.node.json uses the `@electron-toolkit/tsconfig` base which does not set `"module": "NodeNext"` — required for ESM resolution.
**How to avoid:** Use `electron-conf` instead. It ships both CJS and ESM and requires no build config changes.
**Warning signs:** TypeScript error about `Cannot find module 'electron-store' or its corresponding type declarations` or `ERR_REQUIRE_ESM` at runtime.

### Pitfall 2: Multiple Conf Instances on Same File
**What goes wrong:** Creating `new Conf({ name: 'settings' })` in multiple places (e.g., once in app.whenReady and once in a helper) causes write conflicts.
**Why it happens:** electron-conf explicitly does not support multiple instances on the same file.
**How to avoid:** Initialize one `const settings = new Conf(...)` at module scope in `main/index.ts`, use that single instance across all handlers.
**Warning signs:** Settings appearing to not save, or saving one value that overwrites another.

### Pitfall 3: Hardcoded Output Path Not Refactored
**What goes wrong:** User sets a custom output path in settings but operations still write to `~/Documents/PDF Chisel`.
**Why it happens:** Five IPC handlers in `main/index.ts` each hardcode `const baseDir = join(app.getPath('documents'), 'PDF Chisel')`. Easy to miss one.
**How to avoid:** Extract a `getOutputBase()` helper function, replace all five instances, verify with a grep after implementation.
**Warning signs:** SETT-01 appears to save correctly but new files still appear in Documents.

### Pitfall 4: Auto-Open Runs on Every Operation When Default is Off
**What goes wrong:** Fresh install opens folder after every operation even though default is `autoOpen: false`.
**Why it happens:** `ConvertMode.svelte` has an unconditional `window.api.openOutputFolder(folder)` call after conversion. `ResultsSummary.svelte` may have similar logic.
**How to avoid:** Before calling `openOutputFolder`, check `settingsState.autoOpen`. Load settings before first operation completes.
**Warning signs:** Folder opens automatically after convert even with auto-open toggled off.

### Pitfall 5: dialog.showOpenDialog on Electron 37
**What goes wrong:** The native folder picker opens as a file picker instead of directory picker.
**Why it happens:** Known regression in Electron 37 — `properties: ['openDirectory']` incorrectly shows file picker.
**How to avoid:** This project uses Electron ~34.x — the bug is NOT present. No workaround needed. (Document for future: avoid upgrading to 37 until fixed.)
**Warning signs:** Only relevant on Electron 37+.

### Pitfall 6: app.getVersion() Returns '0.0.0' in Dev
**What goes wrong:** Settings About section shows `0.0.0` during dev mode.
**Why it happens:** In development, `app.getVersion()` reads from `package.json` which currently has `"version": "1.0.0"` — this should be fine. But if version is never updated, it will read correctly.
**How to avoid:** No special handling needed. `app.getVersion()` reliably returns the package.json version in both dev and production. The version shown is always whatever is in package.json.
**Warning signs:** Only a concern if the packaged app shows wrong version — in that case check electron-builder version config.

## Code Examples

Verified patterns from official sources:

### electron-conf: Store Initialization
```typescript
// Source: https://github.com/alex8088/electron-conf (README)
import { Conf } from 'electron-conf/main'

const settings = new Conf<{ outputPath: string; autoOpen: boolean }>({
  name: 'settings',
  defaults: { outputPath: '', autoOpen: false }
})

// Read:
const path = settings.get('outputPath')         // '' on first run
const auto = settings.get('autoOpen')           // false on first run

// Write:
settings.set('outputPath', '/Users/me/Desktop/PDFs')
settings.set('autoOpen', true)
settings.set({ outputPath: '/foo', autoOpen: true })  // batch update
```

### electron-conf: Feature State (Silent Per-Mode Persistence)
```typescript
// Source: https://github.com/alex8088/electron-conf (README)
const featureState = new Conf<{
  split: { mode: 'parts' | 'maxPages'; value: number }
  convert: { format: 'png' | 'jpeg'; dpi: number }
}>({
  name: 'feature-state',
  defaults: {
    split: { mode: 'parts', value: 2 },
    convert: { format: 'png', dpi: 96 }
  }
})
```

### dialog.showOpenDialog: Folder Picker
```typescript
// Source: https://www.electronjs.org/docs/latest/api/dialog
const { canceled, filePaths } = await dialog.showOpenDialog({
  title: 'Select Output Folder',
  defaultPath: settings.get('outputPath') || app.getPath('documents'),
  properties: ['openDirectory'],
})
if (canceled || filePaths.length === 0) return null
return filePaths[0]
```

### app.getVersion()
```typescript
// Source: https://www.electronjs.org/docs/latest/api/app
app.getVersion()  // Returns "1.0.0" from package.json, works in dev and production
```

### shell.openExternal via existing setWindowOpenHandler
```html
<!-- Renderer: no new IPC needed — existing setWindowOpenHandler intercepts target="_blank" -->
<a href="https://github.com/your-user/pdf-chisel/releases" target="_blank" rel="noreferrer">
  View Releases
</a>
```

### Refactored Output Path Helper
```typescript
// In main/index.ts — replace all five hardcoded baseDir occurrences:
function getOutputBase(): string {
  const stored = settings.get('outputPath')
  return stored && stored.length > 0
    ? stored
    : join(app.getPath('documents'), 'PDF Chisel')
}
```

### SettingsMode.svelte: Live-Save Pattern
```typescript
// Live save on blur for text field, live save on toggle click
// No debounce needed — IPC invoke is fire-and-forget for settings
async function handlePathChange(newPath: string) {
  outputPath = newPath
  await window.api.setSettings({ outputPath: newPath })
}
async function handleAutoOpenToggle() {
  autoOpen = !autoOpen
  await window.api.setSettings({ autoOpen })
}
```

### SplitMode.svelte: Load Persisted State on Mount
```typescript
// onMount in SplitMode — load last-used values silently
import { onMount, onDestroy } from 'svelte'

onMount(async () => {
  const saved = await window.api.getSplitState()
  splitMode = saved.mode
  splitValue = saved.value
})

// After user changes splitMode or splitValue — fire-and-forget save
$effect(() => {
  window.api.setSplitState({ mode: splitMode, value: splitValue })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| electron-store (all versions) | electron-conf for electron-vite projects | electron-store v10 (2023) dropped CJS | electron-conf has simpler setup in CJS-bundled Electron projects |
| Direct renderer Store instance via `Store.initRenderer()` | Explicit IPC handles | electron-conf v1 | Matches project pattern; better auditability |

**Deprecated/outdated:**
- `electron-store` v9 and earlier: was CJS-compatible, but now outdated. v10+ is pure ESM. Do not use any version of electron-store in this project without first adding `"type": "module"` to package.json and updating tsconfig (which this project should NOT do).

## Open Questions

1. **Auto-open: renderer vs main?**
   - What we know: Current auto-open calls (`window.api.openOutputFolder()`) are in renderer components
   - What's unclear: Whether to check `settingsState.autoOpen` in renderer (Option A) or move the `shell.openPath` call to main and check there (Option B)
   - Recommendation: Option A (renderer check) — keeps UX decisions in renderer, consistent with existing architecture. The `settingsState` reactive object makes this clean.

2. **Settings load timing: App mount vs SettingsMode mount?**
   - What we know: Split and Convert modes need persisted state on first render; SettingsMode needs outputPath and autoOpen
   - What's unclear: Whether to load all settings in `App.svelte` `onMount` (single load, always available) or lazily in each component
   - Recommendation: Load `settingsState` in `App.svelte` `onMount` so it's available before any mode renders. Load `appVersion` lazily in `SettingsMode.svelte onMount` (only needed there).

3. **$effect for per-mode state saving — Svelte 5 behavior**
   - What we know: `$effect` runs when reactive state it reads changes
   - What's unclear: Does `$effect` fire on initial mount with the just-loaded value, causing a redundant save on first render?
   - Recommendation: Guard the save effect with a `mounted` flag, or use explicit event handlers on user interaction rather than a reactive `$effect`. Explicit handlers are cleaner.

## Sources

### Primary (HIGH confidence)
- `https://github.com/alex8088/electron-conf` — Full README, API, renderer pattern, TypeScript generics
- `https://www.electronjs.org/docs/latest/api/dialog` — dialog.showOpenDialog openDirectory pattern
- `https://www.electronjs.org/docs/latest/api/app` — app.getVersion(), app.getPath()
- `https://github.com/sindresorhus/electron-store` — v11 ESM-only confirmation, IPC pattern docs

### Secondary (MEDIUM confidence)
- `https://github.com/alex8088/electron-vite/discussions/542` — electron-vite maintainer recommending electron-conf over electron-store; ESM compatibility context
- `https://electron-vite.org/guide/troubleshooting` — ESM-only package bundling with `exclude` config
- `https://github.com/electron/electron/issues/48217` — dialog.showOpenDialog Electron 37 regression (does NOT affect Electron 34)

### Tertiary (LOW confidence)
- None — all critical claims verified with primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — electron-conf API verified from official README; electron-store ESM incompatibility confirmed from official repo and electron-vite maintainer discussion
- Architecture: HIGH — IPC patterns drawn directly from established project code; refactor scope verified by reading main/index.ts and all five hardcoded baseDir locations
- Pitfalls: HIGH — ESM incompatibility verified with official sources; Electron 37 bug confirmed from GitHub issue (and explicitly does not affect Electron 34)

**Research date:** 2026-02-24
**Valid until:** 2026-09-24 (stable ecosystem, ~6 months before re-checking electron-conf version)
