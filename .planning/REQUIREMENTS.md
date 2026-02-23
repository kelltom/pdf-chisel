# Requirements: PDF Chisel

**Defined:** 2026-02-22
**Core Value:** Every operation completes locally, privately, and without friction — users pick a mode, pick files, and get results.

## v1 Requirements

### App Shell

- [x] **APP-01**: App displays top app-bar with "PDF Chisel" title on the left
- [x] **APP-02**: App displays a settings gear icon in the top-right of the app-bar that navigates to the settings page
- [x] **APP-03**: App displays a vertical mode selector on the left edge with icons for all 4 modes (Extract, Split, Convert, Merge)
- [x] **APP-04**: Selecting a mode from the vertical nav renders that mode's view in the main body area

### File Input

- [x] **FILE-01**: User can select PDF file(s) via a native file browser dialog
- [x] **FILE-02**: User can drag-and-drop PDF file(s) onto the file input area
- [x] **FILE-03**: App displays the selected file name and page count after a file is loaded

### Extract

- [ ] **EXTR-01**: User can specify pages to extract using text range syntax (e.g. "1-5, 8, 12-15")
- [x] **EXTR-02**: User can execute extraction to receive a single new PDF containing only the selected pages

### Split

- [ ] **SPLT-01**: User can split a PDF by specifying a desired number of output parts (pages divided evenly)
- [ ] **SPLT-02**: User can split a PDF by specifying a maximum number of pages per output file
- [x] **SPLT-03**: User can execute a split to receive multiple PDFs in the output subfolder

### Convert to Images

- [ ] **CONV-01**: User can select output image format (PNG or JPEG) with a clear explanation of the difference shown in the UI
- [ ] **CONV-02**: User can set the output DPI/resolution before conversion
- [ ] **CONV-03**: User can execute conversion to receive one image file per PDF page in the output subfolder

### Review Workflow

- [ ] **REVW-01**: After image conversion completes, user can enter the review workflow
- [ ] **REVW-02**: In review mode, the current image is displayed with the user's position shown (e.g. "3 / 12")
- [ ] **REVW-03**: User can click "Copy and Next" to copy the current image to the clipboard and advance to the next image
- [ ] **REVW-04**: User can go back one image at a time in review mode (in case of accidental skip)
- [ ] **REVW-05**: Review workflow ends naturally when the last image has been reached

### Merge

- [ ] **MERG-01**: User can select multiple PDF files to merge
- [ ] **MERG-02**: User can reorder selected PDFs via drag-and-drop to set the merge order
- [x] **MERG-03**: User can execute merge to receive a single combined PDF in the output subfolder

### Output

- [x] **OUTP-01**: Each execution produces output in a `{timestamp}-{mode}` subfolder within the chosen destination folder
- [x] **OUTP-02**: The output destination path persists across uses and sessions (no re-entry required)
- [x] **OUTP-03**: After execution, user sees a success summary listing what was created (file names, count)
- [x] **OUTP-04**: App opens the output folder automatically after execution (if auto-open setting is enabled)

### Settings

- [ ] **SETT-01**: User can set a default output destination path in settings
- [ ] **SETT-02**: User can toggle auto-open output folder on/off in settings
- [ ] **SETT-03**: Settings page displays the current app version
- [ ] **SETT-04**: App checks for and installs updates automatically via GitHub Releases (electron-updater)

### UX

- [x] **UX-01**: App shows a progress indicator during PDF processing operations
- [x] **UX-02**: App shows clear, human-readable error messages when operations fail (e.g. corrupted file, password-protected PDF, insufficient disk space)

## v2 Requirements

### Visual Navigation

- **VISU-01**: Thumbnail strip showing page previews for page range selection (pdfjs-dist rendering)
- **VISU-02**: Page thumbnail click to jump to specific page reference

### File Handling

- **FILE-04**: User can unlock and process password-protected PDFs by entering the password

### Personalization

- **PERS-01**: User can change the application color theme in settings

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud upload or remote processing | Core privacy principle — all ops must be local |
| PDF editing (text, annotations, forms) | Not a PDF editor; out of product scope |
| PDF viewer/reader | Out of product scope |
| OCR (optical character recognition) | High complexity, not core to restructuring use case |
| Compression / optimization | Deferred; not part of the stated 4 modes |
| Batch job queue | Over-engineering for v1 usage patterns |
| Mac / Linux support | Windows-only for v1 |
| Login, accounts, payments | No fluff |
| Per-page extraction to separate PDFs | Extract always produces one combined PDF; defer multi-output to v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| APP-01 | Phase 1 | Complete (01-03) |
| APP-02 | Phase 1 | Complete (01-03) |
| APP-03 | Phase 1 | Complete (01-03) |
| APP-04 | Phase 1 | Complete (01-03) |
| FILE-01 | Phase 1 | Complete (01-02, 01-03) |
| FILE-02 | Phase 1 | Complete (01-02, 01-03) |
| FILE-03 | Phase 1 | Complete (01-02, 01-03) |
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Complete |
| SPLT-01 | Phase 2 | Pending |
| SPLT-02 | Phase 2 | Pending |
| SPLT-03 | Phase 2 | Complete |
| CONV-01 | Phase 3 | Pending |
| CONV-02 | Phase 3 | Pending |
| CONV-03 | Phase 3 | Pending |
| REVW-01 | Phase 3 | Pending |
| REVW-02 | Phase 3 | Pending |
| REVW-03 | Phase 3 | Pending |
| REVW-04 | Phase 3 | Pending |
| REVW-05 | Phase 3 | Pending |
| MERG-01 | Phase 2 | Pending |
| MERG-02 | Phase 2 | Pending |
| MERG-03 | Phase 2 | Complete |
| OUTP-01 | Phase 2 | Complete |
| OUTP-02 | Phase 2 | Complete |
| OUTP-03 | Phase 2 | Complete |
| OUTP-04 | Phase 2 | Complete |
| SETT-01 | Phase 4 | Pending |
| SETT-02 | Phase 4 | Pending |
| SETT-03 | Phase 4 | Pending |
| SETT-04 | Phase 5 | Pending |
| UX-01 | Phase 2 | Complete |
| UX-02 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0
- Complete: 7 (APP-01–04, FILE-01–03)

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after 01-03 renderer UI complete — Phase 1 all 7 requirements verified*
