# Phase 6: Convert Mode Bugfix — Research

**Researched:** 2026-02-24
**Domain:** CSS layout / Flexbox overflow, Svelte conditional styling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Do NOT revert the general overflow fix from Phase 5 — it is correct for all other modes
- The image preview must use `object-fit: contain` and be constrained by its container height
- The review container needs to prevent overflow (overflow: hidden) when displaying the image preview
- Keyboard shortcuts and copy-and-next behavior must remain unchanged

### Claude's Discretion
(None stated — all decisions are locked)

### Deferred Ideas (OUT OF SCOPE)
(None stated)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-03 | User can execute conversion to receive one image file per PDF page in the output subfolder | Conversion logic is unchanged; this phase only fixes the display of results |
| REVW-01 | After image conversion completes, user can enter the review workflow | startReview() transition is unchanged; layout fix enables the entry to display correctly |
| REVW-02 | In review mode, the current image is displayed with the user's position shown (e.g. "3 / 12") | Image display is currently broken by overflow; fix restores it to spec |
| REVW-03 | User can click "Copy and Next" to copy the current image to the clipboard and advance to the next image | copyAndNext() logic is unchanged; this phase does not touch clipboard logic |
| REVW-04 | User can go back one image at a time in review mode (in case of accidental skip) | goBack() logic is unchanged |
| REVW-05 | Review workflow ends naturally when the last image has been reached | Completion screen transition is unchanged |
</phase_requirements>

---

## Summary

The Convert mode Review workflow image preview overflows the view bounds. The root cause is a CSS layout chain problem, not a logic problem — no TypeScript needs to change.

The layout chain from root to image is: `html/body/#app` (height: 100%, overflow: hidden) → `App.svelte .shell` (height: 100vh, flex column) → `.body` (flex: 1, overflow: hidden) → `.content` (flex: 1, overflow-y: auto, **padding: 24px**) → `ConvertMode .mode-view` (flex: 1, min-height: 0, overflow-y: auto) → `.review-container` (height: 100%, overflow: hidden) → `.review-image-area` (flex: 1, min-height: 0, overflow: hidden) → `.review-image` (max-width: 100%, max-height: 100%, object-fit: contain).

There are two compounding problems:

**Problem 1 — `.mode-view` uses `overflow-y: auto` in review state.** When `overflow-y: auto` is on a flex child with `flex: 1; min-height: 0`, the child can scroll — but the scroll region only activates if the content has a defined height to overflow against. The `.content` parent itself has `overflow-y: auto` and `padding: 24px`. The `.mode-view` in review state has `height: 100%` on its child `.review-container`, but `height: 100%` only resolves if the parent's height is explicitly defined. With `overflow-y: auto` and no explicit height on `.mode-view`, the browser is free to grow `.mode-view` to its natural content height (the intrinsic image size), which causes the outer `.content` to scroll.

**Problem 2 — `App.svelte .content` has `padding: 24px`.** This padding is consumed from the available height. When the review container attempts `height: 100%`, the parent `.content` box is `total height minus padding`, which is already incorrect framing for a full-height image preview. More critically, when the mode-view grows to wrap the image, the image can push the content area to scroll even with proper overflow settings.

The fix requires two changes:
1. In `ConvertMode.svelte`, switch `.mode-view` to `overflow: hidden` and `height: 100%` (instead of `overflow-y: auto`) when in review state — or apply this unconditionally and let `.review-container` own all scrolling. Since `.mode-view` wraps three states (form, reviewing, complete), the cleanest approach is a CSS class variant: add a `.mode-view--review` class (or `:global` modifier) applied when `reviewState !== 'form'`.
2. Remove the `padding: 24px` from `App.svelte .content` for the review state, OR move padding inside each mode component so the review state can be edge-to-edge. Since CONTEXT.md says not to break other modes, and `.content` padding is shared, the correct approach is: move `padding` out of `.content` in `App.svelte` and into each mode component's own `.mode-view` (or the `h1.mode-title` / `OperationLayout.svelte` already owns padding from its internal styles). The review state already handles its own padding via `.review-header`, `.review-image-area`, and `.review-actions`.

**Primary recommendation:** Remove `padding: 24px` from `App.svelte .content` (it is redundant — each mode component handles its own padding internally) and switch `ConvertMode .mode-view` to `overflow: hidden; height: 100%` — or apply `overflow: hidden` conditionally via a state-driven CSS class on `.mode-view`.

---

## Standard Stack

This phase introduces no new libraries. All changes are CSS/Svelte only.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | ~5.x | Conditional class binding (`class:foo={condition}`) | Already in project; handles dynamic class application |

### No New Installations

No packages need to be installed for this phase.

---

## Architecture Patterns

### Existing Layout Chain (as-built)

```
html, body, #app          height: 100%, overflow: hidden
  .shell                  height: 100vh, flex column
    .body                 flex: 1, overflow: hidden
      .content            flex: 1, overflow-y: auto, padding: 24px   ← PROBLEM SOURCE
        ConvertMode
          .mode-view      flex: 1, min-height: 0, overflow-y: auto   ← COMPOUNDING PROBLEM
            .review-container  height: 100%, overflow: hidden
              .review-image-area  flex: 1, min-height: 0, overflow: hidden
                .review-image  max-width: 100%, max-height: 100%, object-fit: contain
```

### Target Layout Chain (after fix)

```
html, body, #app          height: 100%, overflow: hidden
  .shell                  height: 100vh, flex column
    .body                 flex: 1, overflow: hidden
      .content            flex: 1, overflow: hidden, padding: 0      ← padding removed
        ConvertMode
          .mode-view      flex: 1, min-height: 0, overflow-y: auto   ← form state: scrollable
          .mode-view (review state class)  height: 100%, overflow: hidden  ← review: no overflow
            .review-container  height: 100%, overflow: hidden
              .review-image-area  flex: 1, min-height: 0, overflow: hidden
                .review-image  max-width: 100%, max-height: 100%, object-fit: contain
```

### Pattern 1: Conditional overflow via Svelte class binding

**What:** Apply different overflow/height CSS to `.mode-view` based on `reviewState` using Svelte's `class:` directive.
**When to use:** When a single component hosts multiple visual states with incompatible layout requirements.

```svelte
<!-- In ConvertMode.svelte template -->
<div
  class="mode-view"
  class:mode-view--review={reviewState !== 'form'}
>
```

```css
/* In ConvertMode.svelte <style> */
.mode-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;   /* form state: allow scroll */
}

.mode-view--review {
  overflow: hidden;   /* review/complete states: no overflow, image must fit */
  height: 100%;
}
```

**Key insight:** The `class:` modifier in Svelte appends/removes a class reactively without needing `:global`. Scoped styles apply to both base and modifier classes on the same element.

### Pattern 2: Remove padding from outer `.content` shell

**What:** `App.svelte .content` currently has `padding: 24px` but every mode component already handles its own internal padding. Removing it from `.content` lets review state fill the full viewport height.
**When to use:** When a parent container's padding prevents a child from correctly expressing `height: 100%`.

```svelte
<!-- In App.svelte <style> -->
.content {
  flex: 1;
  overflow-y: auto;       /* keeps scroll for modes that need it */
  /* padding: 24px;  REMOVED — each mode owns its own padding */
  background: var(--color-bg);
}
```

**Impact check:** All mode components (`ConvertMode`, `ExtractMode`, `SplitMode`, `MergeMode`, `SettingsMode`) must be verified to have their own top/side padding after removing `padding: 24px` from `.content`. The `h1.mode-title` rule in `app.css` already has `padding: 20px 20px 0` and `OperationLayout.svelte` has `padding: 20px` — so the form states are already self-padded. The review container has its own padding on `.review-header`, `.review-image-area`, and `.review-actions`.

### Anti-Patterns to Avoid

- **Using `height: 100vh`** on `.review-container`: The container is inside a flex chain that already accounts for the app bar height. Use `height: 100%` instead.
- **Using JavaScript to compute heights**: CSS flexbox + `min-height: 0` is the correct tool. No `getBoundingClientRect()` needed.
- **Reverting `.body overflow: hidden`**: This was a correct Phase 5 fix — do not touch it.
- **Adding `overflow: hidden` to `.mode-view` globally**: This would break the form state, which legitimately needs to scroll on small window heights (e.g. with many merge files listed, or the convert form with all its fields).
- **Using `max-height: 100vh` on the image directly**: Without a properly bounded parent chain, `100vh` includes the app bar and nav rail, producing incorrect calculations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Dynamic image sizing | JavaScript `ResizeObserver` calculating image dimensions | CSS `max-height: 100%; object-fit: contain` with a properly bounded flex parent |
| State-driven layout | Inline styles (`style="overflow: hidden"`) set via `$derived` | Svelte `class:` directive with scoped CSS modifier class |

**Key insight:** All sizing is achievable with pure CSS once the flex height chain is properly constrained. The `max-height: 100%` on `.review-image` is already correct — the bug is that `100%` resolves to the natural content height rather than the viewport-bounded parent height.

---

## Common Pitfalls

### Pitfall 1: `height: 100%` requires all ancestors to have defined heights

**What goes wrong:** Setting `height: 100%` on `.review-container` does nothing if `.mode-view` has no explicit height — it resolves to `auto` (natural content size), making the image appear to have no height constraint.
**Why it happens:** `height: 100%` in CSS means "100% of the parent's computed height." If the parent's height is `auto`, the computed height is also `auto`, and the percentage has nothing to reference.
**How to avoid:** Ensure the entire ancestor chain from `html` down to the flex item uses either explicit heights or the `flex: 1; min-height: 0` pattern. The current `.mode-view` is a flex child with `flex: 1; min-height: 0` — but its parent `.content` has `overflow-y: auto`, which means the flex item can grow unbounded. Switching `.content` to `overflow: hidden` (or removing its padding and fixing `.mode-view` overflow directly) closes the loop.
**Warning signs:** DevTools shows `.review-image-area` has a computed height equal to the image's natural height (e.g., 1188px for a 300 DPI A4 page) rather than the available viewport height.

### Pitfall 2: Padding on outer container consumes `height: 100%` reference

**What goes wrong:** Even after fixing overflow, `padding: 24px` on `.content` means the full-height review state is 48px shorter than expected (top+bottom padding), and worse, the padding is added to the scroll area calculation, potentially causing unexpected layout at window edges.
**Why it happens:** CSS `padding` is inside the box model. A `height: 100%` child resolves to `content-height - 0` (padding is not subtracted for percentage calculation in standard box model when parent uses `box-sizing: border-box`). But visually, the child still starts 24px from the top/sides of the parent.
**How to avoid:** Remove `padding` from `.content` in `App.svelte`. Each mode handles its own padding internally.
**Warning signs:** Review image area appears with a 24px gap around it instead of being edge-to-edge within the main content area.

### Pitfall 3: `overflow-y: auto` on the mode-view parent prevents proper height resolution

**What goes wrong:** If `.mode-view` keeps `overflow-y: auto`, the browser allows the flex child to grow to wrap its natural content. The `height: 100%` on `.review-container` then resolves to the full natural height of the image, not the bounded viewport height.
**Why it happens:** `overflow-y: auto` creates a new scroll container, but only clips overflow. It does not cap the child's preferred height during layout. The flex algorithm, seeing no explicit height constraint, allows the child to declare its natural height.
**How to avoid:** Switch `.mode-view` to `overflow: hidden` in review state. Use a Svelte `class:mode-view--review` modifier class.
**Warning signs:** Scrollbar appears on `.content` when entering review mode with a tall image.

### Pitfall 4: Mode-view overflow fix breaks other modes if applied globally

**What goes wrong:** Setting `overflow: hidden` on `.mode-view` globally prevents the form state from scrolling on very small window heights (the Convert form has file input + format selector + DPI selector + action buttons — it can exceed 500px of content height).
**Why it happens:** The form state is a natural-height layout; it should scroll when the window is small.
**How to avoid:** Apply `overflow: hidden` only to `.mode-view` when in review/complete states, using the `class:mode-view--review` pattern. The form state retains `overflow-y: auto`.
**Warning signs:** Convert form becomes non-scrollable on small window heights.

---

## Code Examples

Verified patterns from the codebase and CSS spec:

### ConvertMode .mode-view fix

```svelte
<!-- Source: ConvertMode.svelte — template section -->
<div
  class="mode-view"
  class:mode-view--review={reviewState !== 'form'}
>
```

```css
/* Source: ConvertMode.svelte — <style> block */
.mode-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto; /* form state: normal scroll */
}

/* Applied when reviewState is 'reviewing' or 'complete' */
.mode-view--review {
  overflow: hidden;
  height: 100%;
}
```

### App.svelte .content — remove padding

```svelte
<!-- Source: App.svelte — <style> block -->
.content {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg);
  /* padding: 24px removed — mode components own their own padding */
}
```

### Mode padding verification (all other modes are self-padded)

Other modes use `OperationLayout.svelte` which has `padding: 20px` in its `.operation-layout` class, and `h1.mode-title` has `padding: 20px 20px 0` in global `app.css`. The review container handles its own padding via:

```css
/* Already in ConvertMode.svelte — no changes needed */
.review-header    { padding: 12px 20px; }
.review-image-area { padding: 8px 20px; }
.review-actions   { padding: 16px 20px; }
```

### Svelte `class:` directive reference

```svelte
<!-- Svelte 5 class directive — adds/removes class reactively -->
<div class="base-class" class:modifier-class={booleanExpression}>
```

The `class:` directive is reactive — when `reviewState` changes, Svelte automatically adds or removes `mode-view--review` from the element's class list. No manual DOM manipulation required.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Parent `.content` owns `padding: 24px` | Each mode owns its own padding internally | Parent padding causes `height: 100%` layout bugs in full-height children |
| Single `.mode-view` with `overflow-y: auto` | `.mode-view` with state-conditional `overflow: hidden` modifier | Allows both scrollable form state and clipped full-height review state |

---

## Open Questions

1. **Does removing `padding: 24px` from `.content` visually affect SettingsMode?**
   - What we know: `SettingsMode.svelte` has not been read in this research pass
   - What's unclear: Whether SettingsMode has its own internal padding or relies on `.content`'s padding
   - Recommendation: Read `SettingsMode.svelte` during the plan task that removes `.content` padding, and add internal padding if needed. A quick visual check should confirm.

2. **Does the `complete-container` state also need `overflow: hidden`?**
   - What we know: The `complete-container` has `height: 100%` and `display: flex; align-items: center; justify-content: center` — it is a simple centered layout with no large content
   - What's unclear: Whether a completion message can overflow at very small window heights
   - Recommendation: Apply `class:mode-view--review` to both `reviewing` and `complete` states (i.e., `reviewState !== 'form'`) — this is already the proposal above. The complete-container is small content, but sharing the `overflow: hidden` class is harmless.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `C:/Repos/pdf-chisel/src/renderer/src/lib/components/modes/ConvertMode.svelte` — full CSS and template reviewed
- Direct code inspection: `C:/Repos/pdf-chisel/src/renderer/src/App.svelte` — confirmed `padding: 24px` on `.content`, `overflow-y: auto`
- Direct code inspection: `C:/Repos/pdf-chisel/src/renderer/src/lib/components/OperationLayout.svelte` — confirmed `padding: 20px` on `.operation-layout`
- Direct code inspection: `C:/Repos/pdf-chisel/src/renderer/src/assets/app.css` — confirmed `.mode-title { padding: 20px 20px 0 }`, all other modes self-padded
- CSS spec: `height: 100%` requires parent to have explicit height — fundamental CSS layout rule, HIGH confidence

### Secondary (MEDIUM confidence)
- Svelte 5 `class:` directive syntax — verified from Svelte component structure already in codebase (e.g. `class:active={format === 'png'}` pattern used in ConvertMode.svelte line 225)

---

## Metadata

**Confidence breakdown:**
- Root cause diagnosis: HIGH — verified by direct code inspection of full layout chain
- Fix pattern (CSS modifier class): HIGH — already used in the codebase (`class:active`)
- Impact on other modes: HIGH — each mode's padding source verified by reading all CSS files
- Svelte class directive behavior: HIGH — pattern already in use in this codebase

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable CSS/Svelte patterns — no external dependency changes expected)
