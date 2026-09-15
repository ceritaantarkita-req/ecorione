# UX Runtime Defect Ledger — 2026-09-12

Status: **IN PROGRESS — REAL-LAPTOP WALKTHROUGH FINDINGS RECORDED / REDESIGN OPEN**

This ledger records findings produced only after the synchronized real-laptop UX checkpoint began. It does not rewrite the static S0–S3 ledger and it does not claim rendered UX closure.

The first run started on `4329586bbd78df5bd7b2539ca0bfe03120c2a67e`. After PR #69 merged, the operator synchronized to `af54d9d7b93bf3e2b542b354a18c50aaf60406ba`. After PR #70 merged, the operator synchronized again to `be953a684fbef8b49a8f775dfce721bec3925d5b`, sourced the root `.env`, re-asserted `ECORIONE_COST_KILL_SWITCH=1`, restarted Phase 4, and obtained a full PASS from `pnpm evidence:ux:inventory` with all eight required owners healthy, all five primary surfaces reachable, Hosted effectively OFF, Ops healthy, the canonical Settings MCP workspace query successful, Space reachable, and Flow node inventory present.

PR #71 later merged the local-chat framing/cache fix as `b3dbab0706c6faa7e2caede1199271bce8489ebe`. Subsequent work closed immutable model identity and W15 bounded agentic eval, so current UX inventory requires a pinned local model digest.

On 2026-09-15 the operator synchronized through PR #90 / `d0bf34ae1ec8b0ab4f2052863f3057f7a98254e1`, ran the Windows launcher successfully, obtained a fresh exact-head inventory PASS, and completed most of UX-01–UX-12. That run verified core product behavior but exposed new S2 mobile/responsive and Flow-discoverability findings. Those findings intentionally reopen W03 before closure.

Raw screenshots, terminal output and machine-specific details remain local. Only sanitized observations are recorded here.

| ID | Severity | Surface | Reproduction | Expected | Observed | Disposition |
|---|---|---|---|---|---|---|
| UX-RUNTIME-001 | S2 | inventory `/ops` surface marker | Run `pnpm evidence:ux:inventory` against the rendered Phase 4 stack | The inventory recognizes the visible Operations heading `Runtime health & telemetry` | Browser rendered the heading, but the inventory rejected the page because SSR HTML encoded `&` as `&amp;` while the harness required a literal raw-text match | **MERGED / RUNTIME VERIFIED** — PR #69 accepts the HTML-escaped marker while preserving framework-error rejection; synchronized inventory passes all surface-marker checks |
| UX-RUNTIME-002 | S2 | `/ops` fleet health | Run canonical local Phase 4 and open Operations | Required Phase 4 owners determine fleet health; services outside that stack must not silently make the fleet degraded | `Sync` was probed as if required even though Phase 4 does not require Sync | **MERGED / RUNTIME VERIFIED** — PR #69 marks Sync optional; current inventory reports `opsHealthy: true` with all required owners healthy |
| UX-RUNTIME-003 | S2 | operator preflight / Ops auth | Follow runtime checklist from a fresh shell | Phase 4 and inventory inherit configured internal service token without exposing its value | Earlier checklist required manual shell sourcing and incomplete env caused Ops auth failure | **REPO-SIDE HARDENED / RUNTIME VERIFIED** — `pnpm engine:start` reads root `.env`; inventory hydrates only the internal token without printing it; kill switch remains explicit; 2026-09-15 exact-head inventory PASS proved this path |
| UX-RUNTIME-004 | S2 | Settings MCP workspace load / inventory | Run inventory or use Settings `Load workspace` | Settings uses a valid `ws_*` workspace ID and the MCP list request succeeds | Earlier UI/inventory used invalid `workspace-default` | **MERGED / RUNTIME VERIFIED** — PR #70 uses `ws_personal`; 2026-09-15 browser showed explicit `Loaded 0 MCP server configuration(s).` |
| UX-RUNTIME-005 | S2 | Ai Local chat / UX-02 and UX-03 | Send `Balas tepat: UX_LOCAL_OK`, then `Balas tepat: UX_CONTINUITY_OK` in same Local session | exact requested token, one reply per turn, same session continues | Earlier model returned acknowledgement rather than exact string due framing/cache interaction | **MERGED / RUNTIME VERIFIED** — PR #71 separated stored context from live request; 2026-09-15 clean-browser evidence returned exact `UX_LOCAL_OK` then `UX_CONTINUITY_OK` in the same session with one reply each |
| UX-RUNTIME-006 | S3 | browser console / Ai | Open Ai with DevTools Console during walkthrough | no application-owned resource errors | Earlier console reported `GET /favicon.ico 404` | **FIXED / RUNTIME VERIFIED** — App Router icon asset returns normally. Repeated `VM...` anonymous `reportAllChanges/startTime` errors were absent in a clean Incognito check and are treated as extension/devtools injected rather than app-owned unless reproduced cleanly |
| UX-RUNTIME-007 | S2 | Settings async actions | Scroll to MCP section and click `Load workspace` or trigger Local canary | pending/result feedback remains visible near the active task | action succeeded but status appeared only at the page top, so operator perceived “nothing happened” | **MERGED / RUNTIME RECHECKED** — PR #90 makes Settings status sticky; 2026-09-15 recheck showed `Loaded 0 MCP server configuration(s).`, `Running local canary…`, and final canary result remaining visible |
| UX-RUNTIME-008 | S2 | app-wide narrow/mobile | Use DevTools 390–430px on Ai, Space, Flow, Operations, Settings | each surface has a deliberate narrow layout with controls reachable; no accidental page-level horizontal trap | multiple management surfaces are visibly compressed; Flow in particular remains a desktop canvas/panel layout squeezed into a phone-width viewport | **OPEN — REDESIGN APPROVED** — app-wide responsive pass required by `docs/flow-responsive-ux-redesign.md`; W03 cannot close until fresh narrow recheck passes |
| UX-RUNTIME-009 | S2 | Flow node catalog / first-use discoverability | Ask a first-time user to add a node without instruction | catalog visually communicates “insert/add”; click and drag behavior are obvious | operator and second user initially did not realize node labels were clickable/addable | **OPEN — REDESIGN APPROVED** — node rows require explicit add affordance/icon and clearer interaction cue |
| UX-RUNTIME-010 | S2 | Flow connections | Ask a first-time user to connect two nodes | visible input/output ports communicate connection direction; direct manipulation creates edge | current connection model is hidden behind `Mulai koneksi` in inspector then clicking another node; both operator and second user found it non-obvious | **OPEN — REDESIGN APPROVED** — visible socket/port interaction with click/drag alternative required; Condition/Switch requires distinct `true`/`false` ports |
| UX-RUNTIME-011 | S2 | Flow information architecture | Work with node catalog, canvas and inspector | canvas gets maximum useful width; common settings are progressively disclosed | permanent right inspector squeezes canvas, advanced JSON is too prominent, and simple configuration lacks an intermediate quick-settings layer | **OPEN — REDESIGN APPROVED** — move config into collapsible left builder panel; add card `View more` quick settings and retain raw JSON only as advanced fallback |

## Verified walkthrough state before redesign

The 2026-09-15 current-main pass established:

```text
inventory: PASS
UX-02 exact Local turn: PASS
UX-03 continuity: PASS
UX-04 memory readability: PASS
UX-05: NOT_EXERCISED
UX-06 Local / Hosted OFF: PASS
UX-07 Operations: PASS
UX-08 Settings MCP/canary function: exercised; feedback defect fixed by PR #90
UX-09 two-page Space switching: PASS
UX-10 Flow dirty/save/load/validate behavior: PASS
UX-11 invalid config safe failure: PASS
```

The Local canary remained identity-verified but exceeded its default latency target on this machine. That is a performance limitation/evidence point, not a model-identity failure.

## Current claim boundary

W03 is **not closed**. Functional walkthrough success does not override the new S2 usability findings. The approved implementation contract is `docs/flow-responsive-ux-redesign.md`.

Next closure recheck must specifically prove:

1. narrow Ai, Space, Operations, Settings, and Flow layouts at 390–430px;
2. Flow node insertion discoverability;
3. visible port-based connections including Condition/Switch branch outputs;
4. quick settings plus advanced config in a collapsible left builder panel;
5. Flow mobile Stack/List mode that does not require desktop canvas precision;
6. existing dirty/save/load/validate and safe-failure behavior remains intact;
7. clean browser console with no application-owned framework/hydration/unhandled-promise errors.

No rendered UX closure is claimed until these open S2 findings are fixed or explicitly accepted after recheck.
