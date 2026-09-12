# Frontend static hardening — 2026-09-12

Status: **STATIC / CI-VERIFIED HARDENING — RENDERED UX CLOSURE STILL PENDING**

This note records the code-side frontend hardening completed after the first product-visual cleanup. It deliberately does not claim that the UX/product-validation checkpoint is closed: representative rendered desktop/mobile walkthroughs on the real local runtime remain required.

## Scope completed

- The approved Fraunces, Manrope, and IBM Plex Mono families are now loaded by the Next app shell and wired into the existing design-token font variables.
- Theme selection reuses the shared storage helper so blocked or throwing `localStorage` cannot crash the product navigation.
- Settings response handling preserves useful HTTP failures when a backend returns empty or non-JSON content instead of masking them as JSON parser errors.
- Space exposes an explicit keyboard-focusable block inspector action in addition to pointer selection, and its selected inspector action has a visible active state.
- Operations fetch failures use an alert semantic and redundant decorative copy was removed.
- Flow async UI actions report network/runtime rejections instead of leaving unhandled rejected promises, and run polling surfaces refresh failures rather than silently leaving stale execution state.
- Flow palette nodes can be added by click/keyboard as well as drag, so adding nodes is not dependent on desktop HTML drag-and-drop.
- Flow responsive layout stacks palette, canvas, and inspector at narrower widths; horizontal overflow is constrained to the canvas instead of forcing the entire product shell to scroll sideways.
- Mobile chat composer accounts for safe-area bottom inset and uses a larger send target; compact theme controls receive larger touch targets.

## Bugs addressed

1. Approved typography names existed in CSS but were not actually loaded by the production app.
2. Product navigation could throw while reading browser storage in restricted/private contexts.
3. Settings could replace the real HTTP error with a JSON parsing exception.
4. Space block selection was effectively pointer-first because the containing article was clickable but not keyboard interactive.
5. Flow network failures from Save/Load/Run/approval/input paths could escape as unhandled promise rejections.
6. Flow run polling could fail silently and leave stale status on screen.
7. Flow palette creation depended on drag-and-drop, which is unreliable for keyboard and touch users.
8. Narrow Flow layouts horizontally scrolled the whole three-column workspace rather than isolating canvas overflow.
9. The chat composer did not account for mobile safe-area bottom inset.

## Verification discipline

The static-hardening claim is valid only at an exact branch head where the normal repository CI completes successfully. Temporary patch/format workflows are implementation aids only and are not accepted as verification evidence; they must not remain in the final diff.

## Claim boundary

This checkpoint proves only code review plus repository CI for the hardened frontend. It does not prove final visual quality, actual browser layout on the operator laptop, real local-model interaction, or end-to-end desktop/mobile UX. Those claims remain gated on the real rendered UX walkthrough defined by `docs/ux-product-validation.md`.
