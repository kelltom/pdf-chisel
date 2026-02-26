# Phase 5: UI Improvement - Research

**Researched:** 2026-02-24
**Domain:** Svelte 5 component refactoring, CSS layout, UX polish
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase character**
- Genuinely both visual polish AND code quality — they go hand in hand
- Primary code concern: component structure (duplicated logic, inconsistent patterns between modes)

**Bug fixes (known, specific)**
1. **ResultsSummary layout** — The output summary box is poorly positioned; when it grows it covers other components and causes overflow in the main body. This is most severe in the Convert to Images view. Fix the layout so ResultsSummary grows within its allocated space without covering sibling components.
2. **Reset button consolidation** — ResultsSummary currently has its own Reset button. Remove it. Each mode view should have exactly ONE reset button that resets everything in that view.
3. **Reset should unload the PDF** — Currently, clicking Reset does not clear the loaded PDF. Resetting should return the mode to a fully blank state, including unloading the current file.
4. **FileInput height consistency** — The file input box is large when empty but shrinks when a file is loading or loaded. Fix it to a consistent height at all times regardless of state.

**Component structure**
- Audit modes for duplicated logic and inconsistent patterns
- Where modes share behavior, extract to shared components or utilities
- Claude has discretion on specific refactors — target the highest-value improvements

**Visual consistency**
- Modes are generally consistent; no wholesale redesign needed
- Overflow/positioning fix is scoped primarily to ConvertMode's output summary
- Catppuccin Mocha color palette is working — do not change color usage
- Settings page is satisfactory as-is — minimal changes only

### Claude's Discretion
- Specific component refactors to address structural duplication
- How to implement the consistent FileInput height (CSS approach, min-height, etc.)
- Whether any additional minor visual inconsistencies are worth fixing during the audit

### Deferred Ideas (OUT OF SCOPE)
- **Theme switcher in Settings** — Allow users to choose the app theme (e.g., other Catppuccin variants). New capability — its own phase.
</user_constraints>

---

## Summary

This phase is a targeted refactoring and polish pass on a complete, working Electron + Svelte 5 desktop app. No new features are added. The work falls into three buckets: (1) four specific, known bugs to fix; (2) component structure cleanup to reduce duplication; (3) minor visual inconsistencies discovered during the audit.

The codebase has been read in full. The bugs are well-understood. The root causes are clear from code inspection and do not require external research. This phase is almost entirely driven by reading the existing source, not by researching new libraries or APIs. All fixes use only what is already in the project: Svelte 5 `$state` / `$props` / `$effect`, CSS flexbox, and the existing component hierarchy.

**Primary recommendation:** Fix all four locked bugs first (they are independent of each other), then perform the structural duplication audit as a second wave.

---

## Existing Codebase Analysis

This is the key input for this phase. External research is minimal because the work is self-contained.

### Component Inventory

| Component | Location | Role |
|-----------|----------|------|
| `App.svelte` | `renderer/src/App.svelte` | Root shell: AppBar + NavRail + mode switcher |
| `AppBar.svelte` | `lib/components/AppBar.svelte` | Top bar, settings nav |
| `NavRail.svelte` | `lib/components/NavRail.svelte` | Left mode selector |
| `OperationLayout.svelte` | `lib/components/OperationLayout.svelte` | Shared shell: inputs slot + actions slot + progress + ResultsSummary |
| `ResultsSummary.svelte` | `lib/components/ResultsSummary.svelte` | Error/success panel + Reset button + Open Folder button |
| `FileInput.svelte` | `lib/components/FileInput.svelte` | Drop zone / file info — single-file modes |
| `ProgressSpinner.svelte` | `lib/components/ProgressSpinner.svelte` | Indeterminate spinner |
| `ExtractMode.svelte` | `lib/components/modes/ExtractMode.svelte` | Extract Pages |
| `SplitMode.svelte` | `lib/components/modes/SplitMode.svelte` | Split PDF |
| `MergeMode.svelte` | `lib/components/modes/MergeMode.svelte` | Merge PDFs (no FileInput — custom multi-file list) |
| `ConvertMode.svelte` | `lib/components/modes/ConvertMode.svelte` | Convert to Images + Review workflow |
| `SettingsMode.svelte` | `lib/components/modes/SettingsMode.svelte` | Settings page |
| `app.svelte.ts` | `lib/stores/app.svelte.ts` | Global state: `appState`, `settingsState` |

### Layout Architecture

```
App.svelte
  .shell  (display: flex; flex-direction: column; height: 100vh)
    AppBar               (height: 40px; --app-bar-height)
    .body                (display: flex; flex: 1; overflow: hidden)
      NavRail            (width: 56px; --nav-rail-width)
      main.content       (flex: 1; overflow-y: auto; padding: 24px; background: --color-bg)
        {current mode}
```

The `.content` element has `overflow-y: auto` — it is the scroll container for all mode views.

---

## Bug Analysis (Root Causes from Code Inspection)

### Bug 1: ResultsSummary Layout (Overflow / Covering)

**Root cause — double analysis:**

In `OperationLayout.svelte`, `ResultsSummary` is placed inside `.results-area` which has no height constraint and no `overflow` setting:

```svelte
<!-- OperationLayout.svelte -->
<div class="operation-layout">
  <div class="inputs-area">...</div>
  <div class="actions-area">...</div>
  {#if isProcessing}<div class="progress-area">...</div>{/if}
  <div class="results-area">         <!-- no overflow, no flex control -->
    <ResultsSummary ... />
  </div>
</div>

<style>
  .operation-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    height: 100%;          /* wants to fill parent */
    overflow-y: auto;      /* can scroll */
  }
  .results-area {
    display: flex;
    flex-direction: column; /* no min-height: 0, no flex: 1, no overflow */
  }
```

The `.operation-layout` itself has `height: 100%` + `overflow-y: auto` which should work — but the outer scroll container is `main.content` in App.svelte, which also has `overflow-y: auto`. Having two nested scroll containers both with `overflow-y: auto` and height-fill layouts causes the inner one to expand past its allotted space.

In **ConvertMode** specifically, the problem is worse because the results section is rendered *outside* of `OperationLayout` entirely — it lives in its own `.convert-results` div at the bottom of the `.mode-view` column. The `.mode-view` is `display: flex; flex-direction: column; height: 100%` but has no `overflow: hidden`, so when `.convert-results` grows (many output files), it pushes past the viewport boundary and the outer `main.content` scroll picks it up — but because `ConvertMode` renders a progress section and results section outside OperationLayout, the internal OperationLayout height calculation breaks.

**Fix approach:**
- Remove `height: 100%` from `.operation-layout` — it fights with the natural flex-column scroll model
- In `ConvertMode`, move the results section inside `OperationLayout` (or give `.mode-view` `overflow-y: auto` and `flex: 1` so it scrolls internally without fighting the shell)
- The `file-list` in `ConvertMode`'s results already has `max-height: 280px; overflow-y: auto` — this is good; the outer container just needs to not overflow the viewport
- Simplest approach: make `.mode-view` in ConvertMode `flex: 1; overflow-y: auto; min-height: 0` so it owns its own scroll region

**Confidence:** HIGH (code-verified)

---

### Bug 2: Reset Button Consolidation

**Current state:**

`ResultsSummary.svelte` contains its own Reset button (line 52–54):
```svelte
<button class="btn btn-reset" onclick={onReset}>
  Reset
</button>
```

This button is always rendered unconditionally (per a Phase 2 locked decision, now superseded by Phase 5 decision). It sits *inside* the shared `ResultsSummary` component, which is rendered by `OperationLayout` for Extract, Split, and Merge.

For **ConvertMode**, the results section is custom (outside OperationLayout), so ConvertMode has its own Reset button at line 290:
```svelte
<button class="btn btn-reset" onclick={reset}>Reset</button>
```

**Fix approach:**
- Remove the Reset button from `ResultsSummary.svelte` entirely
- Each mode view is responsible for rendering one Reset button in its own `{#snippet actions()}` block (alongside the Execute button), or at a consistent position in the mode layout
- The Reset button should be visible at all times (not only after an operation), positioned with the Execute button in the actions area
- This naturally implements "one reset button per view"

**Confidence:** HIGH (code-verified)

---

### Bug 3: Reset Should Unload the PDF

**Current state:**

Every mode's `reset()` function clears mode-local state but does NOT clear `appState.currentFile`:

```typescript
// ExtractMode.svelte reset()
function reset() {
  pageRangeInput = ''
  operationResult = null
  // appState.currentFile is NOT cleared
}

// SplitMode.svelte reset()
function reset() {
  splitMode = 'parts'
  splitValue = 2
  operationResult = null
  // appState.currentFile is NOT cleared
}

// ConvertMode.svelte reset()
function reset() {
  format = 'png'
  dpi = 96
  // ... all local state ...
  // appState.currentFile is NOT cleared
}
```

**Fix approach:**
- In each mode's `reset()` function, add `appState.currentFile = null`
- This is a one-line fix per mode — simple and low-risk
- MergeMode doesn't use `appState.currentFile` (it has its own `files` array), so MergeMode's reset correctly only needs to clear `files`

**Confidence:** HIGH (code-verified)

---

### Bug 4: FileInput Height Consistency

**Current state:**

`FileInput.svelte` renders two mutually exclusive layouts:
- When `appState.currentFile` is set: renders `.file-info` (a compact single-line row with padding `12px 16px`)
- When no file: renders `.drop-zone` with `padding: 32px 24px` (tall drop target)
- When loading: renders `.loading-text` inside `.drop-zone` (same tall height as drop zone)

The height difference between the loaded state and the empty state is significant — the compact `.file-info` row is roughly 48px tall, while the `.drop-zone` with `padding: 32px 24px` plus SVG plus text is roughly 130px tall.

**Fix approach (Claude's discretion):**

Option A — `min-height` on `.file-input-area`:
```css
.file-input-area {
  min-height: 96px; /* or some fixed value */
}
```
This prevents collapse but doesn't prevent the loaded state from being smaller than the empty state.

Option B — Fixed height on both `.drop-zone` and `.file-info`:
```css
.drop-zone,
.file-info {
  min-height: 80px; /* same value for both */
  height: 80px;
}
```
Forces both to the same height. Simple and deterministic.

**Recommended approach — Option B (fixed height + flex centering):**
Set a consistent `min-height` (e.g., `80px`) on both `.drop-zone` and `.file-info`. Both already use flex/centering internally, so the content will sit centered at any height. This is the simplest, most stable solution and matches what the user described: "FileInput should feel stable and fixed."

The loading state (`.loading-text` inside `.drop-zone`) will inherit the drop-zone height automatically.

**Confidence:** HIGH

---

## Duplication Audit

### Finding 1: `OperationResult` Interface Redeclared in Every Mode

The `OperationResult` interface is defined locally in four files:
- `ResultsSummary.svelte` (lines 4–9)
- `OperationLayout.svelte` (lines 5–10)
- `ExtractMode.svelte` (lines 8–13)
- `SplitMode.svelte` (lines 7–12)
- `MergeMode.svelte` (lines 8–13)

`ConvertMode` doesn't use it (custom results) but defines analogous fields inline.

**Fix:** Extract to `lib/types/index.ts` or `lib/types/operation.ts`. Import in all consumers. Eliminates 5 copies of the same interface.

Note: Per the existing architectural decision, "renderer TypeScript does not import from main/preload" — this type lives in renderer/lib/types only, which is fine.

### Finding 2: `.btn-primary` CSS Duplicated Across Every Mode

Every mode component defines its own `.btn-primary` style block. They are nearly identical (same values, slight variations in padding: `7px 18px` in Extract vs `8px 20px` in Split/Convert):

| Mode | `.btn-primary` padding |
|------|----------------------|
| ExtractMode | `7px 18px` |
| SplitMode | `8px 20px` |
| ConvertMode | `8px 20px` (outer), `6px 14px` (sm variant) |
| MergeMode | `6px 18px` |

**Fix:** These are scoped Svelte styles — they do NOT cascade to children. There is no single shared button CSS in the project. The right fix is to add a global `.btn-primary` rule to `app.css` (already has global base styles) and remove local redefinitions. Or, extract a `Button.svelte` component — but that may be more than needed for this phase. At minimum, standardize padding to one value across all modes.

### Finding 3: Mode Switch Effect Repeated in Every Mode

Every mode that uses `OperationLayout` clears its result when navigating away:

```typescript
// ExtractMode, SplitMode, ConvertMode, MergeMode — all have this:
$effect(() => {
  if (appState.currentMode !== 'extract') {  // or 'split', 'convert', 'merge'
    operationResult = null
  }
})
```

**Assessment:** This is hard to extract meaningfully without a component-level lifecycle hook or a store-based pattern. Each mode needs to clear its own state. The duplication is structural (each mode owns its own state) — refactoring this has low ROI. Leave as-is.

### Finding 4: `.mode-title` CSS Duplicated Across All Modes

Every mode (Extract, Split, Merge, Convert, Settings) defines:

```css
.mode-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  padding: 20px 20px 0;
  margin: 0;
}
```

**Fix:** Move to `app.css` as a global rule. Since `.mode-title` is a class name that only appears in mode components, it is safe to globalize. This eliminates 5 near-identical CSS blocks.

### Finding 5: Segmented Button Pattern Duplicated (Split + Convert)

`SplitMode` defines `.mode-selector` + `.mode-btn` for its by-parts/by-maxPages toggle.
`ConvertMode` defines `.format-selector` + `.mode-btn` for PNG/JPEG toggle, and `.dpi-selector` + `.dpi-btn` for DPI presets.

The CSS for `.mode-btn` is identical between SplitMode and ConvertMode. The `.dpi-btn` is a variant with `flex-direction: column`.

**Fix:** Extract a `SegmentedControl.svelte` component that accepts options, selected value, and onSelect callback. This removes 40+ lines of repeated CSS. This is the highest-value refactor for this phase.

**Or simpler:** Move `.mode-btn` CSS to app.css as a shared global class. Svelte scoping means local styles don't cross component boundaries, so a global class is the practical approach here without creating a new component.

---

## Architecture Patterns

### Svelte 5 `$props()` for Reset Callback (current pattern)

Reset flows as a prop through `OperationLayout → ResultsSummary`. After removing the Reset button from `ResultsSummary`, `onReset` prop in `ResultsSummary` can be removed entirely (the prop was only used to wire the Reset button). `OperationLayout` should still accept `onReset` and pass it to whatever renders the Reset button — or the Reset button simply moves to the mode's `actions` snippet.

**Recommended pattern for Reset button placement:**

```svelte
<!-- In each mode's actions snippet -->
{#snippet actions()}
  <button class="btn-primary" onclick={execute} disabled={...}>Execute</button>
  <button class="btn-reset" onclick={reset}>Reset</button>
{/snippet}
```

This is the cleanest approach. The mode owns its actions. `ResultsSummary` becomes display-only (no Reset button). `OperationLayout`'s `onReset` prop can be removed.

### `appState.currentFile = null` Is Safe

`appState` is a `$state({})` object exported from the store. Setting `.currentFile = null` from a mode's `reset()` function correctly propagates to all consumers (FileInput, mode buttons) because Svelte 5 tracks property reads on `$state` objects. Verified against the stored architectural decision: "appState exported as $state({}) object — exported $state primitives are read-only from importers in Svelte 5; object reference allows mutations to propagate."

### CSS Global vs. Scoped — The Svelte Scoping Trap

Svelte scopes `<style>` blocks to the component by adding a unique class (e.g., `svelte-abc123`) to elements. This means:
- A `.btn-primary` rule in `app.css` (global) applies to all elements with that class
- A `.btn-primary` rule in `SplitMode.svelte` ONLY applies to elements inside SplitMode
- If you add `.btn-primary` to `app.css` AND keep it in individual modes, the scoped version wins for those components (higher specificity from the generated scope class)
- Correct migration: add to `app.css`, remove from individual mode `<style>` blocks

---

## Standard Stack

No new libraries needed. All fixes use existing project dependencies.

| Tech | Already in Project | Use in Phase 5 |
|------|--------------------|----------------|
| Svelte 5 `$state`, `$props`, `$effect` | Yes | Reset propagation, state clearing |
| CSS flexbox + `min-height` | Yes | FileInput height fix |
| CSS custom properties (Catppuccin vars) | Yes | Button standardization |
| TypeScript interfaces | Yes | Extract `OperationResult` type |

**Installation:** Nothing new to install.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared button styles | A Button.svelte component | Global CSS class in app.css | Lower complexity; Svelte scoping means a component doesn't solve the cross-mode CSS problem automatically |
| Type sharing across processes | Types in preload or main | Types in renderer/lib/types | Renderer TS cannot import from main/preload (process boundary) |

---

## Common Pitfalls

### Pitfall 1: Svelte Style Scoping — Global vs. Component

**What goes wrong:** Developer adds `.btn-primary` to `app.css` to unify styles, but forgets to remove the local definitions. The local scoped rule now has higher specificity (Svelte adds `[svelte-hash]` attribute selector), overriding the global. Result: global rule does nothing.

**How to avoid:** When moving a style to global, delete it from every component `<style>` block. Test by inspecting the element in DevTools to confirm no `svelte-*` attribute is on the element's computed styles for that rule.

### Pitfall 2: `overflow-y: auto` on Nested Flex Children Without `min-height: 0`

**What goes wrong:** A flex child with `overflow-y: auto` does not clip its content — it expands to fit content instead. This is because flex items default to `min-height: auto` (respect content size). The overflow only kicks in when the item is explicitly constrained.

**How to avoid:** Set `min-height: 0` on any flex child that should scroll rather than expand. Apply alongside `flex: 1` and `overflow-y: auto`.

```css
/* Correct pattern for a scrolling flex child */
.scrollable-child {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

This is the fix needed for ConvertMode's layout.

### Pitfall 3: Removing `onReset` Prop from ResultsSummary — OperationLayout Update Required

**What goes wrong:** If the Reset button is removed from `ResultsSummary` but `OperationLayout` still passes `onReset` to `ResultsSummary`, TypeScript will warn about an unused prop but won't break at runtime. However, if `onReset` is removed from `ResultsSummary`'s `$props()` definition, all call sites in `OperationLayout` must be updated too.

**How to avoid:** Update both files together in the same task. Check all pass-through sites: `OperationLayout` receives `onReset` from mode → passes it to `ResultsSummary`. After the refactor, `ResultsSummary` no longer needs `onReset`; `OperationLayout` may keep `onReset` in its props (for use by actions snippet) or can also drop it if the mode handles Reset entirely in the actions snippet.

### Pitfall 4: Clearing `appState.currentFile` Affects All Modes

**What goes wrong:** `appState.currentFile` is global (shared store). When a user clicks Reset in Extract mode, it clears the file — which is correct. But the same file was previously loaded in Split mode (for example) if the user had navigated without resetting. This is the intended behavior per the decision ("return mode to fully blank state"), but it's worth noting that resetting one mode now affects what FileInput shows if the user navigates to another mode before loading a new file.

**This is correct behavior** — Reset means "start over entirely." Document in comments.

### Pitfall 5: ConvertMode's Custom Results Section

**What goes wrong:** ConvertMode bypasses `OperationLayout` for its results — it renders its own `.convert-results` div outside the OperationLayout. This means the ResultsSummary refactor (removing the Reset button from ResultsSummary) doesn't affect ConvertMode directly. But ConvertMode has its own inline Reset button that also needs to be reconciled.

**How to avoid:** Treat ConvertMode as a special case in the Reset consolidation task. The Reset button in ConvertMode's `.convert-results` block must be removed, and a single Reset button placed in ConvertMode's actions area (which is inside the OperationLayout at the top of the form).

---

## Code Examples

### Fix: min-height: 0 Pattern for Scrollable Flex Child

```css
/* ConvertMode: make .mode-view scroll internally */
.mode-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;        /* allows flex child to shrink below content height */
  overflow-y: auto;     /* scrolls when content exceeds available height */
}
```

### Fix: FileInput Consistent Height

```css
/* FileInput.svelte — both states get the same height */
.drop-zone,
.file-info {
  min-height: 80px;    /* stable regardless of content */
  /* existing: display flex, align-items center, justify-content center */
}
```

### Fix: Reset Clears File

```typescript
// In every mode's reset() function — add this line:
function reset() {
  // ... existing local state clears ...
  appState.currentFile = null  // returns to blank state per Phase 5 decision
}
```

### Fix: Remove Reset from ResultsSummary

Before (ResultsSummary.svelte):
```svelte
<div class="results-summary">
  {#if result?.error}...{/if}
  {#if result?.outputFiles}...{/if}
  <button class="btn btn-reset" onclick={onReset}>Reset</button>  <!-- REMOVE -->
</div>
```

After:
```svelte
<div class="results-summary">
  {#if result?.error}...{/if}
  {#if result?.outputFiles}...{/if}
  <!-- Reset moved to mode's actions snippet -->
</div>
```

### Fix: Single Reset Button in Mode Actions

```svelte
<!-- ExtractMode, SplitMode, MergeMode — in {#snippet actions()} -->
{#snippet actions()}
  <button class="btn-primary" onclick={execute} disabled={...}>Extract</button>
  <button class="btn-reset" onclick={reset}>Reset</button>
{/snippet}
```

### Extract: Shared OperationResult Type

```typescript
// New file: src/renderer/src/lib/types/operation.ts
export interface OperationResult {
  outputFiles?: string[]
  outputFolder?: string
  error?: { cause: string; fix: string }
}
```

---

## State of the Art

No new library patterns or version-specific findings apply here. All fixes use Svelte 5 reactive primitives and CSS that is already in use throughout the project.

| Pattern | Current Usage | Correct? | Notes |
|---------|--------------|----------|-------|
| `$state({})` for shared store | `app.svelte.ts` | Yes | Mutations propagate correctly |
| Svelte snippets (`{#snippet}`) | OperationLayout | Yes | Actions/inputs pattern is sound |
| `min-height: 0` on flex children | Not currently used | Missing | Needed for scroll containment |
| Scoped styles per component | All components | Correct | No leakage across components |

---

## Open Questions

1. **Should `OperationLayout` keep the `onReset` prop after removing Reset from ResultsSummary?**
   - What we know: If Reset moves to each mode's actions snippet, OperationLayout no longer needs to propagate `onReset` to ResultsSummary.
   - What's unclear: Is there any other use of `onReset` in OperationLayout?
   - Recommendation: After removing from ResultsSummary, check if OperationLayout still uses `onReset` for anything. If not, remove the prop from OperationLayout too. This simplifies the API.

2. **Should segmented button CSS be extracted to `app.css` or to a `SegmentedControl.svelte` component?**
   - What we know: The segmented button pattern appears in SplitMode (text toggle) and ConvertMode (PNG/JPEG toggle + DPI toggle). CSS is nearly identical.
   - What's unclear: How much of Claude's discretion budget to spend on this.
   - Recommendation: Move `.mode-btn` CSS to `app.css` as a global class. Simpler than a new component. Leave `.dpi-btn` (the two-line variant) as a ConvertMode-local style since it is only used there.

3. **Does `ConvertMode`'s `.mode-view` height fix affect the review workflow layout?**
   - What we know: The review container (`reviewState === 'reviewing'`) uses `height: 100%` on `.review-container` and `flex: 1` on `.review-image-area`. This is separate from the form state.
   - Recommendation: Verify after applying the form layout fix that the reviewing and complete states still render correctly. The fix should be additive — `min-height: 0` and `overflow-y: auto` on `.mode-view` will be inherited by `.review-container` only if `.mode-view` is the scroll root, which is fine.

---

## Sources

### Primary (HIGH confidence)

- Codebase direct inspection — all source files read in full:
  - `src/renderer/src/lib/components/ResultsSummary.svelte`
  - `src/renderer/src/lib/components/FileInput.svelte`
  - `src/renderer/src/lib/components/OperationLayout.svelte`
  - `src/renderer/src/lib/components/modes/ConvertMode.svelte`
  - `src/renderer/src/lib/components/modes/ExtractMode.svelte`
  - `src/renderer/src/lib/components/modes/SplitMode.svelte`
  - `src/renderer/src/lib/components/modes/MergeMode.svelte`
  - `src/renderer/src/lib/components/modes/SettingsMode.svelte`
  - `src/renderer/src/lib/stores/app.svelte.ts`
  - `src/renderer/src/App.svelte`
  - `src/renderer/src/assets/app.css`
- Svelte 5 documented behavior: `$state({})` object exports allow mutation propagation (verified against project's own architectural decisions in STATE.md)
- CSS flexbox `min-height: 0` behavior: well-known spec behavior for flex items (MDN-documented; HIGH confidence from training + multiple verifiable sources)

### Secondary (MEDIUM confidence)

- Svelte scoping mechanism (generated attribute selectors) — training data + consistent with observed project behavior

---

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH — all bugs diagnosed from direct code inspection
- Fix approaches: HIGH — all fixes use patterns already present in the project
- Duplication audit: HIGH — based on full source read
- CSS/Svelte behavior: HIGH — well-established behavior

**Research date:** 2026-02-24
**Valid until:** This research is codebase-specific; valid until the source files change. Not time-sensitive re: external library versions.
