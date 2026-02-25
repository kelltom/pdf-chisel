---
phase: 05-ui-improvement
plan: 01
subsystem: renderer/ui
tags: [bugfix, ui, reset, overflow, svelte]
dependency_graph:
  requires: []
  provides: [reset-button-per-mode, overflow-fix, currentFile-unload-on-reset]
  affects: [ResultsSummary, OperationLayout, ExtractMode, SplitMode, MergeMode, ConvertMode]
tech_stack:
  added: []
  patterns: [reset-owns-currentFile, mode-owns-reset-button, OperationLayout-display-only]
key_files:
  created: []
  modified:
    - src/renderer/src/lib/components/ResultsSummary.svelte
    - src/renderer/src/lib/components/OperationLayout.svelte
    - src/renderer/src/lib/components/modes/ExtractMode.svelte
    - src/renderer/src/lib/components/modes/SplitMode.svelte
    - src/renderer/src/lib/components/modes/MergeMode.svelte
    - src/renderer/src/lib/components/modes/ConvertMode.svelte
decisions:
  - "ResultsSummary made display-only: onReset prop and Reset button removed; each mode owns its own Reset"
  - "Reset in Extract/Split/Convert sets appState.currentFile = null; MergeMode Reset does not (no single-file state)"
  - "OperationLayout .operation-layout: height: 100% and overflow-y: auto removed — parent App.svelte owns scroll"
  - "ConvertMode .mode-view: flex: 1, min-height: 0, overflow-y: auto — ConvertMode owns its scroll region"
  - "onReset prop removed from OperationLayout entirely — Reset responsibility moved to mode actions snippet"
metrics:
  duration: ~4 min
  completed: 2026-02-24
  tasks_completed: 2
  files_modified: 6
---

# Phase 5 Plan 01: Reset Button Consolidation and Overflow Fix Summary

Fix three interlocked UI bugs: Reset button duplication across ResultsSummary and mode components; Reset failing to unload the current PDF; ConvertMode overflowing the viewport.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove Reset from ResultsSummary; fix OperationLayout overflow | f7da325 | ResultsSummary.svelte, OperationLayout.svelte |
| 2 | Add Reset button to mode actions; reset() clears currentFile | 25b9f0e | ExtractMode.svelte, SplitMode.svelte, MergeMode.svelte, ConvertMode.svelte |

## What Was Built

**ResultsSummary.svelte** — now display-only. Removed `onReset` prop (TypeScript type + destructure) and the `<button class="btn btn-reset">Reset</button>` element. Also removed the `.btn-reset` CSS class since it's no longer needed here. Component now accepts only `result` and renders error/success panels plus Open Folder button.

**OperationLayout.svelte** — removed `onReset` from props definition and from the `<ResultsSummary>` call. Removed `height: 100%` and `overflow-y: auto` from `.operation-layout` CSS — these were fighting the parent scroll container in App.svelte.

**ExtractMode.svelte** — added Reset button after Extract button in `{#snippet actions()}`. Added `appState.currentFile = null` to `reset()`. Added `.btn-reset` CSS. Removed `onReset={reset}` from `<OperationLayout>` call.

**SplitMode.svelte** — same pattern as ExtractMode: Reset in actions, `appState.currentFile = null` in reset(), `.btn-reset` CSS, removed onReset prop.

**MergeMode.svelte** — Reset in actions snippet, `.btn-reset` CSS, removed onReset prop. `reset()` intentionally does NOT clear `appState.currentFile` — MergeMode manages its own `files` array; it has no single currentFile.

**ConvertMode.svelte** — Reset in `{#snippet actions()}` (inside OperationLayout at top). `reset()` adds `appState.currentFile = null`. Removed standalone `<button class="btn btn-reset">Reset</button>` from inside `.convert-results` div. `.mode-view` CSS changed to `flex: 1; min-height: 0; overflow-y: auto` so ConvertMode scrolls internally rather than pushing content outside the viewport.

## Decisions Made

1. **ResultsSummary is display-only** — Reset button moved to mode-level actions snippets. Each mode renders its own Reset alongside its primary action button, keeping label and behavior mode-controlled.

2. **Reset unloads the file in Extract/Split/Convert** — `appState.currentFile = null` added to these modes' `reset()` functions. Returns app to fully blank state: no file loaded, all local state cleared.

3. **MergeMode Reset does not touch currentFile** — MergeMode never uses `appState.currentFile`; it maintains its own `files[]` array. Clearing currentFile here would be incorrect.

4. **OperationLayout no longer owns scroll** — `height: 100%` and `overflow-y: auto` removed from `.operation-layout`. The parent `main.content` in App.svelte is the scroll container for Extract/Split/Merge. ConvertMode handles its own scrolling via `.mode-view` CSS.

5. **ConvertMode .mode-view scroll model** — `flex: 1; min-height: 0; overflow-y: auto` added. The `min-height: 0` is the critical fix: without it, a flex child expands to content size and pushes outside the viewport rather than scrolling.

## Verification

TypeScript: zero errors (`npx tsc --noEmit --project tsconfig.web.json`)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: src/renderer/src/lib/components/ResultsSummary.svelte
- FOUND: src/renderer/src/lib/components/OperationLayout.svelte
- FOUND: src/renderer/src/lib/components/modes/ExtractMode.svelte
- FOUND: src/renderer/src/lib/components/modes/SplitMode.svelte
- FOUND: src/renderer/src/lib/components/modes/MergeMode.svelte
- FOUND: src/renderer/src/lib/components/modes/ConvertMode.svelte

Commits verified:
- FOUND: f7da325 (Task 1)
- FOUND: 25b9f0e (Task 2)
