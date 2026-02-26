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
- Prefer an indeterminate spinner. In later phases, we may replace this with a custom gif or animation that better fits the app style (like a chisel picking away at a PDF).
- Consider optionally implementing a determinate progress bar if the Worker Thread can provide progress updates, but fallback to indeterminate if not reasonable.

### Results summary (after successful operation)
- Show a list of output filenames
- Show an "Open folder" button to reveal the timestamped output subfolder in Windows Explorer
- "Open folder" button applies to every operation: Extract, Split, and Merge

### Post-completion UI state
- A persistent **Reset button** is always visible in every mode — clears all inputs to defaults at any time
- Summary panel clears when the user starts a new operation
- Results area (success or error) clears when the user switches modes

### Error display
- Errors display inline in the results area (replacing the progress bar), not in a toast or modal
- Errors stay visible until the user resets, switches modes, or starts a new operation
- Error messages include both the cause and a suggested fix (e.g. "Failed to write output: permission denied. Try saving to a different folder.")

### Button state during processing
- Action button (Extract / Split / Merge) is disabled while processing. No spinner on the button itself — the progress bar communicates state
- Mode switch buttons are disabled during processing to prevent mid-operation mode changes, which could cause confusion or errors

### UI Consistency
- The UI layout and controls remain consistent across all three modes. Only the specific inputs and labels change based on the selected operation, but the overall structure (input area, action button, progress/error area, results summary) remains the same to provide a cohesive user experience
- Prefer shared styling and components across modes to maintain visual consistency and reduce development overhead when possible

### Cancellation
- No cancel button — operations run to completion (or fail)

### Claude's Discretion
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
