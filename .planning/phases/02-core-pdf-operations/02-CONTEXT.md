# Phase 2: Core PDF Operations - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver three functional modes — Extract pages, Split PDF, and Merge PDFs — with Worker Thread processing, progress feedback, specific error messages, and timestamped output. All operations are local. PDF preview, settings persistence, and image conversion are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Page range UX (Extract mode)
- Validate on blur (when input loses focus), not live while typing
- Out-of-range page numbers are clamped silently — extract what exists, ignore numbers beyond the PDF's page count
- Empty input extracts the whole PDF (treat empty as "all pages")
- Placeholder is a generic hint like "e.g. 1-5, 8, 12-15" — no page count displayed in the field

### Progress indicator
- Prefer a determinate progress bar (0–100%) during operations
- **Note for researcher/planner:** Determinate progress requires knowing page count upfront. If a specific operation (e.g. merge) cannot provide progress granularity, fall back to an indeterminate spinner — the UI should support both patterns. This decision is tentative; research should confirm feasibility per operation.

### Results summary (after successful operation)
- Show a list of output filenames
- Show an "Open folder" button to reveal the timestamped output subfolder in Windows Explorer
- "Open folder" button applies to every operation: Extract, Split, and Merge

### Post-completion UI state
- A persistent **Reset button** is always visible in every mode — clears all inputs to defaults at any time
- Summary panel clears when the user starts a new operation (not on mode switch)
- Results area (success or error) clears when the user switches modes

### Error display
- Errors display inline in the results area (replacing the progress bar), not in a toast or modal
- Errors stay visible until the user resets or switches modes
- Error messages include both the cause and a suggested fix (e.g. "Failed to write output: permission denied. Try saving to a different folder.")

### Action button during processing
- Action button (Extract / Split / Merge) is disabled while processing
- No spinner on the button itself — the progress bar communicates state

### Cancellation
- No cancel button — operations run to completion (or fail)

### Claude's Discretion
- Exact progress bar component and animation style
- Determinate vs. indeterminate fallback implementation details (confirm in research)
- Typography and spacing of the results summary
- Exact wording of success/error messages (follow the cause + fix pattern)

</decisions>

<specifics>
## Specific Ideas

- Reset button should always be visible, not just post-operation — the user wants a reliable way to clear inputs without having to reload a file
- "Open folder" should use Electron's `shell.openPath` to reveal the output subfolder in Explorer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-pdf-operations*
*Context gathered: 2026-02-22*
