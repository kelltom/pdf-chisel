# Domain Pitfalls

**Domain:** Electron + Svelte desktop PDF utility (Windows)
**Researched:** 2026-02-22
**Confidence:** HIGH (Electron security, IPC, packaging) | MEDIUM (pdf-lib specifics, pdfjs-dist rendering) | HIGH (auto-updater, signing)

---

## Critical Pitfalls

Mistakes that cause rewrites, security vulnerabilities, or complete feature failures.

---

### Pitfall 1: Enabling nodeIntegration in the Renderer

**What goes wrong:** Setting `nodeIntegration: true` in `BrowserWindow` webPreferences gives every script in the renderer window (including any future third-party library or XSS payload) direct access to Node.js APIs — `fs`, `child_process`, `require`, the whole runtime. For an app that reads local user files, this is a severe attack surface.

**Why it happens:** Tutorials from 2018-2020 used this approach before Electron hardened its defaults. Stack Overflow answers for "how do I read a file in Electron" often still show this pattern. First-time Electron developers copy these examples.

**Consequences:** Any XSS vulnerability or malicious PDF content that triggers script execution can read/write arbitrary files on disk, execute system commands, and exfiltrate data — completely undermining the privacy-first value proposition of PDF Chisel.

**Prevention:**
- Set `nodeIntegration: false` (the default in modern Electron — do not override it)
- Set `contextIsolation: true` (the default — do not override it)
- All Node.js access must go through a `preload.js` script using `contextBridge.exposeInMainWorld()`
- The preload script is the ONLY place Node APIs are allowed

**Warning signs:**
- Any `webPreferences` option with `nodeIntegration: true`
- Any renderer-side code doing `require('fs')` or `require('electron')`
- Tutorial code you're copying was written before Electron 12

**Phase:** Address in Phase 1 (project scaffold). If this is wrong at setup, everything else is wrong.

---

### Pitfall 2: Skipping contextIsolation or Setting sandbox: false

**What goes wrong:** `contextIsolation: false` merges the renderer's JavaScript context with the preload script's context, letting renderer code access preload globals directly. `sandbox: false` disables the Chromium sandbox that isolates the renderer process from the OS.

**Why it happens:** Developers disable these when they can't figure out why their preload bridge "isn't working" — the fix is always to configure `contextBridge` correctly, never to disable isolation.

**Consequences:** Loss of process isolation. A malicious PDF (or a buggy third-party npm package in the renderer) can reach privileged APIs.

**Prevention:**
```javascript
// main.js — correct BrowserWindow config
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,   // default true — keep it
    nodeIntegration: false,   // default false — keep it
    sandbox: true,            // explicit for clarity
  }
});
```

**Warning signs:** Any `contextIsolation: false` or `sandbox: false` in the codebase.

**Phase:** Phase 1 scaffold.

---

### Pitfall 3: Thin Preload / Fat IPC — Exposing Too Much via contextBridge

**What goes wrong:** Developers expose raw `ipcRenderer.invoke` directly to the renderer world:

```javascript
// BAD — exposes the entire IPC mechanism
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer,
});
```

This defeats contextIsolation entirely — renderer can now call any IPC channel, including ones it shouldn't know about.

**Why it happens:** Laziness, or following early Electron + Svelte tutorials that expose raw `ipcRenderer`.

**Consequences:** The renderer can invoke any registered IPC handler, including `app:quit`, `shell:openPath`, or any future sensitive channel. This is an escalation path if any renderer-side code is compromised.

**Prevention:** Expose only specific, named, typed functions — never expose `ipcRenderer` itself:

```javascript
// GOOD — whitelist specific channels
contextBridge.exposeInMainWorld('pdfChisel', {
  extractPages: (args) => ipcRenderer.invoke('pdf:extractPages', args),
  splitPdf: (args) => ipcRenderer.invoke('pdf:splitPdf', args),
  mergePdfs: (args) => ipcRenderer.invoke('pdf:mergePdfs', args),
  convertToImages: (args) => ipcRenderer.invoke('pdf:convertToImages', args),
  openOutputFolder: (path) => ipcRenderer.invoke('shell:openFolder', path),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onProgress: (callback) => ipcRenderer.on('job:progress', (_, data) => callback(data)),
  removeProgressListener: () => ipcRenderer.removeAllListeners('job:progress'),
});
```

**Warning signs:** `ipcRenderer` exposed directly; no typed wrapper functions in preload.

**Phase:** Phase 1 scaffold — IPC contract defined here shapes all future feature work.

---

### Pitfall 4: Running PDF Processing on the Main Process / Renderer Thread

**What goes wrong:** PDF manipulation (pdf-lib) and PDF rendering (pdfjs-dist) both run synchronously or with heavy Promise chains. Running either on the main process blocks the entire Electron event loop — the window freezes and becomes unresponsive. Running rendering in the renderer thread blocks the UI.

**Why it happens:** The simplest architecture is to call `pdf-lib` functions in an IPC handler on the main process. This works for tiny files, then breaks at scale (a 200-page PDF being merged produces visible UI freezes).

**Consequences:** The app appears frozen during operations. On Windows, this triggers the "Not Responding" state in the taskbar. Unacceptable for a utility that processes large PDFs.

**Prevention:**
- PDF manipulation (pdf-lib operations): run in a `worker_threads` Worker spawned from the main process
- PDF rendering (pdfjs-dist thumbnails/conversion): run in the renderer via a Web Worker (pdfjs-dist supports off-main-thread rendering via its worker file)
- Use IPC progress events to update UI (`win.webContents.send('job:progress', { percent, page })`)
- Never do synchronous file I/O in an IPC handler — always use `fs.promises`

**Warning signs:** PDF operations in IPC handlers without Worker delegation; synchronous `fs.readFileSync` for large files; UI freezes during test runs with 50+ page PDFs.

**Phase:** Phase 2 (first PDF feature). Establish the Worker threading pattern before the second feature — retrofitting is painful.

---

### Pitfall 5: pdf-lib Cannot Render PDFs to Images

**What goes wrong:** Developers assume `pdf-lib` is the only PDF library they need. pdf-lib is a creation/manipulation library — it reads and writes PDF structure (pages, metadata, annotations, form fields). It cannot render PDF pages to pixel-accurate images.

**Why it happens:** "PDF library" sounds like it handles all PDF tasks. The distinction between manipulation and rendering is not obvious to newcomers.

**Consequences:** PDF-to-image conversion (the "convert pages to images" mode) silently fails or produces garbage output if the developer tries to get pixel data from pdf-lib.

**Prevention:**
- Use `pdf-lib` for: extract pages, split, merge — anything that operates on PDF structure
- Use `pdfjs-dist` for: rendering pages to canvas/image data, generating thumbnails, the "convert to images" feature
- These two libraries serve entirely different purposes and both are needed

**Warning signs:** Looking for a `.render()` method on pdf-lib's `PDFPage`; confusion about why pdf-lib can't produce PNG output.

**Phase:** Phase 1 research / library selection. Clarify in architecture docs that two libraries serve two roles.

---

### Pitfall 6: pdfjs-dist Worker Configuration in Electron

**What goes wrong:** pdfjs-dist requires a `GlobalWorkerOptions.workerSrc` to be set. In a browser this points to a CDN URL. In Electron (a local file), this must point to the bundled worker file. Getting this path wrong causes pdfjs to silently fall back to the main thread (no error thrown) or throw a cross-origin error.

**Why it happens:** PDF.js documentation focuses on browser usage. Electron's file:// protocol and Vite/Webpack bundling add extra path resolution complexity.

**Consequences:** PDF rendering runs on the main thread (blocking), or fails entirely with opaque errors.

**Prevention:**
```javascript
// In the renderer — correct pdfjs worker setup for Electron + Vite
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

For Electron specifically, test with both `webSecurity: true` and verify the worker file is included in the Vite/esbuild output. With `electron-vite`, the worker bundling is handled automatically — use `electron-vite` to avoid manual configuration.

**Warning signs:** Console warning "Setting up fake worker"; rendering is synchronous instead of async; `workerSrc` is a CDN URL in a packaged app.

**Phase:** Phase 3 (PDF-to-image conversion feature). Spike this early in that phase before building UI.

---

### Pitfall 7: DPI / Resolution Mismatch in PDF-to-Image Conversion

**What goes wrong:** PDF pages are defined in points (1 point = 1/72 inch). When rendering to a canvas via pdfjs-dist, the output resolution is controlled by a `scale` factor, not a DPI value. Developers either forget to scale for the target DPI or use `scale: 1` (which produces 72 DPI output — too low for most uses).

**Why it happens:** The pdfjs-dist API uses `scale` not `dpi`. The mapping is: `scale = targetDPI / 72`. This is not prominently documented.

**Consequences:** Output images are either too small/blurry (scale: 1 = 72 DPI) or memory-exploding large (scale: 4+ on large pages). A 300 DPI full-page image at A4 size is ~2480x3508 pixels — 26MB uncompressed per page for a 100-page PDF = 2.6GB in memory.

**Prevention:**
```javascript
// 300 DPI = scale 4.167
const DPI = 300;
const scale = DPI / 72;
const viewport = page.getViewport({ scale });

// Render to offscreen canvas
const canvas = new OffscreenCanvas(viewport.width, viewport.height);
const ctx = canvas.getContext('2d');
await page.render({ canvasContext: ctx, viewport }).promise;
```

- Offer DPI presets in UI (72, 150, 300) — not a free-form field
- Warn users when estimated output size exceeds a threshold (e.g., >500MB total)
- Process pages sequentially with `await` in a loop, not `Promise.all()` — parallel rendering of many large canvases causes out-of-memory crashes

**Warning signs:** Output images look pixelated at actual print size; app crashes on large PDFs with high DPI selected; `scale: 1` in rendering code.

**Phase:** Phase 3 (convert to images). Calculate memory budgets before implementation.

---

### Pitfall 8: Electron Auto-Updater Requires Code Signing on Windows

**What goes wrong:** `electron-updater` (the `electron-builder` companion) on Windows requires the installer to be code-signed. An unsigned updater will either silently fail to apply updates, or Windows SmartScreen will block the update installer from running. The user sees nothing or a confusing security warning.

**Why it happens:** Code signing is an afterthought. Developers test auto-update on their own machine (where SmartScreen is less aggressive for their own files) and don't catch the failure until users report it.

**Consequences:** Users never receive updates. If a security fix is shipped, users remain on the vulnerable version. This completely breaks the auto-update feature.

**Prevention:**
- Obtain a code signing certificate before shipping v1 (OV — Organization Validation — is minimum; EV — Extended Validation — eliminates SmartScreen warnings immediately)
- Store signing credentials as GitHub Actions secrets: `WIN_CSC_LINK` (base64-encoded .p12), `WIN_CSC_KEY_PASSWORD`
- Configure in `electron-builder.yml`:
```yaml
win:
  certificateFile: ${WIN_CSC_LINK}
  certificatePassword: ${WIN_CSC_KEY_PASSWORD}
  signingHashAlgorithms: ['sha256']
```
- Test the full update flow in a VM with a different Windows account before releasing v1

**Warning signs:** Unsigned NSIS installer in release artifacts; SmartScreen warning on first install; `electron-updater` log shows "No provider" or signature verification failure.

**Phase:** Phase 4 (packaging + distribution). Plan for signing cost/procurement in Phase 4 scope.

---

### Pitfall 9: Auto-Updater publish Configuration Mismatch

**What goes wrong:** `electron-updater` requires `latest.yml` (for Windows) to be published alongside the installer in the GitHub Release. If `electron-builder` publish config is wrong, or the release is a draft, the updater finds no update feed and silently does nothing.

**Why it happens:** `electron-builder` publish config has multiple options (`github`, `generic`, `s3`). First-time developers guess at the config or copy a template that doesn't match GitHub Releases format.

**Consequences:** Auto-update appears to work in development (manual test via `autoUpdater.checkForUpdates()`) but silently fails in production.

**Prevention:**
```yaml
# electron-builder.yml
publish:
  provider: github
  owner: your-github-username
  repo: pdf-chisel
  releaseType: release   # NOT draft — drafts are invisible to the updater
```

- `GITHUB_TOKEN` must be set in CI with `repo` scope for publishing
- After releasing, verify `latest.yml` exists in the GitHub Release assets
- Test update detection by installing the previous version and checking for updates

**Warning signs:** `latest.yml` missing from release assets; GitHub Release is in "draft" state; `autoUpdater` events never fire.

**Phase:** Phase 4 (packaging + distribution).

---

### Pitfall 10: NSIS Installer Size — Including node_modules in Package

**What goes wrong:** Electron apps bundle everything in `node_modules` into the ASAR archive. Including `devDependencies` or large libraries not needed at runtime inflates the installer from ~80MB to 200MB+. This happens because `electron-builder` does not automatically prune dev dependencies before packaging.

**Why it happens:** `npm install` (without `--production`) is run in CI before building, leaving all devDependencies in node_modules.

**Consequences:** Users download a much larger file than necessary. GitHub Releases has a 2GB artifact limit, but more practically, a bloated installer damages the "lightweight" brand promise.

**Prevention:**
- Run `npm ci --production` before packaging, OR
- Configure `electron-builder` `files` array to explicitly exclude dev artifacts
- Use `electron-builder`'s built-in two-phase install: it does `npm install --production` for the packaged app automatically when `npmRebuild` is true (the default)
- Check installer size in CI with `ls -lh dist/*.exe` — flag if over 120MB for this project

**Warning signs:** Installer over 150MB; `node_modules` contains `vite`, `eslint`, `typescript` in packaged app; `asar` archive contains test files.

**Phase:** Phase 4 (packaging).

---

## Moderate Pitfalls

Mistakes that cause significant rework but not rewrites.

---

### Pitfall 11: Svelte Component Architecture — Monolithic Mode Components

**What goes wrong:** Each PDF mode (extract, split, convert, merge) gets its own monolithic Svelte component with duplicated file picker, output path picker, and progress UI. When the shared behavior needs to change (e.g., output path format, progress display style), it must be changed in four places.

**Why it happens:** Building features one at a time without upfront component planning.

**Prevention:**
- Define shared components in Phase 1: `FilePicker.svelte`, `OutputPathPicker.svelte`, `ProgressBar.svelte`, `PageRangeSelector.svelte`
- Each mode component composes these; it does not reimplement them
- Use Svelte stores for shared state: selected output path, settings, current job progress

**Warning signs:** File open dialog code appears more than once; output path input appears in multiple mode components.

**Phase:** Phase 1 scaffold, before any mode implementation.

---

### Pitfall 12: pdf-lib and Encrypted / Password-Protected PDFs

**What goes wrong:** `pdf-lib` throws an error (`Error: Input document to PDFDocument.load is encrypted`) when attempting to load a password-protected PDF without providing the password. The error message is clear but the behavior is a hard stop — there is no partial-load fallback.

**Why it happens:** Developers test with their own unprotected PDFs. Users encounter it with corporate PDFs, legal documents, or scanned files with owner passwords.

**Consequences:** The app crashes (unhandled promise rejection) or shows a generic error for what is actually a common real-world scenario.

**Prevention:**
```javascript
try {
  const pdfDoc = await PDFDocument.load(fileBytes, {
    ignoreEncryption: false,  // default — will throw for encrypted
  });
} catch (e) {
  if (e.message.includes('encrypted')) {
    // Return user-friendly error: "This PDF is password-protected. PDF Chisel cannot process encrypted PDFs."
  }
  throw e;
}
```

- Detect encryption before loading: parse the first 1024 bytes for `/Encrypt` in the PDF cross-reference
- Display a friendly modal: "This PDF is password-protected and cannot be processed."
- Do NOT attempt to implement decryption — it's out of scope and legally complex

**Warning signs:** Unhandled promise rejections on load; generic "something went wrong" errors.

**Phase:** Phase 2 (first PDF feature). Error handling pattern established here applies to all modes.

---

### Pitfall 13: pdf-lib Font Embedding — Standard Fonts vs Custom Fonts

**What goes wrong:** When pdf-lib creates a new PDF (e.g., extracting pages into a new document), text annotations or form fields using custom embedded fonts in the source PDF may not be preserved correctly. The new document uses pdf-lib's font system, which only has the 14 standard PDF fonts built-in.

**Why it happens:** PDF Chisel's core operations (extract, split, merge) copy page content streams, not re-render them. This is correct — but developers sometimes assume that PDF structure copying is lossless.

**Consequences:** Text in annotations or form overlays may change typeface in the output. For pure content pages (not forms/annotations), this is not an issue — page content streams are copied verbatim.

**Prevention:**
- PDF Chisel's operations copy pages as-is using `pdfDoc.copyPages()` — this preserves embedded fonts in the page content stream
- The risk is only for pages with AcroForms or annotation overlays with custom fonts
- Document this limitation: "Interactive form fields and annotations may not be preserved"
- Do not attempt to implement font subsetting or transfer — that is deeply complex

**Warning signs:** Output PDF shows different fonts in form fields; test with a PDF that has AcroForm fields.

**Phase:** Phase 2. Include font-embedded test PDFs in the test suite.

---

### Pitfall 14: IPC Progress Events — Memory Leaks from Event Listener Accumulation

**What goes wrong:** When the renderer registers `ipcRenderer.on('job:progress', callback)`, that listener persists for the lifetime of the window unless explicitly removed. If the user runs 10 conversions in a session, 10 listeners accumulate — each one fires on every progress event, causing duplicate UI updates and eventual memory pressure.

**Why it happens:** `ipcRenderer.on()` is additive. Unlike DOM event listeners on re-rendered elements, IPC listeners live on the `ipcRenderer` object, not on Svelte components, so Svelte's component lifecycle cleanup does not remove them.

**Prevention:**
```javascript
// In preload — use ipcRenderer.once() for one-shot events, or provide removeListener
contextBridge.exposeInMainWorld('pdfChisel', {
  onProgress: (callback) => {
    ipcRenderer.removeAllListeners('job:progress'); // clear before adding
    ipcRenderer.on('job:progress', (_, data) => callback(data));
  },
  onComplete: (callback) => {
    ipcRenderer.removeAllListeners('job:complete');
    ipcRenderer.once('job:complete', (_, data) => callback(data));
  }
});

// In Svelte component
onMount(() => {
  window.pdfChisel.onProgress((data) => { /* update UI */ });
});
onDestroy(() => {
  window.pdfChisel.removeProgressListener();
});
```

**Warning signs:** Progress bar updates multiple times per tick after several operations; memory usage climbs across operations.

**Phase:** Phase 2. Establish the listener lifecycle pattern before adding more IPC channels.

---

### Pitfall 15: Electron Dev Environment — Native Module Compilation Failures

**What goes wrong:** Some npm packages include native C++ addons (`.node` files). These must be compiled against the specific Node.js version that Electron uses internally — which is different from the system Node.js version. Running `npm install` without rebuilding native modules causes `Error: The module was compiled against a different Node.js version` at runtime.

**Why it happens:** The builder is new to Electron. The system might have Node.js 20 installed, but Electron 29+ uses Node.js 20 internally — the ABI version still differs.

**Consequences:** The app crashes on startup with a cryptic native module error. This can also happen in CI if the build environment Node.js version doesn't match.

**Prevention:**
- Audit dependencies for native addons before adding them: check for `binding.gyp` or `*.node` files in the package
- For PDF Chisel's use case, `pdf-lib` and `pdfjs-dist` are pure JavaScript — no native modules needed
- If a native module is ever needed, use `electron-rebuild`: `npx electron-rebuild`
- Add `electron-rebuild` as a `postinstall` script if native modules are introduced

**Warning signs:** `Error: The module ... was compiled against a different Node.js version`; `.node` files in node_modules of a new dependency.

**Phase:** Phase 1 (environment setup). Avoid native modules by design.

---

### Pitfall 16: Opening Files — Dialog in Main vs. Renderer, Path Handling

**What goes wrong:** `dialog.showOpenDialog()` must be called from the main process (or via IPC). Calling it from the renderer without IPC fails silently in newer Electron versions. Additionally, file paths returned are OS-native (Windows backslashes), but code that joins paths assuming forward slashes will break.

**Why it happens:** Old Electron tutorials show `remote.dialog` (deprecated and removed). New developers either use the removed API or attempt direct dialog calls in the renderer.

**Consequences:** File picker does nothing; path joining produces malformed paths on Windows.

**Prevention:**
```javascript
// main.js IPC handler
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(options);
  return result; // { canceled: boolean, filePaths: string[] }
});

// Use Node.js path.join() everywhere — it handles OS separators correctly
const outputPath = path.join(baseDir, `${timestamp}-${mode}`);
```

- Never use string concatenation for paths — always `path.join()` or `path.resolve()`
- Test file paths with a Windows username that has spaces: `C:\Users\John Doe\...`

**Warning signs:** File dialog does nothing when clicked; `remote` import in renderer code; string concatenation for file paths with `/`.

**Phase:** Phase 1 scaffold (IPC pattern) + Phase 2 (first file picker implementation).

---

### Pitfall 17: Large PDF Memory Footprint — Loading Entire File Into Memory

**What goes wrong:** Both pdf-lib and pdfjs-dist load the entire PDF into memory as a Uint8Array. A 500MB PDF scanned document (common in legal/engineering workflows) requires 500MB+ of RAM. Electron's V8 heap has a default limit of ~1.5GB on 64-bit systems. Merging three 200MB PDFs requires all three in memory simultaneously.

**Why it happens:** The simplest approach is `fs.readFile(path)` → pass buffer to library. This works until it doesn't.

**Consequences:** `JavaScript heap out of memory` crashes; Windows reports the app as using excessive RAM; large file operations hang.

**Prevention:**
- For merge: load, copy pages, unload each source document sequentially rather than loading all simultaneously where possible
- Add a file size warning in the UI: "This PDF is large (XXX MB). Processing may take a moment."
- Test with a 100MB+ PDF during development — don't wait for user reports
- For pdf-lib, use `PDFDocument.load(bytes, { parseSpeed: ParseSpeeds.Fastest })` for large files — it defers parsing of non-needed objects

**Warning signs:** App memory usage matches the sum of input file sizes; crashes only on large files; heap out of memory error in main process.

**Phase:** Phase 2 (first PDF feature). Test with large files from day one.

---

## Minor Pitfalls

Annoyances that require small fixes but don't block features.

---

### Pitfall 18: Svelte + Electron Vite — Hot Reload Not Working

**What goes wrong:** `electron-vite` (the recommended scaffold for Electron + Vite) requires a specific config to enable hot reload in the renderer while the main process restarts on changes. Misconfiguration causes either the renderer to not hot-reload, or the entire Electron window to close and reopen on every main-process change.

**Prevention:**
- Use `electron-vite` scaffold (`npm create electron-vite@latest`) — it configures HMR correctly out of the box
- Don't eject from `electron-vite` configuration unless there's a specific reason
- Main process changes restart Electron; renderer changes use HMR without restart — this is expected behavior, not a bug

**Phase:** Phase 1 (dev environment setup).

---

### Pitfall 19: app.getPath() vs. Hard-Coded Paths for Output

**What goes wrong:** Using `os.homedir()` or `process.env.USERPROFILE` directly instead of Electron's `app.getPath('documents')` or `app.getPath('downloads')` for default output paths. On Windows, these can differ if the user has moved their Documents folder to a different drive (very common).

**Prevention:**
```javascript
// GOOD
const defaultOutputDir = app.getPath('documents');

// BAD — may not reflect actual Documents folder location
const defaultOutputDir = path.join(os.homedir(), 'Documents');
```

**Phase:** Phase 1 settings/configuration.

---

### Pitfall 20: Clipboard API for Images — Electron vs. Browser API

**What goes wrong:** The "Copy and Next" review workflow copies rendered page images to the clipboard. The browser Clipboard API (`navigator.clipboard.write()`) works in Electron but requires `clipboard-write` permission, and has limitations with large images. Electron's native `clipboard` module (main process) is more reliable.

**Prevention:**
```javascript
// In preload — expose Electron clipboard for images
contextBridge.exposeInMainWorld('pdfChisel', {
  copyImageToClipboard: (dataUrl) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),
});

// In main
ipcMain.handle('clipboard:writeImage', (_, dataUrl) => {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const nativeImage = NativeImage.createFromBuffer(Buffer.from(base64, 'base64'));
  clipboard.writeImage(nativeImage);
});
```

**Phase:** Phase 3 (review workflow after image conversion).

---

### Pitfall 21: Windows Installer Name Casing and Special Characters

**What goes wrong:** `electron-builder` uses the `productName` from `package.json` to name the installer. If `productName` contains spaces or special characters (e.g., "PDF Chisel"), some Windows environments have issues with the installer path. The default NSIS installer generated is `PDF Chisel Setup 1.0.0.exe` — the space causes problems in some CI `upload-artifact` steps.

**Prevention:**
- Set `productName: "PDF Chisel"` (with space is fine for display)
- Set `artifactName: "${productName}-Setup-${version}.${ext}"` in `electron-builder.yml` to control the output filename explicitly
- Ensure CI artifact upload steps quote the path

**Phase:** Phase 4 (packaging).

---

### Pitfall 22: GitHub Releases — Draft vs. Pre-Release vs. Release

**What goes wrong:** `electron-updater` with `provider: github` only picks up published (non-draft) releases. If `releaseType` is set to `draft` or if the release is never published from draft state, no users receive updates.

**Prevention:**
- Use `releaseType: release` in production CI
- Use `releaseType: prerelease` for beta testing
- Never leave releases in draft state if auto-update should deliver them

**Phase:** Phase 4 (distribution pipeline).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Electron scaffold | nodeIntegration/contextIsolation set incorrectly from tutorial copying | Use `electron-vite` scaffold; verify webPreferences explicitly |
| Phase 1: IPC contract design | Exposing raw `ipcRenderer` instead of typed bridge | Design contextBridge API before writing any feature code |
| Phase 1: Dev environment | Native module compile failures | Audit every dependency for `.node` files; prefer pure-JS libraries |
| Phase 2: First PDF feature | pdf-lib loaded with encrypted PDF crashes app | Wrap all `PDFDocument.load()` calls in try/catch with encryption detection |
| Phase 2: IPC progress events | Listener accumulation across multiple job runs | Establish `removeAllListeners` pattern in preload before wiring first progress event |
| Phase 2: File I/O | Path joining with backslashes on Windows | Enforce `path.join()` rule from day one; test with space-in-username path |
| Phase 3: PDF-to-image | pdfjs-dist worker not configured → silent main-thread fallback | Spike worker setup before UI work; check console for "Setting up fake worker" |
| Phase 3: PDF-to-image | DPI scale misunderstanding → blurry output or OOM crash | Use DPI presets; calculate memory budget per page; process pages sequentially |
| Phase 3: Review workflow | Browser Clipboard API unreliable for large images | Use Electron native `clipboard` module via IPC |
| Phase 4: Packaging | Dev dependencies bloating installer | Verify `npm ci --production` in CI; check installer size against 120MB threshold |
| Phase 4: Auto-update | Windows SmartScreen blocks unsigned installer updates | Procure code signing certificate; test update flow in VM before release |
| Phase 4: Auto-update | `latest.yml` not published → updater finds nothing | Verify file exists in release assets; use `releaseType: release` not `draft` |

---

## Sources

**Confidence note:** WebSearch and WebFetch tools were unavailable in this research session. All findings are based on:
- Electron documentation knowledge (HIGH confidence — well-established, stable APIs)
- pdf-lib GitHub documentation and known limitations (MEDIUM-HIGH confidence)
- pdfjs-dist integration patterns for Electron (MEDIUM confidence — verify worker setup against current pdfjs-dist docs)
- electron-builder/electron-updater documentation (HIGH confidence — signing and publish config)
- Windows-specific packaging behavior (HIGH confidence — well-documented)

**Recommended verification before Phase 4:**
- Verify current pdfjs-dist Electron worker setup against: https://mozilla.github.io/pdf.js/
- Verify electron-updater GitHub provider config against: https://www.electron.build/configuration/publish
- Verify code signing requirements against: https://www.electronjs.org/docs/latest/tutorial/code-signing

**Flagged for phase-specific research (deeper investigation needed):**
- pdfjs-dist + electron-vite worker bundling (exact Vite config for `?url` worker import) — LOW confidence on exact syntax, verify during Phase 3
- Current Electron default for `sandbox` in latest version (was changed to `true` by default in Electron 20+) — verify in Phase 1
- pdf-lib `ParseSpeeds` API availability in latest version — verify during Phase 2
