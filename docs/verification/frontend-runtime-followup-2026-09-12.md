# Frontend Runtime Follow-up — 2026-09-12

Status: **REPOSITORY-SIDE HARDENING ONLY — REAL BROWSER CLOSURE STILL PENDING**

Baseline audited: `b3dbab0706c6faa7e2caede1199271bce8489ebe`.

This follow-up was performed while the operator kept the real-laptop UX walkthrough running on that exact synchronized baseline. The work therefore stays on a separate branch and must not advance `main` until the current browser evidence batch is complete.

## Scope

The follow-up re-audited the remaining UX-09..UX-12 risk areas that can be reasoned about from repository source without replacing the required rendered walkthrough:

- Space rapid page switching, duplicate creation, loading/error recovery and narrow layout;
- Flow dirty-state/run gating, stale validation, concurrent actions and narrow layout;
- global navigation behavior on narrow screens;
- browser-console findings observed during the real-laptop walkthrough;
- the missing favicon resource reported by Chrome.

## Findings

### Space

The Space client already contains explicit repository-side race protection for the core UX-09 path:

- `createPageInFlightRef` blocks duplicate create submission before React state can repaint;
- `pageRequestRef` invalidates older page loads;
- `selectedPageIdRef` prevents a late response for page A from replacing page B after a rapid selection change;
- page and mutation state reset selected-block/deletion/resolution state when the active page changes;
- failed mutations release their in-flight guard in `finally`, leaving the surface recoverable.

The rendered UX-09 rapid-switch behavior still requires operator verification because deterministic source guards do not prove browser presentation, timing, focus, or visual state.

### Flow

The Flow client already contains the main repository-side UX-10 safety contracts:

- every applied draft edit increments `draftRevisionRef`, marks the draft dirty and clears prior validation;
- validation captures the draft revision and discards a response when the draft changed while validation was in flight;
- save also captures the draft revision and marks the draft clean only when that same revision is still current; if the user edits during save, the response does not overwrite the newer draft and the UI explicitly asks for another save before Run;
- Run refuses an unsaved graph or dirty draft; the rendered Run button is disabled for those states, while a saved draft may be validated on demand by `runGraph` before execution;
- `runInFlightRef`, `validationInFlightRef` and the general busy guard prevent overlapping mutations/actions.

The real browser must still exercise edit/save/validate/run ordering before UX-10 can close.

### Error/recovery

Flow already surfaces an explicit invalid-config message (`Config harus JSON valid.`) and invalid operations release action guards. Space catches invalid block/inspector JSON and surfaces the parser/API error through the visible error state while releasing its mutation guard. This is structural support only; UX-11 still requires the planned safe invalid-input browser test to confirm that the message is understandable and that the user can immediately recover without reload/restart.

### Narrow layout

Static CSS review found existing narrow fallbacks rather than a new source-provable page-level overflow defect:

- Space collapses to one column at `max-width: 760px`;
- Flow collapses to one column at `max-width: 760px` and keeps the canvas itself intentionally scrollable;
- Operations reduces its service grid to one column at `max-width: 760px`;
- Settings collapses its form grid and inline controls at `max-width: 720px`;
- global navigation preserves a `min-width: 0` scrollable product-link row and switches to its narrower chrome at `max-width: 780px` instead of forcing page-level overflow.

The operator's 430px screenshots are useful partial evidence, but UX-12 remains pending the explicit ~390px rendered check.

### Console attribution

Repository search found no `sw.js` registration/reference and no `reportAllChanges` source. The `VM... startTime` / filesystem stack observed in DevTools is therefore not attributed to ecorione application source from current evidence. It remains browser/extension/DevTools noise unless a clean-console reproduction ties it to an ecorione bundle.

Chrome's `GET /favicon.ico 404`, by contrast, is an application-owned S3 finding. This branch adds a deterministic `/favicon.ico` route that serves the ecorione seal as SVG with a cacheable response, plus a direct route regression test.

## Added regression coverage

`test/frontend-runtime-ux-guards.test.mjs` locks the source contracts that materially support UX-09, UX-10 and UX-12:

- Space stale-request and duplicate-create guards;
- Flow draft revision, stale-validation, stale-save and dirty-draft Run guards;
- Space/Flow/Operations/Settings narrow breakpoints;
- intentional Flow canvas scrolling;
- narrow global-nav scrolling and `min-width: 0` containment.

These tests are deterministic regression guards, not substitutes for real rendered evidence.

## Claim boundary

This branch does **not** close UX-08, UX-09, UX-10, UX-11 or UX-12. It does not claim that a 390px browser has been verified, and it does not begin immutable local model identity work.

After the operator finishes the current `b3dbab0...` walkthrough batch, this branch can be reviewed/merged, the laptop synchronized to the then-current `origin/main`, Phase 4 restarted, inventory rerun, and the affected favicon/console plus final responsive checks re-verified on merged code.
