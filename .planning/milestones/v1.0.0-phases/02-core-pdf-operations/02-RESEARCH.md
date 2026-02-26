# Phase 2: Core PDF Operations - Research

**Researched:** 2026-02-22
**Domain:** pdf-lib page manipulation, Node.js Worker Threads in Electron, Svelte 5 drag-to-reorder, IPC progress reporting, filesystem output
**Confidence:** HIGH

## Summary

Phase 2 is a well-bounded implementation of three PDF operations (Extract, Split, Merge) using libraries that are already in the project (`pdf-lib` is already a dependency). All three operations share the same architectural pattern: a Worker Thread in main spawns, does the pdf-lib work on `Uint8Array` data, writes output files to a timestamped subfolder, and reports completion (or error) back to the renderer via IPC. No new major libraries are required.

The most significant new complexity in this phase is the Worker Thread plumbing and the IPC channel design for progress reporting. The `?nodeWorker` / `?modulePath` import suffix in electron-vite makes worker bundling trivial — no manual rollup entry changes are needed. The second notable challenge is the Merge mode file list with drag-to-reorder, which is best solved with native HTML5 drag events on a small list (only a handful of files expected), making a third-party sortable library unnecessary.

The IPC data flow is: renderer calls `ipcRenderer.invoke('pdf:operation', args)` → main spawns Worker Thread with `workerData` containing file paths and parameters → worker does all pdf-lib I/O → worker `postMessage`s progress/completion → main forwards progress via `webContents.send('pdf:progress', ...)` → main resolves the original invoke promise with the final result. This is the established Electron pattern for long-running work.

**Primary recommendation:** Keep the stack minimal. No new npm libraries are needed for PDF processing, progress reporting, or drag-to-reorder. Implement drag-to-reorder with native Svelte 5 + HTML5 drag events. Worker Threads in main process use `?nodeWorker` import syntax from electron-vite.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page range UX (Extract mode)**
- Validate on blur (when input loses focus), not live while typing
- Out-of-range page numbers are clamped silently — extract what exists, ignore numbers beyond the PDF's page count
- Empty input extracts the whole PDF (treat empty as "all pages")
- Placeholder is a generic hint like "e.g. 1-5, 8, 12-15" — no page count displayed in the field

**Progress indicator**
- Prefer an indeterminate spinner. In later phases, we may replace this with a custom gif or animation.
- Consider optionally implementing a determinate progress bar if the Worker Thread can provide progress updates, but fallback to indeterminate if not reasonable.

**Results summary (after successful operation)**
- Show a list of output filenames
- Show an "Open folder" button to reveal the timestamped output subfolder in Windows Explorer
- "Open folder" button applies to every operation: Extract, Split, and Merge

**Post-completion UI state**
- A persistent Reset button is always visible in every mode — clears all inputs to defaults at any time
- Summary panel clears when the user starts a new operation
- Results area (success or error) clears when the user switches modes

**Error display**
- Errors display inline in the results area (replacing the progress bar), not in a toast or modal
- Errors stay visible until the user resets, switches modes, or starts a new operation
- Error messages include both the cause and a suggested fix (e.g. "Failed to write output: permission denied. Try saving to a different folder.")

**Button state during processing**
- Action button (Extract / Split / Merge) is disabled while processing. No spinner on the button itself — the progress bar communicates state
- Mode switch buttons are disabled during processing to prevent mid-operation mode changes

**UI Consistency**
- The UI layout and controls remain consistent across all three modes. Only the specific inputs and labels change.
- Prefer shared styling and components across modes.

**Cancellation**
- No cancel button — operations run to completion (or fail)

### Claude's Discretion
- Typography and spacing of the results summary
- Exact wording of success/error messages (follow the cause + fix pattern)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXTR-01 | User can specify pages to extract using text range syntax (e.g. "1-5, 8, 12-15") | Page range parser → validated on blur; empty = all pages; clamped to actual page count |
| EXTR-02 | User can execute extraction to receive a single new PDF containing only the selected pages | `PDFDocument.copyPages(srcDoc, indices)` + `addPage()` + write to output subfolder |
| SPLT-01 | User can split a PDF by specifying a desired number of output parts (pages divided evenly) | Divide total pages by N parts; ceil division for even distribution |
| SPLT-02 | User can split a PDF by specifying a maximum number of pages per output file | Chunk page array into segments of maxPages each |
| SPLT-03 | User can execute a split to receive multiple PDFs in the output subfolder | Loop → create new PDFDocument per chunk → copyPages → save → writeFile |
| MERG-01 | User can select multiple PDF files to merge | `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })` + drag-drop list |
| MERG-02 | User can reorder selected PDFs via drag-and-drop to set the merge order | Native HTML5 drag events on ordered list; array swap on drop |
| MERG-03 | User can execute merge to receive a single combined PDF in the output subfolder | Loop file paths in order → `copyPages(pdf, pdf.getPageIndices())` → `addPage()` → save |
| OUTP-01 | Each execution produces output in a `{timestamp}-{mode}` subfolder within the chosen destination folder | `new Date().toISOString().replace(/[:.]/g, '-')` + mode slug → `fs.mkdir(path, { recursive: true })` |
| OUTP-02 | The output destination path persists across uses and sessions | Phase 2: use `app.getPath('documents')` as default; full persistence deferred to Phase 4 (electron-store) |
| OUTP-03 | After execution, user sees a success summary listing what was created (file names, count) | Worker resolves with `{ outputFiles: string[], outputFolder: string }` |
| OUTP-04 | App opens the output folder automatically after execution (if auto-open setting is enabled) | `shell.openPath(folderPath)` from main; auto-open toggle deferred to Phase 4 — default ON for now |
| UX-01 | App shows a progress indicator during PDF processing operations | Indeterminate CSS spinner while `isProcessing` state is true |
| UX-02 | App shows clear, human-readable error messages when operations fail | Classify error type in worker (EncryptedPDFError, parse error, write error) and return `{ error: { cause, fix } }` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | ^1.17.1 (already installed) | PDF creation, copying pages, merging, splitting | Already in project; pure JS, no native deps; proven in Phase 1 |
| node:worker_threads | Node built-in | CPU-intensive PDF work off the main thread | Established pattern for Electron; pdf-lib is CPU-bound |
| node:fs/promises | Node built-in | Write output files, create output directories | Standard async FS API |
| node:path | Node built-in | Path construction for output folders | Standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron shell | Electron built-in | `shell.openPath(folder)` to reveal output folder in Explorer | After every successful operation |
| electron dialog | Electron built-in | `dialog.showOpenDialog` with `multiSelections` for Merge file picker | Merge mode multi-file input |

### No New Libraries Needed
The following commonly-suggested libraries are NOT needed for Phase 2:

| Temptation | Why to Skip |
|------------|-------------|
| `svelte-sortable-list` / `svelte-dnd-action` | Overkill for a simple 2-10 item list; native HTML5 drag events suffice in Svelte 5 |
| `pdf-merger-js` | Just wraps pdf-lib; we already have pdf-lib directly |
| `threads.js` | Wrapper over worker_threads; adds complexity with no benefit for this use case |
| `fs-extra` | `fs/promises` with `recursive: true` covers all needed cases |

**Installation:** No new packages needed. All libraries are either already installed or Node/Electron built-ins.

---

## Architecture Patterns

### Recommended Project Structure

The Phase 2 additions slot into the existing structure:

```
src/
├── main/
│   ├── index.ts              # existing — add new ipcMain.handle calls here
│   └── workers/
│       └── pdf-worker.ts     # NEW — Worker Thread; all pdf-lib operations
├── preload/
│   ├── index.ts              # existing — add new api methods
│   └── index.d.ts            # existing — add new method type declarations
└── renderer/src/lib/
    ├── components/
    │   ├── modes/
    │   │   ├── ExtractMode.svelte   # existing stub — fully implement
    │   │   ├── SplitMode.svelte     # existing stub — fully implement
    │   │   └── MergeMode.svelte     # existing stub — fully implement
    │   ├── OperationLayout.svelte   # NEW — shared layout wrapper (input, action, progress, results)
    │   ├── ProgressSpinner.svelte   # NEW — indeterminate spinner component
    │   └── ResultsSummary.svelte    # NEW — success/error display, Open Folder button, Reset button
    ├── stores/
    │   └── app.svelte.ts     # existing — may extend for processing state
    └── utils/
        └── page-range.ts     # NEW — page range parser ("1-5, 8, 12-15" → [0,1,2,3,4,7,11,12,13,14])
```

### Pattern 1: Worker Thread with Progress Reporting

The complete IPC/Worker data flow for a PDF operation:

```typescript
// src/main/index.ts — ipcMain handler
import createPdfWorker from './workers/pdf-worker?nodeWorker'

ipcMain.handle('pdf:extract', async (event, args: ExtractArgs) => {
  return new Promise((resolve, reject) => {
    const worker = createPdfWorker({ workerData: args })

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        // Forward progress to renderer (for optional determinate bar)
        event.sender.send('pdf:progress', msg)
      } else if (msg.type === 'complete') {
        resolve(msg.result)
      } else if (msg.type === 'error') {
        resolve({ error: msg.error }) // structured error, not thrown
      }
    })

    worker.on('error', (err) => {
      resolve({ error: { cause: err.message, fix: 'Try a different PDF file.' } })
    })

    worker.on('exit', (code) => {
      if (code !== 0) resolve({ error: { cause: `Worker exited with code ${code}`, fix: 'Restart the app.' } })
    })
  })
})
```

```typescript
// src/main/workers/pdf-worker.ts
import { workerData, parentPort } from 'node:worker_threads'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'

async function run() {
  const { operation, filePath, outputFolder, params } = workerData

  try {
    const bytes = await readFile(filePath)
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })

    // ... operation-specific logic ...

    parentPort!.postMessage({ type: 'progress', percent: 50 })

    // Write output
    await mkdir(outputFolder, { recursive: true })
    // ... write files ...

    parentPort!.postMessage({ type: 'complete', result: { outputFiles, outputFolder } })
  } catch (err) {
    const errorInfo = classifyError(err)
    parentPort!.postMessage({ type: 'error', error: errorInfo })
  }
}

run()
```

```typescript
// src/preload/index.ts — expose new operations
const api = {
  // ... existing methods ...
  extractPages: (args: ExtractArgs): Promise<OperationResult> =>
    ipcRenderer.invoke('pdf:extract', args),
  splitPdf: (args: SplitArgs): Promise<OperationResult> =>
    ipcRenderer.invoke('pdf:split', args),
  mergePdfs: (args: MergeArgs): Promise<OperationResult> =>
    ipcRenderer.invoke('pdf:merge', args),
  openPdfsDialog: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:open-pdfs-multi'),
  openOutputFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke('shell:open-folder', folderPath),
  onProgress: (callback: (data: ProgressData) => void): (() => void) => {
    ipcRenderer.on('pdf:progress', (_event, data) => callback(data))
    // Returns cleanup function
    return () => ipcRenderer.removeAllListeners('pdf:progress')
  },
}
```

### Pattern 2: pdf-lib Page Operations

**Extract pages (range → single output PDF):**
```typescript
// Source: pdf-lib.js.org/docs/api/classes/pdfdocument
async function extract(srcDoc: PDFDocument, pageIndices: number[]): Promise<Uint8Array> {
  const newDoc = await PDFDocument.create()
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices)
  copiedPages.forEach(page => newDoc.addPage(page))
  return newDoc.save()
}
```

**Split by N parts or max pages per part:**
```typescript
function chunkPageIndices(total: number, params: SplitParams): number[][] {
  const indices = Array.from({ length: total }, (_, i) => i)
  const chunkSize = params.mode === 'parts'
    ? Math.ceil(total / params.value)
    : params.value
  const chunks: number[][] = []
  for (let i = 0; i < indices.length; i += chunkSize) {
    chunks.push(indices.slice(i, i + chunkSize))
  }
  return chunks
}

async function splitDoc(srcDoc: PDFDocument, chunks: number[][]): Promise<Uint8Array[]> {
  const outputs: Uint8Array[] = []
  for (const chunk of chunks) {
    const partDoc = await PDFDocument.create()
    const pages = await partDoc.copyPages(srcDoc, chunk)
    pages.forEach(p => partDoc.addPage(p))
    outputs.push(await partDoc.save())
  }
  return outputs
}
```

**Merge multiple PDFs:**
```typescript
// Source: pdf-lib.js.org + github.com/Hopding/pdf-lib Issue #252
async function merge(filePaths: string[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create()
  for (const filePath of filePaths) {
    const bytes = await readFile(filePath)
    const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })
    const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach(page => mergedDoc.addPage(page))
  }
  return mergedDoc.save()
}
```

### Pattern 3: Output Folder Naming

```typescript
// Timestamp format: YYYYMMDD-HHmmss for clean Windows filenames
function makeOutputFolder(baseDir: string, mode: string): string {
  const now = new Date()
  const ts = now.getFullYear().toString()
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
    + '-'
    + String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
  return join(baseDir, `${ts}-${mode}`)
}
// Result: C:\Users\Kell\Documents\PDF Chisel\20260222-143022-extract\
```

### Pattern 4: Error Classification in Worker

pdf-lib throws specific error classes. Classify them for human-readable messages:

```typescript
import { EncryptedPDFError } from 'pdf-lib'

function classifyError(err: unknown): { cause: string; fix: string } {
  if (err instanceof EncryptedPDFError) {
    return {
      cause: 'This PDF is password-protected.',
      fix: 'Remove the password before using PDF Chisel.'
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Failed to parse')) {
    return {
      cause: 'The PDF file appears to be corrupted.',
      fix: 'Try opening the file in a PDF viewer first to verify it is readable.'
    }
  }
  if (msg.includes('EACCES') || msg.includes('EPERM') || msg.includes('permission')) {
    return {
      cause: 'Could not write output files: permission denied.',
      fix: 'Try choosing a different output folder (e.g., your Documents folder).'
    }
  }
  if (msg.includes('ENOSPC')) {
    return {
      cause: 'Not enough disk space to write output files.',
      fix: 'Free up disk space and try again.'
    }
  }
  return {
    cause: `Unexpected error: ${msg}`,
    fix: 'Try again. If the problem persists, restart the app.'
  }
}
```

### Pattern 5: Drag-to-Reorder (Merge Mode, Native HTML5)

No library needed. Use native Svelte 5 drag events on a small ordered list:

```svelte
<!-- MergeMode.svelte snippet -->
<script lang="ts">
  let files = $state<FileItem[]>([])
  let dragIndex = $state<number | null>(null)

  function ondragstart(i: number) {
    dragIndex = i
  }

  function ondragover(e: DragEvent, i: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== i) {
      const reordered = [...files]
      const [moved] = reordered.splice(dragIndex, 1)
      reordered.splice(i, 0, moved)
      files = reordered
      dragIndex = i
    }
  }

  function ondragend() {
    dragIndex = null
  }
</script>

{#each files as file, i (file.id)}
  <div
    draggable="true"
    ondragstart={() => ondragstart(i)}
    ondragover={(e) => ondragover(e, i)}
    ondragend={ondragend}
    class:dragging={dragIndex === i}
  >
    {file.name}
  </div>
{/each}
```

**Note on keyed each:** Use `(file.id)` as key (not `(file)` or index) so Svelte tracks DOM nodes correctly during reorder.

### Pattern 6: Opening Output Folder

Prefer `shell.openPath(folderPath)` which opens the folder itself in Explorer. The alternative `shell.showItemInFolder(folderPath)` opens the parent and selects the folder — less useful when we want the user inside the folder. Note: on Windows 11 22H2, `shell.openPath` may open Explorer behind the app window (known Electron issue #36765), but this is cosmetically acceptable.

```typescript
// main/index.ts
ipcMain.handle('shell:open-folder', async (_event, folderPath: string) => {
  await shell.openPath(folderPath)
})
```

### Pattern 7: Multi-file Dialog for Merge

```typescript
// main/index.ts
ipcMain.handle('dialog:open-pdfs-multi', async (_event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select PDF Files to Merge',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections']
  })
  if (canceled || filePaths.length === 0) return []
  return filePaths
})
```

### Pattern 8: Page Range Parser

```typescript
// src/renderer/src/lib/utils/page-range.ts
// Converts "1-5, 8, 12-15" → [0,1,2,3,4,7,11,12,13,14] (0-indexed, clamped, deduplicated, sorted)
export function parsePageRange(input: string, totalPages: number): number[] {
  if (!input.trim()) {
    // Empty = all pages
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const indices = new Set<number>()
  const segments = input.split(',')
  for (const seg of segments) {
    const trimmed = seg.trim()
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10)
      const end = parseInt(rangeMatch[2], 10)
      for (let p = start; p <= end; p++) {
        const idx = p - 1  // convert 1-based to 0-based
        if (idx >= 0 && idx < totalPages) indices.add(idx)  // silent clamp
      }
    } else {
      const single = parseInt(trimmed, 10)
      if (!isNaN(single)) {
        const idx = single - 1
        if (idx >= 0 && idx < totalPages) indices.add(idx)
      }
    }
  }
  return [...indices].sort((a, b) => a - b)
}
```

### Pattern 9: Shared OperationLayout component

All three modes share the same structural layout. A shared wrapper component avoids duplication:

```svelte
<!-- OperationLayout.svelte -->
<!-- Props: title, onReset, isProcessing -->
<!-- Slots: inputs (mode-specific controls), actions (the Execute button) -->
<!-- Contains: ProgressSpinner (shown when isProcessing), ResultsSummary -->
```

This enforces the locked decision: "UI layout and controls remain consistent across all three modes."

### Anti-Patterns to Avoid

- **Running pdf-lib on the main thread (inside ipcMain.handle directly):** Blocks the entire main process event loop. Always use a Worker Thread.
- **Running pdf-lib in the renderer process:** Renderer has no direct filesystem access for output file writing.
- **Using `ipcRenderer.on` without cleanup in Svelte components:** Will accumulate listeners across hot reloads. Always call `removeAllListeners` or store the cleanup function from `onProgress`.
- **Using `ipcMain.on` instead of `ipcMain.handle`:** `ipcMain.on` accumulates listeners on window recreation; `ipcMain.handle` is idempotent. (Already established in Phase 1.)
- **Writing to same output folder on re-run:** Timestamp per-execution guarantees unique subfolders and prevents overwriting.
- **Storing large PDF buffers in `workerData`:** `workerData` is structured-cloned (copied). Pass file paths, not bytes. Worker reads files itself.
- **Keying `{#each}` with array index during drag reorder:** When dragging reorders the array, Svelte cannot track DOM nodes by index. Always use a stable `id` as key.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF page extraction | Custom byte slicer | `pdf-lib` `copyPages` | PDF internal structure is complex; xref tables, content streams, object graphs |
| Error classification | catch-all string | `instanceof EncryptedPDFError` + message patterns | pdf-lib exports `EncryptedPDFError` class; other errors have stable message patterns |
| Worker bundling | Manual rollup entry | `?nodeWorker` import suffix | electron-vite handles worker isolation automatically |
| Output folder naming | Custom date formatter | `new Date()` with padStart | Simple enough inline; no library justified |

**Key insight:** pdf-lib handles all the structural complexity of PDF byte manipulation. The application code's job is simply to: load → copy specific pages → create new doc → save → write file.

---

## Common Pitfalls

### Pitfall 1: Passing PDF bytes through workerData (performance/memory)
**What goes wrong:** `workerData` is deep-cloned via structured clone. A 50MB PDF passed as `Uint8Array` gets copied entirely in memory.
**Why it happens:** Developers naturally pass "all the data the worker needs" upfront.
**How to avoid:** Pass only the `filePath` string. The Worker Thread reads the file itself from disk using `fs.readFile`.
**Warning signs:** High memory usage; slow startup for large PDFs before any processing begins.

### Pitfall 2: pdf-lib copyPages does not preserve bookmarks/outlines
**What goes wrong:** The merged or extracted PDF loses the table of contents/bookmarks from the original.
**Why it happens:** `copyPages` copies page content but not the document's outline (bookmark tree).
**How to avoid:** This is a known pdf-lib limitation. Document it clearly — it is acceptable for v1 (no requirement mentions bookmark preservation).
**Warning signs:** Users report missing navigation in output files.

### Pitfall 3: IPC listener accumulation with `ipcRenderer.on` for progress
**What goes wrong:** Each time the mode component mounts (hot reload, mode switch), a new `pdf:progress` listener is added. Old listeners fire on future operations.
**Why it happens:** Svelte component unmount doesn't auto-clean ipcRenderer listeners.
**How to avoid:** Return a cleanup function from `onProgress` preload API and call it in Svelte's `$effect` cleanup or `onDestroy`.
```svelte
<script>
  import { onDestroy } from 'svelte'
  const cleanup = window.api.onProgress((data) => { /* update UI */ })
  onDestroy(cleanup)
</script>
```
**Warning signs:** Multiple progress events firing per update; spinner not stopping.

### Pitfall 4: Worker Thread file path resolution after build
**What goes wrong:** `__dirname` inside the worker file refers to the worker bundle directory, not the main bundle directory.
**Why it happens:** Worker is bundled as a separate file by electron-vite.
**How to avoid:** Pass all needed paths in `workerData` from main (where `__dirname` is reliable). Worker never uses `__dirname` for locating its own dependencies.
**Warning signs:** Worker fails to find PDF input files in production build.

### Pitfall 5: electron.vite.config.ts changes for workers
**What goes wrong:** Developers think they need to add worker entry points to `rollupOptions.input` in the config.
**Why it happens:** The official example repo (electron-vite-worker-example) shows rollup input entries, but only for multi-entry main builds (e.g., `child.ts`). The `?nodeWorker` suffix handles bundling automatically without config changes.
**How to avoid:** Use `?nodeWorker` import suffix. No `electron.vite.config.ts` changes needed for a single worker file.
**Warning signs:** Build errors when trying to add worker to rollup input manually.

### Pitfall 6: OUTP-02 — output path persistence in Phase 2
**What goes wrong:** Phase 2 has no `electron-store` (Phase 4 responsibility). The output path needs to "persist" but store isn't available.
**Why it happens:** OUTP-02 is listed as Phase 2 but full persistence requires electron-store.
**How to avoid:** Phase 2 implementation: use `app.getPath('documents')` as the fixed default output base directory. Display it in the UI. User cannot change it yet (Phase 4 adds settings). This satisfies "no re-entry required" for the common case while deferring the settings UI.
**Warning signs:** Attempting to implement electron-store in Phase 2 causes scope creep.

### Pitfall 7: shell.openPath returns a Promise on Electron 34
**What goes wrong:** Calling `shell.openPath` without `await` ignores errors silently.
**Why it happens:** In older Electron docs it appeared synchronous; it returns a `Promise<string>` (empty on success, error message on failure).
**How to avoid:** Always `await shell.openPath(path)` and check the return value for error strings.

---

## Code Examples

### Complete Extract Operation (Worker)
```typescript
// src/main/workers/pdf-worker.ts — extract case
import { parentPort, workerData } from 'node:worker_threads'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument, EncryptedPDFError } from 'pdf-lib'

interface WorkerArgs {
  operation: 'extract' | 'split' | 'merge'
  filePath?: string        // single file (extract, split)
  filePaths?: string[]     // multiple files (merge)
  outputFolder: string
  params: Record<string, unknown>
}

async function run() {
  const args = workerData as WorkerArgs

  try {
    if (args.operation === 'extract') {
      const bytes = await readFile(args.filePath!)
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: false })
      const pageIndices: number[] = (args.params.pageIndices as number[])

      const newDoc = await PDFDocument.create()
      parentPort!.postMessage({ type: 'progress', percent: 30 })
      const pages = await newDoc.copyPages(srcDoc, pageIndices)
      pages.forEach(p => newDoc.addPage(p))
      parentPort!.postMessage({ type: 'progress', percent: 80 })

      const pdfBytes = await newDoc.save()
      await mkdir(args.outputFolder, { recursive: true })
      const outName = 'extracted.pdf'
      await writeFile(join(args.outputFolder, outName), pdfBytes)

      parentPort!.postMessage({
        type: 'complete',
        result: { outputFiles: [outName], outputFolder: args.outputFolder }
      })
    }
    // ... split, merge cases ...
  } catch (err) {
    parentPort!.postMessage({ type: 'error', error: classifyError(err) })
  }
}

run()
```

### Indeterminate Spinner (CSS Only)
```svelte
<!-- ProgressSpinner.svelte -->
<div class="spinner" role="status" aria-label="Processing..."></div>

<style>
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-surface-2);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

### Mode State with Svelte 5 Runes
```svelte
<!-- ExtractMode.svelte — state shape -->
<script lang="ts">
  import { appState } from '../stores/app.svelte.ts'

  // Local operation state
  let pageRangeInput = $state('')
  let isProcessing = $state(false)
  let operationResult = $state<OperationResult | null>(null)

  // Derived: page indices from range input
  // (computed on button click, not live — per locked decision)

  function reset() {
    pageRangeInput = ''
    operationResult = null
  }

  // Clear results when mode changes (locked decision)
  $effect(() => {
    appState.currentMode  // track mode
    operationResult = null
  })

  async function execute() {
    isProcessing = true
    operationResult = null
    const indices = parsePageRange(pageRangeInput, appState.currentFile!.pageCount)
    operationResult = await window.api.extractPages({ ... })
    isProcessing = false
  }
</script>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `File.path` for drag-drop paths | `webUtils.getPathForFile(file)` | Electron 32 | Already handled in Phase 1 |
| `ipcRenderer.on` for operations | `ipcRenderer.invoke` (request/response) | Electron ~5 | Already established in Phase 1 |
| Manual rollup input for workers | `?nodeWorker` / `?modulePath` suffix | electron-vite | No config changes needed for worker |
| Spawning `child_process` for CPU work | Node.js `worker_threads` | Node.js 12+ | worker_threads share memory optionally, less overhead |

**Deprecated/outdated:**
- `ipcMain.on` for invoke-style operations: causes listener accumulation (established in Phase 1)
- `nodeIntegrationInWorker: true` Web Workers in renderer: This is Electron's older Web Worker approach, not needed — main-process Worker Threads are the correct pattern for pdf-lib work

---

## Open Questions

1. **OUTP-02: Output destination path picker**
   - What we know: Phase 4 adds electron-store. Phase 2 needs a usable default.
   - What's unclear: Should Phase 2 expose a simple "choose output folder" button, or just hard-code `app.getPath('documents')`?
   - Recommendation: Use `app.getPath('documents')` as the fixed default, display the resolved path in the UI so user can see where files go. No folder picker in Phase 2 — that's a Phase 4 setting. This avoids scope creep while being transparent.

2. **OUTP-04: Auto-open output folder setting**
   - What we know: The toggle is a Phase 4 setting (SETT-02). Phase 2 must implement OUTP-04.
   - What's unclear: Should Phase 2 default to auto-open always, never, or add a temporary toggle?
   - Recommendation: Default to always auto-open in Phase 2 (most useful out-of-the-box). Phase 4 adds the toggle to settings.

3. **Worker Thread TypeScript types**
   - What we know: `workerData` is typed as `unknown` from `node:worker_threads`. We cast it.
   - What's unclear: Whether TypeScript will complain about the `?nodeWorker` import syntax without a type declaration.
   - Recommendation: Add a `.d.ts` or inline type assertion for the worker factory. The electron-vite example handles this; check the example repo for the exact pattern.

4. **Progress granularity (determinate vs indeterminate)**
   - What we know: Locked decision says prefer indeterminate spinner, optionally determinate if reasonable.
   - What's unclear: pdf-lib `copyPages` is a single async call with no streaming progress. Granular progress is not available from the library.
   - Recommendation: Use indeterminate spinner only. The fake progress percentages in the code example (30%, 80%) above are illustrative but potentially misleading. For Phase 2, ship indeterminate. Locked decision already anticipates this.

---

## Sources

### Primary (HIGH confidence)
- `pdf-lib.js.org/docs/api/classes/pdfdocument` — PDFDocument API: `copyPages`, `load`, `save`, `getPageIndices`, `create`, `addPage`
- `nodejs.org/api/worker_threads.html` — Worker, workerData, parentPort, postMessage, structured clone constraints
- `electron-vite.org/guide/dev` — `?nodeWorker` and `?modulePath` import suffixes, no config changes required
- `electronjs.org/docs/latest/api/dialog` — showOpenDialog with `multiSelections` property
- `electronjs.org/docs/latest/api/shell` — `shell.openPath` returning `Promise<string>`
- `electronjs.org/docs/latest/tutorial/ipc` — `webContents.send` for main-to-renderer progress updates
- `github.com/alex8088/electron-vite-worker-example` — Complete worker pattern with `?nodeWorker` import

### Secondary (MEDIUM confidence)
- `github.com/Hopding/pdf-lib` issues — EncryptedPDFError, parse error messages, copyPages not preserving outlines
- `svelte.dev/playground/e62f83d69cea4fda9e8a897f50b5a67c` — Native drag-to-reorder implementation in Svelte
- WebSearch findings on electron IPC + worker thread progress pattern — confirmed by official IPC docs

### Tertiary (LOW confidence)
- Windows 11 22H2 `shell.openPath` focus bug (Electron issue #36765) — reported by multiple users, not officially fixed in Electron docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pdf-lib already in project; worker_threads and fs/promises are Node built-ins
- Architecture: HIGH — pattern verified against official Electron IPC docs and electron-vite worker example
- pdf-lib API: HIGH — verified against official docs (`pdf-lib.js.org/docs/api`)
- Drag-to-reorder: HIGH — native HTML5 approach verified in official Svelte playground
- Pitfalls: HIGH for IPC/listener pitfalls (Phase 1 learnings); MEDIUM for worker path resolution in production build (training data + pattern)

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (stable libraries; 60 days reasonable)
