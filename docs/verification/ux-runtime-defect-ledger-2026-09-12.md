# UX Runtime Defect Ledger — 2026-09-12

Status: **IN PROGRESS — REAL-LAPTOP WALKTHROUGH FINDINGS RECORDED**

This ledger records findings produced only after the synchronized real-laptop UX checkpoint began. It does not rewrite the static S0–S3 ledger and it does not claim rendered UX closure.

The first run started on `4329586bbd78df5bd7b2539ca0bfe03120c2a67e`. After PR #69 merged, the operator synchronized to `af54d9d7b93bf3e2b542b354a18c50aaf60406ba`. After PR #70 merged, the operator synchronized again to `be953a684fbef8b49a8f775dfce721bec3925d5b`, sourced the root `.env`, re-asserted `ECORIONE_COST_KILL_SWITCH=1`, restarted Phase 4, and obtained a full PASS from `pnpm evidence:ux:inventory` with all eight required owners healthy, all five primary surfaces reachable, Hosted effectively OFF, Ops healthy, the canonical Settings MCP workspace query successful, Space reachable, and Flow node inventory present.

PR #71 later merged the local-chat framing/cache fix as `b3dbab0706c6faa7e2caede1199271bce8489ebe`. Subsequent work also closed immutable model identity and W15 bounded agentic eval, so the current UX inventory now requires a pinned local model digest rather than treating model identity as a later checkpoint.

Raw screenshots, terminal output and machine-specific details remain local. Only sanitized observations are recorded here.

| ID | Severity | Surface | Reproduction | Expected | Observed | Disposition |
|---|---|---|---|---|---|---|
| UX-RUNTIME-001 | S2 | inventory `/ops` surface marker | Run `pnpm evidence:ux:inventory` against the rendered Phase 4 stack | The inventory recognizes the visible Operations heading `Runtime health & telemetry` | Browser rendered the heading, but the inventory rejected the page because SSR HTML encoded `&` as `&amp;` while the harness required a literal raw-text match | **MERGED / RUNTIME VERIFIED** — PR #69 accepts the HTML-escaped marker while preserving framework-error rejection; the synchronized `be953a6...` inventory passes all surface-marker checks |
| UX-RUNTIME-002 | S2 | `/ops` fleet health | Run canonical local Phase 4 and open Operations | Required Phase 4 owners determine fleet health; services outside that stack must not silently make the fleet degraded | `Sync` was probed as if required even though Phase 4 does not require Sync, so the rendered fleet could be reported `Degraded` solely because optional Sync was absent | **MERGED / RUNTIME VERIFIED** — PR #69 marks Sync optional and the synchronized `be953a6...` inventory reports `opsHealthy: true` with all required owners healthy |
| UX-RUNTIME-003 | S2 | operator preflight / Ops auth | Follow the runtime checklist from a fresh shell | Phase 4 and the inventory inherit the configured internal service token without exposing its value | The earlier checklist required manual shell sourcing and Operations surfaced `ECORIONE_INTERNAL_TOKEN belum dikonfigurasi untuk ops aggregation` when the environment was incomplete | **REPO-SIDE HARDENED / CURRENT RUNTIME RECHECK PENDING** — PR #69 documented sourcing; current W03 hardening uses cross-platform `pnpm engine:start` to read root `.env`, while the inventory hydrates only the internal token from `.env` without printing it. Hosted kill switch remains an explicit shell requirement and is independently verified through effective runtime settings |
| UX-RUNTIME-004 | S2 | Settings MCP workspace load / inventory | Run `pnpm evidence:ux:inventory` or use the default Settings `Load workspace` action | Settings uses a valid workspace ID that satisfies the shared `WorkspaceIdSchema` (`ws_*`) and the MCP list request reaches Connect successfully | Both Settings UI and inventory used `workspace-default`; Connect validates `workspaceId` with the shared schema and returned HTTP 400 because that value is not a valid workspace ID | **MERGED / RUNTIME VERIFIED** — PR #70 uses canonical `ws_personal`, validates at the Ai proxy boundary, and the synchronized `be953a6...` inventory completes the MCP query successfully |
| UX-RUNTIME-005 | S2 | Ai Local chat / UX-02 and UX-03 | On synchronized current main, send `Balas tepat: UX_LOCAL_OK`, then `Balas tepat: UX_CONTINUITY_OK` in the same Local session | Each request produces exactly the requested token, one reply per turn, while the same session continues | Earlier runtime requests completed end-to-end with HTTP 200, but the local model returned acknowledgements such as `Understood.` instead of the requested exact strings because stored context and the live request were framed together and stale exact-cache output could cross the prompt change | **MERGED / RUNTIME RECHECK PENDING** — PR #71 / `b3dbab0706c6faa7e2caede1199271bce8489ebe` separates stored context from the final live request, strengthens exact-string compliance, and bumps local cache identity to `prompt-v2`; fresh UX-02/UX-03 browser evidence on current `origin/main` is still required |
| UX-RUNTIME-006 | S3 | browser console / Ai | Open Ai with DevTools Console during the walkthrough | No application-owned resource errors during normal page use | Browser console reported `GET /favicon.ico 404` | **FIXED REPO-SIDE / RUNTIME RECHECK PENDING** — current W03 hardening adds the App Router icon asset so normal navigation no longer depends on a missing favicon resource; verify in a clean browser console before final closure. `VM...` / DevTools filesystem messages remain unclassified unless reproducible as application-owned errors |

## Current claim boundary

The repository inventory gate was runtime-verified PASS on `be953a6...`, but that historical PASS does not close W03 on current main. Current main contains PR #71 plus later runtime/model-identity work, so the operator must run a fresh exact-head inventory and rendered UX-01–UX-12 walkthrough.

The immediate runtime rechecks are:

1. UX-02 and UX-03 exact-string Local turns after the merged PR #71 framing/cache fix;
2. clean browser console confirmation that UX-RUNTIME-006 no longer produces an application-owned favicon 404;
3. continuation through UX-04–UX-12 with every new finding recorded in this ledger.

The episodic-memory panel observation after the second turn is not classified as a stale-state defect: `memoryUsed` intentionally describes the context assembled before the current provider call, while the current user/assistant episodes are persisted after that call. Therefore the latest reply may legitimately report prior-turn episodic context rather than including itself.

No rendered UX PASS is claimed yet. Additional runtime findings may be added or existing findings reopened during the subsequent UX-01–UX-12 walkthrough.
