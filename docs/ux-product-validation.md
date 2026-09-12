# ECORIONE — Local UX / Product Validation

Status: **IMPLEMENTATION IN PROGRESS / RUNTIME WALKTHROUGH PENDING**  
Date: **2026-09-12**

This is the active checkpoint after local observability closure. It validates real user journeys on the already-closed local technical baseline. It is not a new Batch 13 and it does not reopen Historical Ledger, ECX, persistence, backup/restore, or observability closure.

## Objective

Prove that the current Ai-facing product is understandable and usable for representative local workflows, not merely that owner APIs and infrastructure are technically healthy.

The checkpoint must exercise the real Ai surface at `http://127.0.0.1:3000` while hosted calls remain disabled.

## Safety boundary

For the entire checkpoint:

```text
ECORIONE_COST_KILL_SWITCH=1
```

Rules:

- no hosted provider call or credential/account mutation;
- no VPS, Cloudflare, DNS, firewall, tunnel, or public-edge mutation;
- do not rewrite Historical Ledger or Context L0 ground truth to manufacture a UX result;
- use owner APIs only through existing product/proxy boundaries;
- preserve valid failures and confusing states as evidence;
- raw screenshots/logs with machine- or user-specific detail stay local;
- only sanitized evidence may be committed;
- distinguish UX/product defects from latency/resource observations already covered by the observability checkpoint.

## Initial code-audit findings before runtime walkthrough

Two concrete defects were found while preparing this checkpoint:

1. **Primary product surfaces were not globally discoverable.** Chat exposed no path to Space, Flow, Operations, or Settings; Operations had no product navigation; other pages used inconsistent local links. The checkpoint branch adds a shared top-level navigation rail from the root layout.
2. **The process-level cost kill switch was only a default, not a hard ceiling, when durable runtime settings already contained `hostedCallsEnabled: true`.** Runtime settings could therefore report/drive hosted enabled even when `ECORIONE_COST_KILL_SWITCH=1`. The checkpoint branch wraps Connect runtime settings with an operator gate so runtime settings may further disable hosted calls but can never re-enable them while the operator gate is closed.

These fixes require deterministic CI and a fresh merged-runtime inventory before they count as validated behavior.

## Read-only strict inventory

After the checkpoint implementation is merged to `main`, Phase 4 is restarted on that exact revision, and the environment is sourced with the kill switch enabled, run:

```bash
pnpm evidence:ux:inventory
```

The inventory is intentionally read-only. It requires:

- local `HEAD == origin/main`;
- clean tracked working tree;
- `ECORIONE_COST_KILL_SWITCH=1`;
- RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow healthy;
- Ai routes `/`, `/space`, `/flow`, `/ops`, `/settings` returning expected page markers;
- Ai Settings proxy reporting effective `hostedCallsEnabled=false`;
- Ai Ops proxy healthy;
- Ai Space pages proxy readable;
- Ai Flow node registry proxy readable.

Inventory PASS means the product is ready for rendered walkthrough. It is not UX closure by itself.

## Journey matrix

| ID | Journey | User-visible expectation | Mutation policy |
|---|---|---|---|
| UX-01 | Global navigation | Ai, Space, Flow, Operations, and Settings are reachable without typing routes manually | read-only |
| UX-02 | Local chat first turn | User can send a Local message, sees waiting feedback, receives a reply, model/cache/cost line, and no hosted dispatch | local model call only |
| UX-03 | Same-session continuity | A second Local turn in the same browser session keeps the same session identity and behaves as a continuation | local model call only |
| UX-04 | Memory visibility | Memory panel clearly shows core memory, recalled facts, and episodic summaries actually returned by the product | read-only relative to returned state |
| UX-05 | Forget/recovery state | Existing forget action gives a visible success state or visible failure; no silent/unhandled failure | only if a disposable/reversible recalled fact is available; otherwise record not exercised |
| UX-06 | Routing clarity | Local is clearly available; Hosted remains effectively OFF while operator kill switch is active | read-only; never enable hosted |
| UX-07 | Operations | `/ops` loads, fleet state is understandable, Refresh works, Auto 5s can be toggled without stale/error state | read-only |
| UX-08 | Settings | `/settings` loads effective local runtime state and local canary can be run safely; hosted remains off after refresh/save | local canary allowed; no credential writes |
| UX-09 | Space | Existing pages can be discovered/opened and page/block state is understandable; safe CRUD is exercised only with an explicitly disposable probe | bounded local state only |
| UX-10 | Flow | Node registry/canvas loads, validation feedback is understandable, and no execution is started unless a disposable safe local graph is explicitly used | default read-only/validate; no external side effect |
| UX-11 | Error/recovery | At least one safe failure path gives actionable visible feedback and the user can continue without reloading the whole stack | no destructive mutation |
| UX-12 | Responsive sanity | Chat/global navigation plus the critical management surfaces are checked at desktop and one narrow/mobile viewport for clipping/scroll traps | read-only |

## Rendered walkthrough procedure

Use a real browser against `http://127.0.0.1:3000` on the exact merged revision.

Minimum evidence:

1. desktop screenshot of Ai before first message;
2. desktop screenshot after one successful Local reply showing routing/cost and memory state;
3. screenshot proving the same session continues into a second turn;
4. screenshot of global navigation reaching Space, Flow, Operations, and Settings;
5. screenshot of Settings showing hosted effectively off during the kill-switch checkpoint;
6. screenshot of Ops healthy state;
7. one narrow/mobile viewport screenshot for chat/navigation and one management surface;
8. console errors/warnings captured for the exercised paths;
9. defect ledger with severity, reproduction, observed result, expected result, owner/file when known, and disposition.

Do not treat a passing build, HTTP route smoke, or static code review as rendered UX evidence.

## Defect severity

- **S0 blocker** — data/security/spend boundary violation, destructive behavior, or the primary local journey cannot proceed.
- **S1 major** — core user journey fails or gives materially misleading state with no safe workaround.
- **S2 moderate** — journey works but has confusing feedback, poor recovery, broken navigation, or significant responsive/accessibility defect.
- **S3 minor** — polish/readability issue that does not materially block the journey.

S0/S1 findings block closure. S2 must be fixed or explicitly accepted with a reason. S3 may remain documented.

## PASS definition

The checkpoint can be marked **CLOSED / PASS WITH LIMITATIONS** only when all of the following are true:

- exact-head repository CI is green;
- implementation is merged and `main` is verified;
- Phase 4 runs the merged revision;
- `pnpm evidence:ux:inventory` passes on synchronized clean `main`;
- rendered browser walkthrough covers the minimum journeys above;
- no S0/S1 issue remains open;
- every observed defect is fixed or explicitly bounded;
- hosted calls remain effectively disabled throughout the checkpoint;
- sanitized closure evidence is committed without private raw screenshots/logs.

## Claim boundary

A future PASS proves only representative local product/UX behavior on the tested laptop, browser, viewport(s), state, and local model configuration. It does not prove:

- production SLA/SLO;
- all browsers/devices/viewports;
- accessibility conformance certification;
- hosted-provider UX/cost/quality;
- concurrent multi-user behavior;
- autonomous semantic reference selection;
- immutable model identity;
- VPS/Cloudflare behavior;
- off-host DR.

Immutable local model identity hardening remains the next planned checkpoint after UX/product validation closes.
