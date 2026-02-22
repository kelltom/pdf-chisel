# Feature Landscape

**Domain:** PDF desktop manipulation utility (Extract, Split, Convert to Images, Merge)
**Project:** PDF Chisel — Electron + Svelte, Windows-only, local processing
**Researched:** 2026-02-22
**Confidence:** MEDIUM — web fetch tools blocked; findings drawn from deep training knowledge of pdf-lib, ilovepdf, smallpdf, PDFsam, PDF24, Adobe Acrobat, Foxit, and comparable utilities

---

## Table Stakes

Features users expect in any PDF manipulation desktop utility. Missing = product feels broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Page range input with text syntax** | Every serious PDF tool accepts "1-5, 8, 12-15" notation — users who manipulate PDFs know this syntax; a click-only selector for 200-page docs is unusable | Low | Must support comma-separated ranges, single pages, and "to end" shorthand (e.g., "10-"). Validate input and show error inline. |
| **Page count displayed on load** | Users need to know how many pages exist before entering ranges or splits | Low | Show immediately after file loads. Never make user open the PDF separately to check. |
| **Drag-and-drop file loading** | Every modern desktop file utility accepts drag-and-drop; requiring only a file picker dialog feels dated | Low | Support drop on the mode panel area, not just a dedicated drop zone. |
| **Output filename/folder visibility before running** | Users need to see where output will land before committing. "It ran — where did it go?" is a common complaint in PDF tools | Low | Show resolved output path (with timestamp folder name) before the action button is clicked. |
| **Success state with open-folder action** | After completion, show confirmation + "Open Folder" link. Users should not need to navigate to find results | Low | Auto-open setting (already in scope) supplements this; the button is still required regardless of setting. |
| **Error messages that say what went wrong** | "An error occurred" is useless. PDF operations fail due to password-protected files, corrupted inputs, or disk-full conditions — all diagnosable | Low | Show file-specific error text; distinguish "can't read file" from "can't write output". |
| **Progress indicator for multi-page operations** | Converting a 200-page PDF to images takes seconds or minutes. No progress = user assumes it hung | Medium | Determinate progress bar (page N of M) is better than spinner for image conversion. Spinner is acceptable for split/extract. |
| **Password-protected PDF detection** | Attempting to process a locked PDF will fail silently or cryptically without pre-check | Medium | Detect at load time and show a clear message: "This PDF is password-protected and cannot be processed." Do not proceed. |
| **Persistent output destination** | Already in scope. Users set it once and expect it remembered. Re-prompting every session is friction. | Low | Already planned. Persist via Electron store. |
| **DPI choice for image conversion (72/96/150/300)** | Already in scope. Users converting for web want 96dpi; for print review 150-300dpi. No choice = wrong output for half of users | Low | Already planned. Offer preset values; 150dpi as default is a safe midpoint. |
| **PNG and JPEG format choice for image conversion** | Already in scope. PNG for lossless (screenshots, diagrams), JPEG for smaller size (photos). Single format forces workarounds. | Low | Already planned. Include brief explanation of each as tooltip or subtitle. |
| **Merge: visual file list with reorder** | Already in scope. Dropping files with no reorder ability forces alphabetical naming hacks | Medium | Drag-to-reorder already planned. Show filename + page count per file in the list. |
| **Merge: remove individual files from list** | Users add the wrong file or change their mind. No remove button = start over | Low | Each row needs an X/remove button. |
| **Split: show resulting part count before running** | "Split into N parts" produces a different number of files for different page counts — show the math before committing | Low | "Your 47-page PDF split into 5 parts: 4 parts of 10 pages, 1 part of 7 pages." Preview text, not a visual. |
| **File size / page count of input shown** | Helps user make decisions (e.g., whether to use 150 or 300 DPI; how many parts to split into) | Low | Show after file loads. Page count is more critical than file size. |

---

## Differentiators

Features that set PDF Chisel apart. Not universally expected, but meaningfully valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Copy-and-Next review workflow (image conversion)** | Already in scope. Unique in the free desktop tool space. Targets users doing image review workflows — copying screenshots to docs, QA, etc. Ilovepdf/PDF24 have no equivalent | Medium | Already planned. Key: keyboard shortcut (e.g., Space or Enter) should trigger "Copy and Next" — mouse-only is too slow for review workflows. |
| **Thumbnail strip for page selection (Extract mode)** | Visual page picker alongside text range input. Users with image-heavy PDFs benefit enormously — they don't know page numbers, they know what the page looks like. Web tools like ilovepdf offer this; most desktop free tools don't | High | This is the highest-complexity differentiator. Requires pdfjs-dist rendering. Implement after core text-range input works. Flag for deeper technical research. |
| **Timestamp-based output subfolders (no overwrites)** | Already in scope. Most tools write to the root destination and silently overwrite. Chisel's approach is a concrete advantage for users who run multiple passes | Low | Already planned. Make the folder naming pattern visible (e.g., "Output: ~/Desktop/pdf-output/2026-02-22_143055-extract/"). |
| **Keyboard shortcut for review workflow** | Space/Enter to advance in Copy-and-Next workflow. Power users doing image review are keyboard-first; mouse-clicking per page kills the workflow | Low | Implement alongside the review workflow. Negligible added effort for significant UX gain. |
| **Page range preview text (Extract mode)** | Show "Pages selected: 1, 3, 5-8 → 6 pages" as the user types the range. Immediate validation feedback without running the operation | Low | Client-side range parser; no PDF library needed. Reduces bad-range errors. |
| **Per-mode last-used settings persistence** | Remember last DPI choice, last output format, last split strategy (by parts vs max pages). Users repeat the same operations — re-selecting every time is friction | Low | Electron store, per-mode key. Small effort, meaningfully reduces friction for repeat users. |
| **"No cloud" trust signal in UI** | Privacy-conscious users (the target audience) want reassurance. A small persistent label ("100% local — no upload") in the UI footer or about screen distinguishes Chisel from web tools without feature differences | Low | Copy/label only; no code. Highly effective for the target segment who chose desktop precisely to avoid upload. |
| **Clear format explanation at point of choice** | PNG vs JPEG explanation next to the format selector ("PNG: lossless, larger files — JPEG: smaller, slight quality loss") eliminates second-guessing without requiring docs | Low | Inline tooltip or subtitle. No implementation complexity. |
| **Merge: show page count per file in list** | When reordering files for merge, knowing "document-final.pdf (12 pages)" vs "document-v2.pdf (14 pages)" prevents wrong-file errors | Low | Requires reading page count via pdf-lib at add time; display alongside filename. |

---

## Anti-Features

Features to deliberately NOT build. Each has a specific reason beyond "out of scope."

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **PDF editing (text, annotations, form fill)** | Scope creep that doubles complexity; requires a fundamentally different engine (PDFKit, text layout, font embedding). Users who need editing use Acrobat or Foxit — competing there is a losing bet for a utility tool | Keep modes strictly structural: pages in, pages out or images out. Never expose text/content editing |
| **Cloud sync or backup** | Violates the core privacy principle. Any network write for file content destroys the trust proposition | No network calls for file content. Updates via GitHub Releases is acceptable (binary metadata only) |
| **PDF viewer / reader mode** | A built-in reader competes with every PDF viewer users already have. Adds significant UI surface area for zero new utility | Open PDFs via OS default app (shell.openPath) when the user wants to review. Do not embed a viewer |
| **Batch processing across multiple operations** | "Split all files in a folder" sounds useful but creates complex error handling, overwrite logic, and progress UX that overshadows core flows. Most users want single-file precision | Keep operations single-file (except Merge, which is inherently multi-file by design) |
| **OCR** | OCR requires Tesseract or a cloud API, dramatically increases app size and complexity, and overlaps with specialized tools (ABBYY, Adobe Scan). Out of lane for a structural utility | If OCR is requested, note it as a v3 research topic |
| **Compression / optimization** | PDF optimization is a different problem (image downsampling, font subsetting, stream compression). Good results require deep PDF internals expertise; bad results corrupt files | Do not expose a compression operation. If asked, explain the constraint |
| **Page rotation as a persistent operation** | Rotation during export sounds simple but is poorly specified: does it affect all pages? Selected pages? Merge order? Creates scope ambiguity with no clean boundary | If rotation is needed, users should use their PDF viewer's export. Do not expose rotation controls |
| **Custom output filename templates** | "Let users name their output files" seems harmless but requires a template language, validation of OS-illegal characters, collision handling, and settings UI. The timestamp-folder approach solves the real problem (no overwrites) without this complexity | Stick to timestamp-based folders with predictable names (split-001.pdf, split-002.pdf, etc.) |
| **Undo / operation history** | Desktop PDF tools almost never implement undo because the output is a new file — the input is never modified. "Undo" creates false expectation that the input was changed | Make it clear inputs are always unchanged ("Your original file is never modified"). The timestamp folder is the natural undo: just delete it |
| **Settings-heavy DPI configuration** | Already out of scope per PROJECT.md. Global default DPI creates incorrect mental model — DPI is a per-conversion decision | DPI selector lives in Convert mode UI only, per-conversion |
| **Multiple simultaneous operations** | Running Split + Extract at the same time adds concurrency complexity (Electron IPC, progress multiplexing, output folder collisions) for marginal gain | Queue operations; complete one before starting another |
| **Per-page extraction to multiple PDFs** | Already out of scope per PROJECT.md. Exponential output file count for large PDFs; clutters output folder; ambiguous naming | Extract always produces exactly one PDF. Document this clearly in UI |

---

## Feature Dependencies

```
File Load (drag-drop or picker)
    └── Page count displayed immediately
    └── Password detection (fail fast before any further action)
            └── Page range input (Extract) — needs page count for validation
                    └── Range preview text (selected pages count)
                    └── [OPTIONAL] Thumbnail strip — needs pdfjs-dist rendering
            └── Split config (by parts or max pages) — needs page count to show preview
                    └── Part-count preview text
            └── Merge file list — needs page count per file
                    └── Drag-to-reorder
                    └── Remove individual file
            └── Convert to images config (DPI + format)
                    └── Review workflow (Copy and Next)
                            └── Keyboard shortcut (Space/Enter)

Run action (any mode)
    └── Progress indicator (determinate for image conversion; spinner for others)
    └── Output destination visible before run
            └── Timestamp subfolder naming
    └── Success state
            └── Open Folder button
            └── Auto-open setting (from Settings)
    └── Error state with specific message
```

---

## MVP Recommendation

### Must ship in v1 (table stakes for the 4 confirmed modes)

1. File load: drag-drop + picker, page count shown, password detection
2. Page range text input with inline validation and "N pages selected" preview text
3. Split: by-parts and max-pages strategies, with part-count preview before run
4. Convert to images: DPI preset selector, PNG/JPEG choice with inline explanation
5. Review workflow: Copy-and-Next with keyboard shortcut (Space/Enter)
6. Merge: file list with reorder, per-file page count, remove button
7. Progress indicator (determinate for image conversion, spinner for others)
8. Output path shown before run, timestamp subfolders, success state with Open Folder
9. Specific error messages (password-protected, corrupt file, write failure)
10. Per-mode last-used settings persistence (DPI, format, split strategy)

### Defer with clear rationale

| Feature | Reason to Defer |
|---------|----------------|
| Thumbnail strip for page selection | High complexity (pdfjs-dist rendering, virtual scroll for large docs, touch/click selection state); build after core text-range input is validated in user hands |
| Color theme (dark/light) | Placeholder in Settings already planned; defer to v2 as noted in PROJECT.md |
| "No cloud" trust signal label | Zero code cost, add late in v1 as copy — not a blocker |
| Per-mode last-used settings | Low complexity; implement alongside mode UI, not as a separate phase |

---

## Sources

- Domain knowledge: ilovepdf.com, smallpdf.com, PDFsam Basic, PDF24 Desktop, Adobe Acrobat UX patterns, Foxit PDF Editor feature sets — analyzed from training knowledge (confidence: MEDIUM; web fetch blocked during this session)
- PROJECT.md constraints and confirmed features: C:/Repos/pdf-chisel/.planning/PROJECT.md (HIGH confidence — authoritative project source)
- Electron + pdf-lib + pdfjs-dist capability knowledge: training data (MEDIUM confidence — recommend verifying pdfjs-dist thumbnail rendering capability with Context7 in a stack research pass)

**Confidence notes:**
- Table stakes list: HIGH — these patterns appear consistently across 5+ established PDF tools
- Differentiators list: MEDIUM — based on competitive feature gap analysis from training knowledge; web verification blocked
- Anti-features list: HIGH — these are well-documented failure modes in the utility software category
- Thumbnail strip complexity rating: HIGH confidence it is the highest-complexity UI feature; requires phase-specific research before implementation
