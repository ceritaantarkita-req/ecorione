# Frontend Static Defect / Risk Ledger — Pre-Runtime

Status: **STATIC LEDGER CURRENT / RUNTIME FINDINGS PENDING**  
Date: **2026-09-12**

This ledger records source-review defects found during the UX/product-validation preparation sequence. Severity uses the UX S0–S3 definitions in `docs/ux-product-validation.md`. It is intentionally limited to defects evidenced from repository code or deterministic tests; rendered/browser-only findings must be appended from the real laptop walkthrough instead of guessed here.

## Severity summary

| Severity | Static findings in this ledger | Open after PR #65 |
|---|---:|---:|
| S0 | 1 | 0 |
| S1 | 8 | 0 |
| S2 | 11 | 0 |
| S3 | 2 | 0 |

`0 open` means no **known repository-side** S0/S1/S2/S3 item listed below remains unresolved on the PR #65 baseline. It does not mean the rendered UX checkpoint is closed.

## Ledger

| ID | Severity | Surface | Finding / risk | Disposition |
|---|---|---|---|---|
| STATIC-001 | S0 | Settings / routing | Persisted runtime settings could previously reopen Hosted dispatch even while the process-level cost kill switch expressed an emergency-stop boundary. | **FIXED** — operator kill switch is now a ceiling; Hosted remains effectively OFF during this checkpoint. |
| STATIC-002 | S1 | Ai chat | Same-frame repeated submit could dispatch duplicate chat requests before React disabled state rendered. | **FIXED** — synchronous in-flight lock plus pending UI state. |
| STATIC-003 | S1 | Ai memory | Repeated Forget actions could overlap and success previously lacked clear local confirmation. | **FIXED** — serialized forget action plus visible success/failure. |
| STATIC-004 | S1 | Space | A previous page document could remain interactive while a newly selected page was loading, and out-of-order page/list responses could replace newer state. | **FIXED** — document clears on navigation; stale responses are identity/sequence guarded. |
| STATIC-005 | S1 | Space | Owner-backed mutations could be submitted repeatedly before React mutation state rendered. | **FIXED** — synchronous mutation serialization and disabled controls. |
| STATIC-006 | S1 | Flow | A valid result for an older draft revision could remain visible after the graph changed. | **FIXED** — validation is revision-bound and stale results are discarded. |
| STATIC-007 | S1 | Flow | Run could execute an older persisted graph while the visible canvas contained unsaved edits. | **FIXED** — dirty state blocks Run until Save succeeds. |
| STATIC-008 | S1 | Flow | Save/Load/Run/approval/input handlers had same-frame duplicate-event windows and selected config could remain stale after load. | **FIXED** — synchronous action guards plus explicit config refresh. |
| STATIC-009 | S1 | Settings / MCP | Rendered `Load workspace` uses `?workspaceId=...`, but the Ai Settings proxy matched its anchored allowlist against the full path including query, so a valid request could be rejected locally with HTTP 400 before Connect. | **FIXED in PR #63** — pathname/query validation separated; exactly one supported `workspaceId` query is allowed and regression-tested. |
| STATIC-010 | S2 | Settings | Mutable fields remained editable while writes were in flight, allowing a completion response to overwrite newer local edits. | **FIXED** — mutation-bound fields lock; credential save no longer refreshes unrelated runtime draft state. |
| STATIC-011 | S2 | Settings / MCP | Workspace response could arrive after the visible workspace changed and replace newer state. | **FIXED** — workspace loads are request-sequenced and identity-checked. |
| STATIC-012 | S2 | Settings | Empty/non-JSON upstream failures could be masked by client JSON parsing and lose the useful HTTP failure. | **FIXED** — response handling preserves HTTP status/error context. |
| STATIC-013 | S2 | Operations | Initial render could report `Degraded`/zero metrics before the first snapshot loaded, and manual/auto refresh could overlap. | **FIXED** — explicit Loading/empty state and serialized refresh. |
| STATIC-014 | S2 | Flow | Poll/version-list/network failures could silently retain stale execution/version state or escape as unhandled rejection. | **FIXED** — failures are surfaced and UI actions catch request rejection. |
| STATIC-015 | S2 | Space | Block deletion was immediate and browser-native rename interaction did not match the product interaction model. | **FIXED** — in-product rename and two-step destructive confirmation. |
| STATIC-016 | S2 | Responsive Flow | Palette creation was desktop drag-first and the three-column workspace could force page-level horizontal overflow at narrow widths. | **FIXED** — click/keyboard creation plus narrow stacked layout and canvas-bounded overflow. |
| STATIC-017 | S2 | Ai / responsive | Sticky composer and compact controls did not fully account for narrow viewport safe-area/touch targets. | **FIXED** — mobile safe-area and key touch-target hardening. |
| STATIC-018 | S2 | Ai → owner proxies | Internal owner proxy paths/redirect behavior was inconsistent; credential-bearing fetches could follow owner redirects and Space/Flow lacked one shared bounded path normalization rule. | **FIXED in PR #63** — shared path normalizer plus `redirect: "error"` and deterministic owner-boundary tests. |
| STATIC-019 | S2 | UX evidence | The initial inventory primarily smoke-checked route markers and did not exercise the same Settings MCP workspace-query contract used by the UI. | **FIXED in PR #63** — inventory checks navigation, typed owner response shapes, local runtime identity, and the Settings MCP workspace list. |
| STATIC-020 | S2 | Model identity clarity | Mutable `:latest`/`@latest` local model identity could be visible without an explicit warning that it is not immutable production evidence. | **FIXED** — Settings shows mutable-alias warning; immutable identity remains a later checkpoint. |
| STATIC-021 | S3 | Operations | Empty services/traces sections were visually ambiguous. | **FIXED** — explicit empty-state copy. |
| STATIC-022 | S3 | Theme/accessibility | Compact mobile theme controls visually replaced text without explicit accessible names. | **FIXED** — explicit labels/group semantics. |
| STATIC-023 | S2 | Ai realtime voice / Hub boundary | The dedicated SSE voice-stream route bypassed the generic Hub proxy and still used Fetch's default redirect-follow behavior while attaching the internal bearer token, so the PR #63 redirect invariant was incomplete for this direct owner call. | **FIXED in PR #65** — the Hub SSE fetch now uses `redirect: "error"`; deterministic route coverage is part of both the normal test suite and `acceptance:release`. |

## Static closure statement

For the scoped primary surfaces (`/`, `/space`, `/flow`, `/ops`, `/settings`) and the audited Ai-facing owner boundaries, the known static findings above are fixed through PR #65, with deterministic regressions covering the generic owner proxies plus the dedicated realtime voice SSE owner call.

This statement is deliberately narrower than UX closure. The following are still **unknown until the operator laptop run**:

- rendered/pixel layout quality;
- actual browser console cleanliness and hydration behavior;
- real desktop/narrow scroll and focus behavior;
- real Local chat latency/feedback on the synchronized stack;
- actual Settings `Load workspace` and Local canary interaction in the rendered product;
- timing-dependent defects that deterministic source/unit review did not reproduce;
- realtime voice runtime/browser behavior, which is not part of the minimum UX-01–UX-12 closure claim;
- any new S0–S3 item observed during UX-01 through UX-12.

Append runtime findings to the walkthrough evidence using the required format `ID | severity | route | steps | expected | observed | console evidence | disposition`. Do not downgrade or hide a runtime finding merely because this static ledger is green.
