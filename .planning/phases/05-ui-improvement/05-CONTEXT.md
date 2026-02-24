# Phase 5: UI Improvement - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual polish and code quality improvements to the existing, fully-functional app. All modes (Extract, Split, Merge, Convert, Settings) are working — this phase refines what's been built. No new capabilities are added here.

</domain>

<decisions>
## Implementation Decisions

### Phase character
- Genuinely both visual polish AND code quality — they go hand in hand
- Primary code concern: component structure (duplicated logic, inconsistent patterns between modes)

### Bug fixes (known, specific)
1. **ResultsSummary layout** — The output summary box is poorly positioned; when it grows it covers other components and causes overflow in the main body. This is most severe in the Convert to Images view. Fix the layout so ResultsSummary grows within its allocated space without covering sibling components.
2. **Reset button consolidation** — ResultsSummary currently has its own Reset button. Remove it. Each mode view should have exactly ONE reset button that resets everything in that view.
3. **Reset should unload the PDF** — Currently, clicking Reset does not clear the loaded PDF. Resetting should return the mode to a fully blank state, including unloading the current file.
4. **FileInput height consistency** — The file input box is large when empty but shrinks when a file is loading or loaded. Fix it to a consistent height at all times regardless of state.

### Component structure
- Audit modes for duplicated logic and inconsistent patterns
- Where modes share behavior, extract to shared components or utilities
- Claude has discretion on specific refactors — target the highest-value improvements

### Visual consistency
- Modes are generally consistent; no wholesale redesign needed
- Overflow/positioning fix is scoped primarily to ConvertMode's output summary
- Catppuccin Mocha color palette is working — do not change color usage
- Settings page is satisfactory as-is — minimal changes only

### Claude's Discretion
- Specific component refactors to address structural duplication
- How to implement the consistent FileInput height (CSS approach, min-height, etc.)
- Whether any additional minor visual inconsistencies are worth fixing during the audit

</decisions>

<specifics>
## Specific Ideas

- The output summary growing and covering things is the most visually disruptive bug — prioritize it
- "One reset button per view that affects everything" — the user wants a clear, singular action, not per-component resets scattered around
- FileInput should feel stable and fixed — the layout shouldn't shift based on whether a file is loaded

</specifics>

<deferred>
## Deferred Ideas

- **Theme switcher in Settings** — Allow users to choose the app theme (e.g., other Catppuccin variants). New capability — its own phase.

</deferred>

---

*Phase: 05-ui-improvement*
*Context gathered: 2026-02-24*
