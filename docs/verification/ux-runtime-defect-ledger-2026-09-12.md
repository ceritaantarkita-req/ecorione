# UX Runtime Defect Ledger — 2026-09-12

Status: **IN PROGRESS — REAL-LAPTOP FINDINGS RECORDED**

This ledger records findings produced only after the synchronized real-laptop UX checkpoint began. It does not rewrite the static S0–S3 ledger and it does not claim rendered UX closure.

The first run started on `4329586bbd78df5bd7b2539ca0bfe03120c2a67e`. After PR #69 merged, the operator synchronized to `af54d9d7b93bf3e2b542b354a18c50aaf60406ba` with `HEAD == origin/main`, sourced the root `.env`, and re-asserted `ECORIONE_COST_KILL_SWITCH=1` before restarting Phase 4 and rerunning inventory.

Raw screenshots, terminal output and machine-specific details remain local. Only sanitized observations are recorded here.

| ID | Severity | Surface | Reproduction | Expected | Observed | Disposition |
|---|---|---|---|---|---|---|
| UX-RUNTIME-001 | S2 | inventory `/ops` surface marker | Run `pnpm evidence:ux:inventory` against the rendered Phase 4 stack | The inventory recognizes the visible Operations heading `Runtime health & telemetry` | Browser rendered the heading, but the inventory rejected the page because SSR HTML encoded `&` as `&amp;` while the harness required a literal raw-text match | **MERGED / RUNTIME VERIFIED** — PR #69 accepts the HTML-escaped marker while preserving framework-error rejection; the synchronized `af54d9d7...` inventory advanced past all surface-marker checks |
| UX-RUNTIME-002 | S2 | `/ops` fleet health | Run canonical local `pnpm dev:phase4` and open Operations | Required Phase 4 owners determine fleet health; services outside that stack must not silently make the fleet degraded | `Sync` was probed as if required even though `dev:phase4` does not start Sync, so the rendered fleet could be reported `Degraded` solely because optional Sync was absent | **MERGED / RUNTIME RECHECK PENDING** — PR #69 marks Sync optional, required owners alone determine fleet health, and UI labels unavailable Sync as `OPTIONAL DOWN`; the latest inventory stopped at the later Settings MCP check before reaching `/api/ops` snapshot validation |
| UX-RUNTIME-003 | S2 | operator preflight / Ops auth | Follow the runtime checklist from a fresh WSL shell | Phase 4 and the inventory inherit the configured internal service token without exposing its value | The checklist did not explicitly instruct sourcing the root `.env`; Operations therefore surfaced `ECORIONE_INTERNAL_TOKEN belum dikonfigurasi untuk ops aggregation` when Phase 4 was started from a shell that only exported the cost kill switch | **MERGED / PREFLIGHT VERIFIED, OPS RECHECK PENDING** — PR #69 requires sourcing root `.env` in both shells and fails inventory early if the token is absent; the synchronized rerun reported the internal token loaded and advanced through runtime Settings, but stopped before `/api/ops` validation |
| UX-RUNTIME-004 | S2 | Settings MCP workspace load / inventory | Run `pnpm evidence:ux:inventory` or use the default Settings `Load workspace` action | Settings uses a valid workspace ID that satisfies the shared `WorkspaceIdSchema` (`ws_*`) and the MCP list request reaches Connect successfully | Both Settings UI and inventory used `workspace-default`; Connect validates `workspaceId` with the shared schema and returned HTTP 400 because that value is not a valid workspace ID | **FIXED IN BRANCH** — default Settings workspace and MCP JSON example now use canonical `ws_personal`; inventory uses the same canonical workspace; Settings proxy additionally validates workspace IDs at its own boundary and regression tests cover valid `ws_personal` plus rejection of legacy `workspace-default` |

## Current claim boundary

The real-laptop checkpoint is still in progress. PR #69 is merged, but UX-RUNTIME-002 and the Ops side of UX-RUNTIME-003 still require a fresh inventory pass because the latest synchronized run stopped earlier at UX-RUNTIME-004. UX-RUNTIME-004 itself requires exact-head CI, merge, laptop synchronization to the new `origin/main`, and a fresh inventory run.

No rendered UX PASS is claimed yet. Additional runtime findings may be added or existing findings reopened during the subsequent UX-01..UX-12 walkthrough.
