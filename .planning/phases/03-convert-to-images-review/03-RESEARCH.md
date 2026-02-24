# Phase 3: Convert to Images + Review - Research

**Researched:** 2026-02-23
**Domain:** PDF rendering (pdfjs-dist), image output (canvas.toDataURL), clipboard (Electron nativeImage), review UI (Svelte 5)
**Confidence:** HIGH (architecture), MEDIUM (pdfjs-dist worker config — known rough edge)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**UI layout**
- Make sure UI is consistent with other features in terms of component sizing, padding, margins, spacing, etc.

**Format selector**
- Segmented button / toggle group (PNG | JPEG) — consistent with Phase 2 toggle pattern (e.g. parts/max-pages)
- One-liner beneath each option: PNG: lossless, larger files | JPEG: compressed, smaller

**DPI selector**
- Four presets: 72 / 96 / 150 / 300
- Each preset shows a hint for its typical use (72: screen | 96: web | 150: general | 300: print)
- Default: 96 DPI
- Selector style: Claude's discretion (pick what fits the hints layout best)

**Conversion progress**
- Inline spinner progress indicator within Convert mode — non-blocking, same pattern as other modes
- Progress label shows "Page N of M" updating in real time
- Does NOT block the main UI thread (Worker Thread, same as Extract/Split/Merge)

**Results summary (post-conversion)**
- Same summary pattern as other modes: "X files created in [folder]" + filename list
- No extras (no total file size)
- Show button to open output folder in system file explorer
- "Start Review" button shown alongside the summary

**Review workflow layout**
- Replaces the main body content area (in-window, not a new Electron window)
- Nav rail remains visible during review
- One image at a time — no thumbnail strip
- Image sizing/fit: Claude's discretion (fit to content area, preserve aspect ratio)

**Image preview metadata**
- Position indicator only ("1 / 12") — no filename, no file size

**Image source during review**
- Load from disk (show the saved output files, not re-rendered from PDF)

**Copy-and-Next behavior**
- "Copy and Next" copies current image to clipboard, advances to next
- Visual feedback: brief flash/highlight on the image to confirm copy, then advances
- Keyboard shortcuts: Space / Enter for Copy and Next

**Back navigation**
- Back button navigates to previous image without copying to clipboard
- Back is for reviewing/re-examining only; user must press Copy and Next to copy

**End-of-review flow**
- After last image: show a completion screen
- Completion screen content: position count + close button only
- Closing completion screen returns the user to the Convert mode form

**Convert → Review transition**
- After conversion, show the results summary with a "Start Review" button
- Review is re-enterable: "Start Review" stays available until a new conversion runs
- Starting review replaces the main body with the review workflow
- Ending or aborting review returns to the Convert mode form (with results summary if conversion has run)

### Claude's Discretion
- DPI selector visual style (horizontal segmented vs. vertical radio — pick what fits the hints)
- Image scaling/fit algorithm in review
- Loading skeleton or placeholder while images load from disk
- Error state if an output image file is missing when review starts

### Deferred Ideas (OUT OF SCOPE)
- Configurable default DPI via app settings — Phase 4 (per-mode last-used values persistence)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | User can select output image format (PNG or JPEG) with a clear explanation of the difference shown in the UI | Segmented toggle pattern from SplitMode; canvas.toDataURL('image/png') vs 'image/jpeg' |
| CONV-02 | User can set the output DPI/resolution before conversion | DPI presets → scale = DPI / 72 → page.getViewport({ scale }) |
| CONV-03 | User can execute conversion to receive one image file per PDF page in the output subfolder | pdfjs renderer → canvas → toDataURL → IPC to main → fs.writeFile per page |
| REVW-01 | After image conversion completes, user can enter the review workflow | State machine: 'form' | 'reviewing' | 'complete' driven by Svelte $state |
| REVW-02 | In review mode, the current image is displayed with the user's position shown ("3 / 12") | img src from disk via output file list; position counter $state |
| REVW-03 | User can click "Copy and Next" to copy the current image to the clipboard and advance | IPC: renderer sends file path → main reads file → nativeImage.createFromBuffer → clipboard.writeImage |
| REVW-04 | User can go back one image at a time in review mode | currentIndex-- with floor clamp at 0; no copy on back |
| REVW-05 | Review workflow ends naturally when the last image has been reached | After copying last image, transition to completion screen |
</phase_requirements>

---

## Summary

Phase 3 has two distinct technical domains: (1) PDF-to-image conversion, and (2) an in-window review workflow. The conversion pipeline uses pdfjs-dist in the renderer process to render each PDF page onto an HTML canvas, then saves the image via IPC to the main process. The review workflow is pure Svelte UI state machine — no new IPC patterns needed beyond clipboard writing.

The single highest-risk item is pdfjs-dist worker configuration with electron-vite. The `?url` import or `new URL(..., import.meta.url)` pattern is the standard Vite approach, but there is documented friction with pdfjs-dist v4+ in Vite builds. The recommended mitigation is a **spike task**: install pdfjs-dist, attempt both worker config approaches, verify rendering in dev and production build before writing the full ConvertMode implementation.

Critically, pdfjs-dist rendering MUST run in the renderer process (browser canvas), not in a Node.js Worker Thread. The canvas API is not available in Node.js without native modules (e.g., `node-canvas`), and a 2024 GitHub issue (#19047) confirmed pdfjs-dist has a bug with its Node.js canvas factory in electron-vite context. This aligns with the existing architectural decision documented in MEMORY.md.

**Primary recommendation:** Spike pdfjs-dist worker config in the renderer first, then implement conversion via renderer canvas + IPC file write. Use established Phase 2 patterns for Worker Thread (progress reporting), IPC, and OperationLayout throughout.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfjs-dist | ^5.4.624 (latest) | Render PDF pages to canvas in renderer | Only pure-JS PDF renderer; works in browser context without native deps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Electron clipboard | built-in (Electron 34) | Write image to system clipboard | REVW-03 — expose via preload contextBridge |
| Electron nativeImage | built-in (Electron 34) | Convert Buffer/DataURL to NativeImage for clipboard | Required by clipboard.writeImage |
| HTML Canvas API | browser built-in | Render PDF page, export to PNG/JPEG | Already available in renderer; no install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfjs-dist in renderer | node-canvas in Worker Thread | node-canvas requires native binary — violates no-native-deps constraint |
| pdfjs-dist in renderer | Puppeteer/headless Chrome | Massive dependency, violates project principles |
| canvas.toDataURL → IPC → writeFile | Worker Thread rendering | Worker Threads cannot use browser canvas API; renderer is mandatory |

**Installation:**
```bash
npm install pdfjs-dist
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main/
│   ├── index.ts                    # Add pdf:convert IPC handler + clipboard:write-image handler
│   └── workers/
│       └── pdf-worker.ts           # Add 'convert' operation (file I/O only — NOT rendering)
├── preload/
│   └── index.ts                    # Add convertPdf() and copyImageToClipboard() API methods
└── renderer/src/lib/
    ├── components/
    │   ├── modes/
    │   │   └── ConvertMode.svelte   # Full convert + review UI (state machine in one component)
    │   └── ReviewWorkflow.svelte    # Optional sub-component for review view (or inline in ConvertMode)
    └── utils/
        └── pdf-renderer.ts         # pdfjs-dist setup + renderPageToDataUrl() helper
```

### Pattern 1: PDF Rendering in Renderer Process

**What:** Use pdfjs-dist in the renderer process (browser canvas) to render each PDF page to a data URL, then send the data to the main process for file writing.

**When to use:** Always for this phase — rendering in renderer is mandatory (no browser canvas in Node.js).

**The rendering pipeline:**

```typescript
// src/renderer/src/lib/utils/pdf-renderer.ts
// Source: pdfjs-dist official examples + Discussion #19520

import * as pdfjsLib from 'pdfjs-dist'

// Worker config: use new URL() with import.meta.url — Vite resolves this correctly
// This is the approach that works in electron-vite renderer (verified in Discussion #19520)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// DPI scale: PDF uses 72 DPI internally; scale = targetDPI / 72
// e.g., 96 DPI → scale = 96/72 = 1.333; 300 DPI → scale = 300/72 = 4.167
export async function renderPageToDataUrl(
  pdfBytes: Uint8Array,
  pageNumber: number,  // 1-indexed
  dpi: number,
  format: 'png' | 'jpeg'
): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise
  const page = await pdf.getPage(pageNumber)

  const scale = dpi / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined
  return canvas.toDataURL(mimeType, quality)
}
```

### Pattern 2: Progress Reporting for Multi-Page Conversion

**What:** The conversion loop runs in the renderer (pdfjs requires browser context), but progress "Page N of M" is driven by $state updates in ConvertMode — NOT via Worker Thread IPC.

**Important distinction from Phase 2:** Phase 2 worker progress goes `worker → main → renderer` via IPC. Phase 3 conversion runs directly in the renderer, so progress updates are synchronous Svelte $state mutations between pages. The main process Worker Thread is only used for **file I/O** (writing image files to disk) after rendering.

**Two valid architectures:**

**Option A (simpler — recommended):** Render entirely in renderer, send data URLs to main via IPC for writing. No Worker Thread for convert.

```typescript
// In ConvertMode.svelte
for (let i = 1; i <= totalPages; i++) {
  progressCurrent = i  // drives "Page N of M" live update
  const dataUrl = await renderPageToDataUrl(pdfBytes, i, dpi, format)
  await window.api.writeImageFile({ dataUrl, outputFolder, fileName: `page-${i}.png` })
}
```

**Option B (matches Phase 2 pattern):** Worker Thread handles file I/O; renderer sends rendered data URLs to main via IPC one at a time. More complex but keeps file writes off renderer.

**Recommendation:** Option A for simplicity. The rendering loop naturally yields between pages. File writes are fast (negligible block time per image). No new Worker Thread needed.

### Pattern 3: Clipboard Writing via preload contextBridge

**What:** `clipboard` module is available in main and preload. The official Electron docs state "Using the clipboard API from the renderer process is deprecated" — it MUST be exposed via contextBridge in preload.

**Source:** [Electron clipboard docs](https://www.electronjs.org/docs/latest/api/clipboard)

```typescript
// In preload/index.ts — add to api object:
copyImageToClipboard: async (filePath: string): Promise<void> =>
  ipcRenderer.invoke('clipboard:write-image', filePath),

// In main/index.ts — add ipcMain handler:
ipcMain.handle('clipboard:write-image', async (_event, filePath: string) => {
  const { clipboard, nativeImage } = await import('electron')
  const { readFile } = await import('fs/promises')
  const buffer = await readFile(filePath)
  const image = nativeImage.createFromBuffer(buffer)
  clipboard.writeImage(image)
})
```

**Why readFile + createFromBuffer (not createFromDataURL):** Review loads images from disk (CONTEXT.md decision: "Load from disk"). Reading the saved file is simpler and avoids re-encoding. createFromBuffer works for both PNG and JPEG files.

### Pattern 4: Review Workflow State Machine

**What:** ConvertMode.svelte manages a local state machine for the three views: form, reviewing, complete.

```typescript
// In ConvertMode.svelte
type ReviewState = 'form' | 'reviewing' | 'complete'

let reviewState = $state<ReviewState>('form')
let currentIndex = $state(0)  // 0-indexed
let outputFiles = $state<string[]>([])
let outputFolder = $state<string>('')

// currentImagePath derived from outputFiles + outputFolder
$derived currentImagePath = outputFiles.length > 0
  ? `${outputFolder}/${outputFiles[currentIndex]}`
  : ''
```

**Review navigation:**
```typescript
function copyAndNext() {
  // 1. Trigger flash animation ($state flash = true, reset after 200ms)
  // 2. Copy current image via IPC
  // 3. If last image → reviewState = 'complete'; else currentIndex++
  flash = true
  setTimeout(() => { flash = false }, 200)
  window.api.copyImageToClipboard(currentImagePath)
  if (currentIndex >= outputFiles.length - 1) {
    reviewState = 'complete'
  } else {
    currentIndex++
  }
}

function goBack() {
  if (currentIndex > 0) currentIndex--
}
```

### Pattern 5: Keyboard Shortcuts in Review

**What:** Attach `onkeydown` to the review container div with `tabindex="0"` + `autofocus` so it captures Space/Enter.

```svelte
<!-- Svelte 5 event syntax -->
<div
  class="review-container"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()  // prevents page scroll / form submit
      copyAndNext()
    }
  }}
>
```

**Alternative:** `svelte:window` onkeydown — simpler, always captures regardless of focus. Preferred for this review workflow since the whole window is the review context.

```svelte
<svelte:window onkeydown={(e) => {
  if (reviewState === 'reviewing' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    copyAndNext()
  }
}} />
```

### Anti-Patterns to Avoid

- **Running pdfjs-dist in Node.js Worker Thread:** Canvas API unavailable; known bug #19047 in electron-vite context. Always render in renderer.
- **Using `clipboard` directly in renderer component:** Deprecated in Electron. Must go through preload + IPC.
- **Blocking the renderer with synchronous rendering:** `page.render().promise` is async — always await in a for-loop, not Promise.all (which would open all pages simultaneously and consume huge memory on large PDFs).
- **Passing large data URLs through IPC for clipboard:** For clipboard operations in review, pass the file path to main — main reads the file. Avoids IPC message size issues on large images (300 DPI images can be 10+ MB).
- **`?url` import for pdfjs worker in electron-vite production:** The `?url` import sometimes fails in Electron production builds where the file:// path is computed differently. The `new URL(..., import.meta.url)` approach is more reliable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF page rendering | Custom canvas drawing | pdfjs-dist getPage + render | PDF rendering is deeply complex (fonts, transforms, transparency, color spaces) |
| PDF DPI calculation | Custom DPI math | scale = dpi / 72 (one line) | PDF units are 1/72 inch; getViewport handles the rest |
| Image format encoding | Manual PNG/JPEG bytes | canvas.toDataURL('image/png' / 'image/jpeg') | Browser's native encoder; no extra deps |
| Clipboard image write | Electron clipboard reimplementation | nativeImage.createFromBuffer + clipboard.writeImage | OS-level clipboard handling already solved |

**Key insight:** The heavy work (PDF parsing, font loading, page rendering) is entirely handled by pdfjs-dist. The implementation is mostly wiring: renderer renders → sends data URL to main → main writes file.

---

## Common Pitfalls

### Pitfall 1: pdfjs-dist Worker Not Found in Production Build

**What goes wrong:** In development (Vite dev server), pdfjs-dist worker loads fine. After `npm run build`, the renderer can't find the worker file. App shows "Setting up fake worker" warning and rendering is slow or broken.

**Why it happens:** Vite's module bundler doesn't automatically copy the pdfjs worker file to the output. The `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` pattern tells Vite to bundle/copy the worker, but electron-vite's production build may not always resolve this correctly for the renderer.

**How to avoid:**
1. First attempt: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` — this is the standard Vite pattern and usually works.
2. If production build fails: copy the worker to `src/renderer/public/` as a static asset, set `workerSrc = '/pdf.worker.min.mjs'`. This is 100% reliable but requires the static copy.
3. Include a **spike task** to verify worker loads in BOTH dev and production build before the full implementation task.

**Warning signs:** Console warning "Setting up fake worker" or "GlobalWorkerOptions.workerSrc not set".

### Pitfall 2: Rendering in Worker Thread Instead of Renderer

**What goes wrong:** Developer follows Phase 2 pattern and puts rendering logic in pdf-worker.ts. Node.js environment has no `document.createElement('canvas')` — runtime crash.

**Why it happens:** Phase 2 work (pdf-lib) runs fine in Worker Threads. pdfjs-dist rendering does NOT — it requires browser canvas.

**How to avoid:** Rendering loop must live in ConvertMode.svelte (renderer), not in pdf-worker.ts. The Worker Thread is only appropriate for file I/O after rendering.

**Warning signs:** Error "document is not defined" or "HTMLCanvasElement is not defined" in worker.

### Pitfall 3: IPC Message Size Limits for Data URLs

**What goes wrong:** 300 DPI, A4 page → ~4168×5906 pixels → ~70 MB uncompressed canvas. PNG data URL can be 5-15 MB. Sending many such data URLs over IPC causes high memory pressure.

**Why it happens:** IPC serializes messages as JSON. Large buffers are expensive.

**How to avoid:**
- Send one page at a time (for loop, not Promise.all)
- For clipboard (REVW-03): send the file PATH to main, have main read the file. Do NOT re-send the data URL for clipboard — the file is already on disk.
- For file writing: data URL → main → writeFile is acceptable since it's sequential per page.

### Pitfall 4: `clipboard` API Called from Renderer Component Directly

**What goes wrong:** `window.electron.clipboard.writeImage(...)` called from Svelte component. Electron logs deprecation warning; may fail in future versions.

**Why it happens:** The `electronAPI` object from `@electron-toolkit/preload` exposes some APIs but clipboard is deprecated in renderer context.

**How to avoid:** Add `copyImageToClipboard(filePath)` to the `api` object in `preload/index.ts`, exposed via `contextBridge`. Add the `ipcMain.handle('clipboard:write-image')` handler in `main/index.ts`.

### Pitfall 5: Keyboard Events Not Firing in Review Mode

**What goes wrong:** Space/Enter keys don't trigger Copy and Next.

**Why it happens:** The review div doesn't have keyboard focus. Browsers only deliver keydown to focused elements (or document/window).

**How to avoid:** Use `<svelte:window onkeydown={...}>` guarded by `reviewState === 'reviewing'`. This is the safest approach — no focus management needed.

### Pitfall 6: pdfjs-dist v5 and Promise.withResolvers in Node < 22

**What goes wrong:** pdfjs-dist v5 uses `Promise.withResolvers` internally. This API requires Node.js ≥ 22.

**Why it happens:** The Node version constraint changed at pdfjs v5.

**How to avoid:** Check Node version with `node --version`. Electron 34 ships with Node 20.x internally, but the renderer process uses Chromium's V8 (not Node). Since rendering happens in the renderer, this is NOT an issue for Phase 3. However, if anyone attempts to use pdfjs-dist v5 in a Node Worker Thread (don't do this), it would fail on Node 20.

**Confidence:** LOW — needs verification after install. pdfjs v4 (^4.x) would avoid this issue entirely if it proves to be a problem.

---

## Code Examples

Verified patterns from official sources:

### DPI Scale Calculation

```typescript
// Source: PDF.js official examples (mozilla.github.io/pdf.js/examples)
// PDF internal units = 1/72 inch
// getViewport({scale: 1}) → 72 DPI output
// To get N DPI: scale = N / 72

const DPI_TO_SCALE: Record<number, number> = {
  72:  72  / 72,  // 1.000
  96:  96  / 72,  // 1.333
  150: 150 / 72,  // 2.083
  300: 300 / 72,  // 4.167
}

const scale = dpi / 72
const viewport = page.getViewport({ scale })
canvas.width  = Math.floor(viewport.width)
canvas.height = Math.floor(viewport.height)
```

### Full Page Render to Data URL

```typescript
// Source: pdfjs-dist official examples + verified render API (deepwiki.com/mozilla/pdfjs-dist/4.1-canvas-rendering)
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

async function renderPage(filePath: string, pageNum: number, dpi: number, format: 'png' | 'jpeg'): Promise<string> {
  // Read file via IPC (file path already in appState.currentFile.filePath)
  const bytes = await window.api.readFileBytes(filePath)  // new IPC method needed
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const page = await pdf.getPage(pageNum)

  const scale = dpi / 72
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width  = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  return canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined)
}
```

### Clipboard Write from Main Process

```typescript
// Source: Electron official docs (electronjs.org/docs/latest/api/clipboard)
// In main/index.ts
import { clipboard, nativeImage } from 'electron'
import { readFile } from 'fs/promises'

ipcMain.handle('clipboard:write-image', async (_event, filePath: string) => {
  const buffer = await readFile(filePath)
  const image = nativeImage.createFromBuffer(buffer)
  clipboard.writeImage(image)
})
```

### Image Display in Review (loading from disk)

```svelte
<!-- Load image from disk via file:// protocol in Electron renderer -->
<!-- Electron renderer can load local files directly via img src using file:// -->
<img
  src="file://{currentImagePath}"
  alt="Page {currentIndex + 1}"
  class="review-image"
  class:flash={isFlashing}
/>

<style>
  .review-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;   /* preserve aspect ratio */
    display: block;
    margin: auto;
  }

  .flash {
    animation: flash-anim 0.2s ease-out;
  }

  @keyframes flash-anim {
    0%   { opacity: 1; }
    50%  { opacity: 0.4; }
    100% { opacity: 1; }
  }
</style>
```

### File Output Naming Convention

```typescript
// One image per page, zero-padded like split parts
// pageCount determines pad width: <=9 → 1 digit, <=99 → 2 digits, <=999 → 3 digits
const padWidth = totalPages > 99 ? 3 : totalPages > 9 ? 2 : 1
const fileName = `page-${String(pageNum).padStart(padWidth, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`
```

---

## IPC Surface Changes

Phase 3 adds the following new IPC methods (preload + main):

| Direction | Channel | Purpose |
|-----------|---------|---------|
| renderer → main | `file:read-bytes` | Read PDF bytes in main, return Uint8Array to renderer for pdfjs |
| renderer → main | `pdf:write-image` | Write rendered data URL as image file to outputFolder |
| renderer → main | `clipboard:write-image` | Read saved image file, write to clipboard via nativeImage |

**Note on file:read-bytes:** pdfjs-dist `getDocument()` needs the PDF file bytes. The file path is already known (`appState.currentFile.filePath`). A new `readFileBytes(filePath)` IPC call in main reads it with `fs.readFile` and returns the buffer. This is the cleanest approach (renderer has no direct file system access without `nodeIntegration: true`).

**Alternative:** Re-use the existing file path known from Phase 1/2. The renderer already called `getFileInfo` during file load; the `filePath` is in `appState.currentFile.filePath`. Only the bytes read is new.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `File.path` in Electron renderer | `webUtils.getPathForFile` | Electron 32 | Already handled in Phase 1/2 |
| pdfjs-dist CommonJS require | ES Module `import * as pdfjsLib from 'pdfjs-dist'` | pdfjs v4+ | Vite-native, works with import.meta.url |
| `clipboard` in renderer directly | Expose via preload contextBridge | Electron v20+ (deprecated) | Must go through IPC |
| `?url` worker import | `new URL(..., import.meta.url)` | Vite 3+ | More reliable in production builds |

**Deprecated/outdated:**
- `PDFJS.workerSrc = '../path/to/worker'` (string path): Only worked with old CommonJS pdfjs builds. Use `new URL(...)` instead.
- `clipboard` directly in renderer code: Deprecated in Electron; use preload + IPC.

---

## Open Questions

1. **pdfjs-dist worker config in production build**
   - What we know: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` is the standard Vite pattern and confirmed working in Discussion #19520 for pdfjs v4+
   - What's unclear: Whether electron-vite's production renderer bundle correctly resolves this vs. dev server; whether v5 has breaking changes vs v4 on this point
   - Recommendation: Make the very first task in Phase 3 a spike — install pdfjs-dist, write a minimal test render, verify in both `npm run dev` AND `npm run build:win` (or build:unpack). If it fails, fall back to copying worker to `src/renderer/public/`.

2. **pdfjs-dist v4 vs v5**
   - What we know: Latest is v5.4.624. v5 uses Promise.withResolvers (Node ≥ 22 requirement for Node context). Renderer context uses Chromium V8, not Node, so this shouldn't affect rendering.
   - What's unclear: Whether v5 introduces any electron-vite-specific regressions vs v4
   - Recommendation: Install v5 (latest) but have v4 as a fallback. Pin in package.json: `"pdfjs-dist": "^5.4.624"`. If v5 causes issues, downgrade to `"^4.10.0"`.

3. **`file://` protocol for img src in Electron**
   - What we know: Electron renderer can load local files with `file://` protocol in `<img src>`. The output folder path is an absolute Windows path (e.g., `C:\Users\...\Documents\PDF Chisel\...`).
   - What's unclear: Whether Windows path separators need to be converted to forward slashes for `file://` URLs (Windows paths use `\`).
   - Recommendation: Use `file://` + path with forward slashes: `src="file://${currentImagePath.replace(/\\/g, '/')}"`. Alternatively, expose a `pathToFileURL` IPC utility.

---

## Sources

### Primary (HIGH confidence)
- [Electron clipboard docs](https://www.electronjs.org/docs/latest/api/clipboard) — writeImage signature, preload requirement, deprecated in renderer
- [Electron nativeImage docs](https://www.electronjs.org/docs/latest/api/native-image) — createFromBuffer, createFromDataURL, PNG/JPEG support
- [PDF.js official examples](https://mozilla.github.io/pdf.js/examples/) — getViewport, render API, canvas setup
- [DeepWiki canvas rendering docs](https://deepwiki.com/mozilla/pdfjs-dist/4.1-canvas-rendering) — render() parameters, RenderTask.promise

### Secondary (MEDIUM confidence)
- [PDF.js Discussion #19520](https://github.com/mozilla/pdf.js/discussions/19520) — confirmed `new URL(..., import.meta.url)` pattern for pdfjs v4+ with Vite; multiple contributors verified
- [pdf.js Issue #19047](https://github.com/mozilla/pdf.js/issues/19047) — confirmed pdfjs Node canvas factory broken in electron-vite; rendering MUST be in renderer
- [Vite + pdfjs Erin Doyle blog](https://erindoyle.dev/using-pdfjs-with-vite/) — Vite-specific worker config patterns (content partially inaccessible but confirmed URL pattern)

### Tertiary (LOW confidence)
- Various GitHub issues and community discussions on `?url` vs `new URL` — general pattern confirmed but electron-vite production specifics unverified without running the actual build

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pdfjs-dist is the only viable pure-JS PDF renderer; clipboard API is official Electron
- Architecture: HIGH — renderer-side rendering is architecturally mandated (no canvas in Node); IPC patterns follow established Phase 2 conventions
- Pitfalls: MEDIUM-HIGH — worker config pitfall is well-documented; spike task is the mitigation
- pdfjs worker in electron-vite production: MEDIUM — pattern is verified in Vite generally; electron-vite production specifics need the spike

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (pdfjs stable; Electron 34 stable; patterns won't change significantly)
