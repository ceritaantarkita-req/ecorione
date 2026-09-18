# ECORIONE — Current State & Next Steps

Last updated: **2026-09-18**

Status: **CURRENT / canonical handoff for humans and AI agents**

Historical plans, audits, failed attempts, and older verification notes remain evidence snapshots. This file is the shortest current-state source and must not rewrite valid historical failures.

## Current verdict

ECORIONE's defined Batch 1–12 implementation roadmap remains closed. W03, W09/W10, W11, W16, and W17 remain closed at their documented boundaries. The formal W18 hosted benchmark has now completed successfully on synchronized clean `main`: 20 measured calls, zero failed tasks, US$0.091716 formal spend, and `closureEligible=true`.

W18 is nevertheless **not yet formally closed** because the formal run began with US$0.091596 more durable committed spend than the immediately preceding zero-spend preflight. That intervening ledger delta must be reconciled before W18 closure. W20 remains blocked only on this reconciliation/closure step.

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
| W18 hosted economic validation | **FORMAL RUNTIME PASS / CLOSURE HOLD** | 20/20 measured calls PASS, US$0.091716 formal spend, `closureEligible=true`; reconcile US$0.091596 pre-run ledger delta before CLOSED. |
| W19 release/security governance | **DONE — REPO SIDE** | Full-history secret scan/naming/model-alias gates retained; branch-protection gap remains separate. |
| W20 final current-state sync | **BLOCKED ON W18 RECONCILIATION** | Formal runtime already passed; final closure waits only on ledger provenance reconciliation and W18 closeout. |

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

## W18 formal runtime result

The synchronized formal execution on `main` `f249d9c0681462253bff21ca30354892ca4ce60f` completed the full **5 tasks × 2 repeats × 2 lanes = 20 measured hosted calls** and the harness returned `aggregate.pass=true` plus `closureEligible=true`.

```text
full-inline billed cost = US$0.059106
ecx-selective-auto billed cost = US$0.032610
actual formal run spend = US$0.091716
saved vs full-inline = US$0.026496
savedPct = 44.827936250126896
medianTaskSavedPct = 44.4913020558777
medianTaskInputTokenReductionPct = 50.629874025194965
failedTasks = 0
```

Raw local evidence remains gitignored. The recorded evidence SHA-256 is `cadb920047a27eb4e3db38cb53e63192af3ea7857617d8f125c7056bd6c162da`.

Cleanup passed: `hostedCallsEnabled=false`, future-process kill switch restored to `1`, engine stopped, and the formal run's durable committed delta exactly matched US$0.091716.

### Ledger reconciliation hold

The immediately preceding zero-spend preflight reported daily committed US$0 and monthly committed US$0.160104. The formal execution began with daily committed **US$0.091596** and monthly committed **US$0.251700**. The supplied transcript does not establish the provenance of that intervening **US$0.091596**.

Therefore the formal harness result is **PASS**, but W18 overall remains **NOT CLOSED** until that earlier spend is reconciled from the local durable ledger. Do not rerun the paid formal benchmark. Preserve the ledger unchanged and commit only a sanitized reconciliation summary.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`.

## Claim boundary

A formal W18 PASS supports only a bounded statement on the five synthetic extraction fixtures using the same pinned OpenRouter/Anthropic route. It does not establish universal workload savings, future prices, end-to-end network savings, production SLA/SLO, or public percentage-savings marketing claims.

## Immediate next action

1. inspect local `data/connect-spend-budget.json`;
2. identify the entries contributing the US$0.091596 delta between zero-spend preflight and formal-run start;
3. preserve the ledger unchanged and produce a sanitized reconciliation note;
4. once reconciled, mark W18 CLOSED and complete W20 final current-state sync;
5. do **not** rerun the paid formal benchmark.

Canonical W18 verification sources:

- `docs/verification/w18-hosted-economics-preflight-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`
- `docs/verification/w18-formal-run-readiness-2026-09-18.md`
- `docs/verification/w18-formal-guard-merge-2026-09-18.md`
- `docs/verification/w18-formal-operator-wrapper-2026-09-18.md`
- `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`

Historical audits dated before this handoff remain historical snapshots and are not current status sources.
