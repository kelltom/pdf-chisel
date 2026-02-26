---
phase: 02-core-pdf-operations
plan: "05"
subsystem: ui
tags: [svelte5, typescript, css, catppuccin, drag-drop, merge, html5-dnd]
dependency_graph:
  requires:
    - 02-01-SUMMARY.md (window.api.mergePdfs, window.api.openPdfsDialog, window.api.getPathForFile, window.api.onProgress)
    - 02-02-SUMMARY.md (OperationLayout, ResultsSummary, ProgressSpinner)
  provides:
    - MergeMode fully implemented — multi-file list with drag-to-reorder, external drag-drop from Explorer, merge execute
  affects:
    - NavRail (appState.isProcessing disables nav during processing)
tech-stack:
  added: []
  patterns:
    - "Native HTML5 drag-to-reorder within list — no library; stable file.id as keyed-each key prevents Svelte DOM tracking bugs"
    - "Dual drag event handlers: list item ondragover handles reorder; container ondrop handles external file drops — no conflict because dataTransfer.files is empty during list reorder"
    - "onProgress cleanup returned from window.api.onProgress called in onDestroy — prevents ipcRenderer listener accumulation"
    - "appState.isProcessing set on execute start/cleared on complete + onDestroy — NavRail disabled during processing"
key-files:
  created: []
  modified:
    - src/renderer/src/lib/components/modes/MergeMode.svelte
decisions:
  - "Used crypto.randomUUID() for stable file.id — keyed {#each} uses (file.id) not index to prevent Svelte DOM reuse bugs during drag-to-reorder"
  - "Drop zone conflict avoided by design: list item drag has no dataTransfer.files; Explorer drag has no dragIndex set — handlers naturally scope to their drag source"
  - "Merge mode does NOT use Phase 1 FileInput component — manages its own multi-file list entirely separate from appState.currentFile (single-file concept)"
metrics:
  duration: "~5 min"
  completed_date: "2026-02-23"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
---

# Phase 2 Plan 5: Merge Mode UI Summary

**One-liner:** Full Merge mode with multi-file picker, external drag-drop from Explorer, native HTML5 drag-to-reorder list using stable crypto.randomUUID keys, and OperationLayout for consistent structure.

## What Was Built

Replaced the Phase 1 MergeMode stub with a complete implementation. The user can add multiple PDFs via the "Add Files" dialog button (`window.api.openPdfsDialog`) or by dragging PDF files from Windows Explorer onto the drop zone. Files appear in an ordered list with braille-style drag handles. The user can reorder files by dragging list items (native HTML5 `ondragstart`/`ondragover`/`ondragend` — no library). Each file item has a remove button. The Merge button is disabled until at least 2 files are in the list and re-disabled during processing. OperationLayout provides the consistent wrapper with ProgressSpinner and ResultsSummary (success/error/reset).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement MergeMode.svelte — file list with drag-to-reorder, multi-file picker, merge execute | d836925 | src/renderer/src/lib/components/modes/MergeMode.svelte |

## Key Architecture

**Dual drag event pattern:**
```
List item drag-to-reorder:
  ondragstart(i) → sets dragIndex = i
  ondragover(e, i) → if dragIndex !== null && dragIndex !== i: splice to reorder, dragIndex = i
  ondragend() → dragIndex = null

External file drop (from Explorer):
  container ondragover → e.preventDefault(); isDragOver = true
  container ondragleave → isDragOver = false
  container ondrop → read e.dataTransfer.files, filter .pdf, map getPathForFile → add to list
```

No conflict: when dragging a list item, `e.dataTransfer.files` is empty; when dragging from Explorer, `dragIndex` is null so reorder logic is a no-op.

**File identity:** Each `FileItem` has `id: crypto.randomUUID()`. The `{#each files as file, i (file.id)}` uses `file.id` as the keyed-each key — critical for correct Svelte DOM tracking during reorder operations.

**Execute flow:**
```
execute():
  → appState.isProcessing = true (disables NavRail)
  → isProcessing = true (shows ProgressSpinner via OperationLayout)
  → window.api.onProgress(callback) → returns cleanup fn
  → window.api.mergePdfs({ operation: 'merge', filePaths: [...] })
  → cleanupProgress()
  → operationResult = result (success or error shape)
  → isProcessing = false, appState.isProcessing = false
```

**Mode-clear effect:**
```svelte
$effect(() => {
  if (appState.currentMode !== 'merge') {
    operationResult = null
  }
})
```

## Verification Results

1. `src/renderer/src/lib/components/modes/MergeMode.svelte` contains: `mergePdfs`, `openPdfsDialog`, `dragIndex`, `OperationLayout`, `FileItem`, `ondragover` — PASSED
2. Keyed `{#each}` uses `(file.id)` — NOT array index — PASSED
3. `node typescript/bin/tsc --noEmit --project tsconfig.web.json` — zero errors PASSED
4. `node typescript/bin/tsc --noEmit --project tsconfig.node.json` — zero errors PASSED

## Deviations from Plan

**Git tooling deviation (no functional impact):**

During task commit, `gsd-tools commit --help` was called to inspect usage. The tool interpreted `--help` as the commit message and staged all untracked files (plan .md files) along with MergeMode.svelte into a single commit with the message `--help`. This was an operator error — the intent was to inspect tool usage before committing.

The commit `d836925` contains the correct content (MergeMode.svelte fully implemented, TypeScript clean) alongside unrelated plan files. The `git commit --amend` command was blocked by the sandbox environment. Documented here for traceability.

**Functional impact:** None. MergeMode.svelte is correctly implemented and TypeScript-verified.

## Self-Check

**Files exist:**
- src/renderer/src/lib/components/modes/MergeMode.svelte — modified (full implementation)

**Commits exist:**
- d836925 — MergeMode.svelte implementation (with incidental plan files due to tooling issue)

## Self-Check: PASSED
