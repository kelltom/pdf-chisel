# Phase 3: Convert to Images + Review - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

PDF-to-image conversion: user selects format (PNG/JPEG) and DPI preset, converts a loaded PDF to one image per page, then optionally enters a sequential review workflow to cycle through images and copy each to clipboard. Creating/editing PDFs and cloud sync are out of scope.

</domain>

<decisions>
## Implementation Decisions

### UI layout
- Make sure UI is consistent with other features in terms of component sizing, padding, margins, spacing, etc.

### Format selector
- Segmented button / toggle group (PNG | JPEG) — consistent with Phase 2 toggle pattern (e.g. parts/max-pages)
- One-liner beneath each option: PNG: lossless, larger files | JPEG: compressed, smaller

### DPI selector
- Four presets: 72 / 96 / 150 / 300
- Each preset shows a hint for its typical use (72: screen | 96: web | 150: general | 300: print)
- Default: 96 DPI
- Selector style: Claude's discretion (pick what fits the hints layout best)

### Conversion progress
- Inline spinner progress indicator within Convert mode — non-blocking, same pattern as other modes
- Progress label shows "Page N of M" updating in real time
- Does NOT block the main UI thread (Worker Thread, same as Extract/Split/Merge)

### Results summary (post-conversion)
- Same summary pattern as other modes: "X files created in [folder]" + filename list
- No extras (no total file size)
- Show button to open output folder in system file explorer
- "Start Review" button shown alongside the summary

### Review workflow layout
- Replaces the main body content area (in-window, not a new Electron window)
- Nav rail remains visible during review
- One image at a time — no thumbnail strip
- Image sizing/fit: Claude's discretion (fit to content area, preserve aspect ratio)

### Image preview metadata
- Position indicator only ("1 / 12") — no filename, no file size

### Image source during review
- Load from disk (show the saved output files, not re-rendered from PDF)

### Copy-and-Next behavior
- "Copy and Next" copies current image to clipboard, advances to next
- Visual feedback: brief flash/highlight on the image to confirm copy, then advances
- Keyboard shortcuts: Space / Enter for Copy and Next (per success criteria)

### Back navigation
- Back button navigates to previous image without copying to clipboard
- Back is for reviewing/re-examining only; user must press Copy and Next to copy

### End-of-review flow
- After last image: show a completion screen
- Completion screen content: position count + close button only
- Closing completion screen returns the user to the Convert mode form

### Convert → Review transition
- After conversion, show the results summary with a "Start Review" button
- Review is re-enterable: "Start Review" stays available until a new conversion runs
- Starting review replaces the main body with the review workflow
- Ending or aborting review returns to the Convert mode form (with results summary if conversion has run)

### Claude's Discretion
- DPI selector visual style (horizontal segmented vs. vertical radio — pick what fits the hints)
- Image scaling/fit algorithm in review
- Loading skeleton or placeholder while images load from disk
- Error state if an output image file is missing when review starts

</decisions>

<specifics>
## Specific Ideas

- Conversion should feel the same as other modes: non-blocking background processing with a spinner
- Review is a focused, linear workflow — no jumping around, no extras, just cycle through and copy

</specifics>

<deferred>
## Deferred Ideas

- Configurable default DPI via app settings — Phase 4 (per-mode last-used values persistence)

</deferred>

---

*Phase: 03-convert-to-images-review*
*Context gathered: 2026-02-23*
