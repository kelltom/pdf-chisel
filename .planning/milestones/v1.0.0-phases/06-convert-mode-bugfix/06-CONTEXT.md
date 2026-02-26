# Phase 6 Context: Convert Mode Bugfix

## User-Provided Bug Description

### Bug: Review Workflow Image Preview Overflows View Bounds

**What is broken:**
When the user enters the Review state in Convert mode, the preview image is not constrained to the view boundaries. The image appears to have a minimum size that bleeds beyond the body height, forcing overflow scrolling.

**Expected behavior:**
The image preview should *fit within* the view — it should scale down to fill the available space without ever causing the view body to overflow. The original spec required "fit" behavior.

**Root cause hypothesis:**
A previous phase (Phase 5: UI improvement) fixed overflow bugs across the app by allowing `overflow-y: auto` on mode view bodies. This fix is correct for most modes (Extract, Split, Merge, Settings) where content can legitimately be longer than the viewport. However, in the Review workflow state, overflow should be *impossible* — the image preview must scale to fit the available space rather than overflow beyond it.

**Scope:**
- Only the Review workflow state within ConvertMode is affected
- Other mode views should retain their overflow-y: auto behavior
- The fix is CSS/layout — the image preview needs proper max-height constraints and the review view container needs overflow: hidden (not auto) when in review state

## Design Constraints

- Do NOT revert the general overflow fix from Phase 5 — it is correct for all other modes
- The image preview must use `object-fit: contain` and be constrained by its container height
- The review container needs to prevent overflow (overflow: hidden) when displaying the image preview
- Keyboard shortcuts and copy-and-next behavior must remain unchanged
