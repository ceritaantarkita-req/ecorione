# Frontend Static Audit — Final Pre-Runtime Pass

Status: **CODE-SIDE PASS / RENDERED RUNTIME EVIDENCE PENDING**  
Date: **2026-09-12**

This pass is the final repository-side UX hardening before the real local browser walkthrough. It does not claim rendered visual quality.

## Surfaces audited

- Ai chat and memory panel
- global navigation/theme switching
- Space page/block/core-memory workspace
- Flow canvas, validation, versioning and run controls
- Operations telemetry
- Settings/runtime/credential/MCP controls
- Ai proxy/evidence contract and local-only operator boundary

## Defects fixed in this pass

1. **Ai forget success had no local visible confirmation.** The memory panel now reports success/failure and disables all forget buttons while one request is active.
2. **Space could keep the previous page document interactive while a newly selected page was loading.** Page selection now clears the old document synchronously and stale page/list/memory responses are ignored.
3. **Space mutation buttons relied on async React state independently.** Owner-backed block/page/memory mutations are serialized with synchronous refs and mutation controls are disabled while one is in flight.
4. **Flow could validate one draft revision and later display that validation after the draft changed.** Validation is revision-bound; stale validation is discarded.
5. **Flow could run an older persisted version while the visible canvas had unsaved edits.** Dirty state now blocks Run until Save succeeds.
6. **Flow save/load/run/approval/input actions had same-frame duplicate-event windows.** Synchronous in-flight guards now close those windows.
7. **Flow loading a graph whose first node reused the current selected id could leave stale Config JSON in the inspector.** Load now refreshes the config draft explicitly.
8. **Settings fields remained editable during writes, allowing a completing request to overwrite newer local edits (including clearing a newly typed credential).** Mutation-bound fields now lock during writes.
9. **Settings MCP results could arrive for an older workspace after the visible workspace id changed.** Workspace loads are request-sequenced and identity-checked.
10. **Mutable local model identity was technically visible but easy to misread as production-pinned.** Settings now displays an explicit warning for `:latest`/`@latest` aliases.
11. **Operations had ambiguous blank sections when no service/trace rows existed.** Explicit empty states were added.
12. **Mobile theme controls visually replace text with symbols.** Explicit accessible labels were added so hidden visual text does not reduce control naming.
13. **UX inventory only smoke-checked route markers.** It now also requires global navigation on every surface, typed Ops/Space/Flow response shapes, a non-empty local model identity, and records whether that identity is a mutable alias.
14. **Credential save refreshed the whole Settings snapshot.** That could discard unrelated unsaved runtime edits; credential mutation now refreshes only credential metadata.
15. **Space core-memory fields stayed editable while their save was in flight.** They now lock with the owner mutation so the visible draft cannot diverge silently from the submitted value.
16. **Flow version-history refresh could make a successful Save/Load look like a failed operation.** Save/Load success now remains explicit while version-history refresh failure is reported separately.

## Static security/safety findings

- Hosted remains governed by the process-level cost kill switch; this pass does not enable Hosted.
- Ai server-side proxy configuration keeps the internal token server-side.
- Space embed URLs are already restricted by shared schema to HTTPS without inline credentials or fragments.
- No new raw secret rendering or cross-owner DB path was added.

## What this pass does not prove

Static source review and CI cannot prove pixel-level layout, browser console cleanliness, scroll behavior on the operator's device, local model interaction, or desktop/mobile visual quality. Those remain the runtime closure gate in `docs/ux-runtime-walkthrough-checklist.md`.
