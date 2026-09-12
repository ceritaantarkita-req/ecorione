# Frontend static hardening — 2026-09-12

Status: **STATIC / CI-VERIFIED HARDENING COMPLETE — RENDERED UX CLOSURE STILL PENDING**

This note records the completed code-side frontend hardening before the local rendered UX/product walkthrough. It deliberately does not claim that the UX/product-validation checkpoint is closed: representative rendered desktop/mobile walkthroughs on the real local runtime remain required.

## Final code-side baseline

The final static-hardening implementation is merged on `main` at:

```text
63646960da0f4dce946208470eed1c7d6f3068e4
```

The final sequence included:

- PR #56 — typography, browser-storage resilience, safer Settings error handling, keyboard/touch accessibility and responsive Flow/chat hardening;
- PR #58 — Flow async/race/error-state hardening, Operations loading/refresh correctness, and explicit theme-control grouping;
- PR #59 — Settings mutation serialization/pending feedback and two-step destructive Space block deletion;
- PR #60 — same-frame Ai send/forget request locks, stale Space page-response suppression, duplicate page-create protection, and destructive-confirmation reset on selection change.

## Scope completed

- The approved Fraunces, Manrope, and IBM Plex Mono families are loaded by the Next app shell and wired into the existing design-token font variables.
- Theme selection reuses the shared storage helper so blocked or throwing `localStorage` cannot crash product navigation.
- Theme controls expose an explicit grouped-control semantic.
- Settings response handling preserves useful HTTP failures when a backend returns empty or non-JSON content instead of masking them as JSON parser errors.
- Settings runtime, credential, canary, and MCP mutation actions are serialized while one control action is in flight, with visible pending labels.
- Space exposes an explicit keyboard-focusable block inspector action in addition to pointer selection, and its selected inspector action has a visible active state.
- Space block deletion requires an in-product two-step confirmation and clears the armed confirmation when selection changes or deletion succeeds.
- Space page creation has a synchronous in-flight guard and visible `Creating…` state.
- Space page loading rejects stale out-of-order responses so an older request cannot replace the currently selected page document.
- Operations fetch failures use alert semantics; its first render shows `Loading`/`—` instead of falsely reporting `Degraded` and zero metrics.
- Operations auto/manual refreshes cannot overlap.
- Flow async UI actions report network/runtime rejections instead of leaving unhandled rejected promises.
- Flow run polling and version loading surface HTTP/malformed-response failures rather than silently keeping stale state.
- Flow Run start and approval/rejection/human-input actions are protected against duplicate in-flight submissions.
- Flow status updates are exposed through a live status region.
- Flow palette nodes can be added by click/keyboard as well as drag, so node creation is not dependent on desktop HTML drag-and-drop.
- Flow responsive layout stacks palette, canvas, and inspector at narrower widths; horizontal overflow is constrained to the canvas instead of forcing the entire product shell sideways.
- Mobile chat composer accounts for safe-area bottom inset and uses a larger send target; compact theme controls receive larger touch targets.
- Ai chat send and forget handlers now use synchronous request refs in addition to React state so same-frame repeated events cannot dispatch duplicate requests.

## Bugs addressed

The static sequence closed code-visible defects in these categories:

1. approved typography names existed in CSS but were not actually loaded by the production app;
2. product navigation could throw while reading browser storage in restricted/private contexts;
3. Settings could replace the real HTTP error with a JSON parser exception;
4. Space block selection was effectively pointer-first;
5. Space destructive deletion had no confirmation boundary;
6. Space page/create interactions could accept duplicate or stale requests;
7. Flow network failures from Save/Load/Run/approval/input paths could escape or leave stale state;
8. Flow run polling/version refresh could fail silently;
9. Flow Run and node signals could be repeated while the previous request was still in flight;
10. Flow palette creation depended on drag-and-drop and narrow layouts could create whole-shell horizontal scroll traps;
11. Operations initially reported misleading degraded/zero state and allowed overlapping refreshes;
12. Settings mutation buttons could issue repeated credential/runtime/MCP/canary actions before React state reflected completion;
13. Ai chat/forget handlers could accept a second same-frame event before `sending`/`forgettingId` re-rendered;
14. the chat composer did not account for mobile safe-area bottom inset.

## Verification

The final hardening chain passed normal repository CI at exact PR heads and again after merge. The relevant final runs were:

```text
PR #58 exact head CI      34675746055  PASS
PR #58 post-merge main    34675844251  PASS
PR #59 exact head CI      34675999218  PASS
PR #59 post-merge main    34676117850  PASS
PR #60 exact head CI      34677400306  PASS
PR #60 post-merge main    34677516183  PASS
```

Each normal CI verification completed the repository gates, including Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production operations acceptance, Secret scan, and Production build. Temporary patch/format workflows were implementation aids only and were removed from the final diffs.

## Remaining runtime gate

Static/code-side frontend hardening is complete. The UX/product checkpoint still requires the real local rendered procedure in `docs/ux-product-validation.md`, including:

- synchronized clean `main` on the final merged revision;
- Phase 4 restarted on that revision with `ECORIONE_COST_KILL_SWITCH=1`;
- `pnpm evidence:ux:inventory` PASS;
- real browser desktop and narrow/mobile walkthroughs;
- local chat continuity/memory/routing checks;
- Space, Flow, Operations, and Settings journey checks;
- browser console capture and a severity/disposition defect ledger.

## Claim boundary

This checkpoint proves code review plus repository CI for the hardened frontend through `63646960da0f4dce946208470eed1c7d6f3068e4`. It does not prove final visual quality, actual browser layout on the operator laptop, local-model UX correctness in a real browser session, all device/browser combinations, or end-to-end desktop/mobile UX. Those claims remain gated on the rendered walkthrough defined by `docs/ux-product-validation.md`.
