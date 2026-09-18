# ECORIONE — Current State & Next Steps

Last updated: **2026-09-18**

Status: **CURRENT / canonical handoff for humans and AI agents**

Historical plans, audits, failed attempts, and older verification notes remain evidence snapshots. This file is the shortest current-state source and must not rewrite valid historical failures.

## Current verdict

ECORIONE's defined Batch 1–12 implementation roadmap remains closed. W03, W09/W10, W11, W16, and W17 are closed at their documented boundaries. The active blocker for final current-state closure is **W18 hosted economic validation**. W18 is **FORMAL RUN READY, NOT CLOSED**: the one-call Anthropic-only diagnostic passed, the formal routing/reservation/pre-dispatch cap guard is merged to `main`, the durable spend ledger reconciled cleanly after the diagnostic, a fresh operator authorization of **US$0.25 maximum** has been granted for one formal W18 run, and the fail-closed formal operator wrapper is merged through PR #138 at `05ddd248e90e26b9db2c785d533c55ec817db013` to remove the remaining manual startup/cleanup risk before execution. W20 remains blocked until formal W18 evidence passes.

Compute-host/VPS + Cloudflare remains deferred by operator. AutoClick remains deferred by design. Fase 6+ remains evidence-driven/open-ended.

## Current status table

| Area | Current state | Boundary |
|---|---:|---|
| Batch 1–12 repository roadmap | **12/12 CLOSED** | Defined implementation scope only. |
| Production/self-host repository baseline | **READY** | Repository gates/tooling exist; real target-host activation remains operator-owned. |
| Historical Ledger + ECX local evidence | **PASS / CLOSED** | Real chronology/hash chain and pointer-first handoff/hydration. |
| Historical Comparative ECX oracle-control | **PASS WITH LIMITATIONS / CLOSED** | Local controlled benchmark; not automatic-selector or hosted-dollar proof. |
| W03 UX/product validation | **DONE — REAL-LAPTOP VERIFIED** | Current detailed evidence remains in its verification docs. |
| W09/W10 runtime startup + doctor | **DONE — WINDOWS RUNTIME VERIFIED** | Bounded Windows runtime evidence. |
| W11 installer/launcher | **DONE — WINDOWS INSTALLER VERIFIED** | Clean Windows installer lifecycle passed. |
| W16 automatic semantic ref selector | **DONE — REPO SIDE** | `semantic-v1`, bounded `maxRefs=3`; no oracle indexes required by automatic lane. |
| W17 ECX no-oracle validation | **DONE — VERIFIED LOCAL MODEL PASS** | 5 tasks × 5 repeats × 4 lanes = 100 measured calls; bounded local evidence. |
| W18 hosted economic validation | **FORMAL RUN READY / NOT CLOSED** | Attempt 4 passed; PR #135 formal guard merged; formal 20-call evidence still required. |
| W19 release/security governance | **DONE — REPO SIDE** | Full-history secret scan/naming/model-alias gates retained; branch-protection gap remains separate. |
| W20 final current-state sync | **BLOCKED ON W18** | Start final closure only after formal W18 PASS. |

## W18 provider and experiment profile

Formal W18 is intentionally narrow:

```text
provider gateway: OpenRouter
pricing identity: claude-sonnet-4-5-20250929
runtime model: anthropic/claude-sonnet-4.5
OpenRouter routing: provider.only=["anthropic"]
provider fallback: disabled
lanes: full-inline, ecx-selective-auto
tasks: 5
repeats: 2
measured calls: 20
warm-up calls: 0
cost authority: OpenRouter usage.cost
```

Automatic selection is `semantic-v1` with `maxRefs=3`. Fixture relevance indexes are evaluation-only; they are not supplied to the automatic lane.

## W18 attempt chronology

- **Attempt 1 — failed after 8/20 calls.** Known provider-billed amount `$0.027000`. It exposed acceptance of unusable HTTP-success/zero-cost responses; later fixed fail-closed.
- **Attempt 2 — failed on call 5.** Four settled calls cost `$0.019266`; the rejected fifth call left one conservative historical `uncertain` reservation of `$0.107157`. That reservation must not be rewritten.
- **Attempt 3 — one-call diagnostic failed.** OpenRouter HTTP-success returned no usable completion, `finishReason=content_filter`, `routingProvider=Amazon Bedrock`, `inputTokens=2002`, `outputTokens=1`, authoritative `usage.cost=0`; reservation settled to `$0` and did not create another uncertain entry.
- **Attempt 4 — one-call diagnostic PASS.** OpenRouter request was pinned Anthropic-only with fallback disabled. `procurement-award/full-inline` returned quality `1` (`3/3`), `inputTokens=2002`, `outputTokens=45`, billed `$0.006681`, durable settlement `settled`, no cache hit.

Known settled provider actual across Attempts 1–4 is `$0.052947`. The durable committed amount after Attempt 4 is larger because it conservatively includes the historical Attempt 2 uncertain reservation.

## Formal guard repository verification

PR #135 merged the remaining formal safety/audit guard into `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`. Exact reviewed head `1b6f5d631429eda53be734266a5f47e527390739` passed CI #994 and Product Eval #233.

The merged formal runner now requires Anthropic-only routing, records the sanitized selected routing provider, verifies the durable reservation against the formal conservative estimate, and blocks the next dispatch before provider execution if cumulative actual spend plus that next reservation would exceed the explicit W18 cap. This repository-side work made no hosted provider call, so it did not consume the single formal-run authorization.

## Latest zero-spend postflight

Observed after Attempt 4 on synchronized `main` `9f95d184c6a59da527fd23454fed06065a5738fe`:

```text
hostedCallsEnabled: false
costKillSwitch: 1
dailyCommittedUsd: 0.160104
monthlyCommittedUsd: 0.160104
unsettledReservations: 1
dailyHeadroomUsd: 0.839896
monthlyHeadroomUsd: 9.839896
effectiveHeadroomUsd: 0.839896
preflight: PASS
hosted provider call made by postflight: no
```

The single unsettled reservation is the historical Attempt 2 entry; Attempt 4 did not leak a new reservation.

The ledger uses UTC day/month keys. If formal W18 is executed after a UTC-day rollover or after any other hosted spend, **recalculate current committed/headroom values**. Do not hardcode the `$0.160104` daily committed value as a future admission assumption.

## Formal W18 authorization and spend boundary

A fresh current-run authorization has been given for:

```text
formal W18 maximum provider spend: US$0.25
```

This is a **single formal-run authorization**, not standing permission for later retries. It is consumed by provider dispatches in that formal attempt. Any rerun after a failure requires fresh explicit authorization.

Before engine startup for the formal run, set the temporary daily durable ceiling to:

```text
current UTC-day committed + 0.25
```

This makes Connect's durable pre-dispatch reservation boundary enforce the same remaining allowance as the explicit formal cap. Do not use the illustrative historical value `$0.410104` unless the current UTC-day committed amount is still exactly `$0.160104` at execution time.

The formal runner must additionally have `ECORIONE_W18_ALLOW_SPEND=YES`, `ECORIONE_W18_MAX_SPEND_USD=0.25`, `ECORIONE_COST_KILL_SWITCH=0`, and the Connect process must start with `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic`.

## Formal closure gate

Every measured call must be uncached, use OpenRouter and the pinned pricing identity, settle durable billed cost, report positive authoritative cost, and return exact task quality. Every task must preserve automatic selector recall `1`, select within the existing bound, reduce automatic input tokens, and reduce automatic provider-billed cost versus full-inline.

Aggregate closure requires:

```text
taskCount = 5
measuredModelCalls = 20
failedTasks = 0
auto billed cost < full-inline billed cost
actual run spend <= 0.25
closureEligible = true
```

Raw evidence and summary remain under gitignored `.ecorione/evidence/`; only sanitized verification summaries belong in Git.

## Claim boundary

A formal W18 PASS supports only a bounded statement on the five synthetic extraction fixtures using the same pinned OpenRouter/Anthropic route. It does not establish universal workload savings, future prices, end-to-end network savings, production SLA/SLO, or public percentage-savings marketing claims.

## Immediate next action

1. synchronize operator laptop to merged `main` `05ddd248e90e26b9db2c785d533c55ec817db013` or newer;
2. confirm the previous engine is stopped;
3. run `node .\\scripts\\w18-formal-operator.mjs --preflight-only` (zero spend);
4. run `node .\\scripts\\w18-formal-operator.mjs --execute-authorized-w18` exactly once under the current US$0.25 authorization;
5. preserve raw local evidence, its SHA-256 summary, and the postflight ledger state;
6. if formal W18 passes, document/merge W18 closure and continue W20; if it fails, stop and diagnose without rerunning.

Canonical W18 verification sources:

- `docs/verification/w18-hosted-economics-preflight-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`
- `docs/verification/w18-formal-run-readiness-2026-09-18.md`
- `docs/verification/w18-formal-guard-merge-2026-09-18.md`
- `docs/verification/w18-formal-operator-wrapper-2026-09-18.md`

Historical audits dated before this handoff remain historical snapshots and are not current status sources.
