# ECORIONE — Active Work Plan

Last updated: **2026-09-18**

Status: **ACTIVE / canonical execution log**

Current code + current runtime evidence + this document are the source of truth for active work. Historical dated audits and failed attempts remain preserved as evidence snapshots.

## Current repository checkpoint

```text
main at documentation-sync start: fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a
W11 final Windows installer closure: PASS
W17 formal local closure: PASS
W18 one-call Anthropic-only diagnostic: PASS
W18 formal dispatch/routing/cap guard: MERGED / REPO-SIDE PASS
W18 formal operator wrapper: MERGED / REPO-SIDE PASS
W18 formal 20-call run: PASS / closureEligible=true / US$0.091716 formal spend
W18 closure: HOLD pending US$0.091596 pre-run ledger reconciliation
W20 final sync: BLOCKED ON W18 RECONCILIATION
```

The successful W18 diagnostic source was `a4382135d2d2729546e517b1bc6337542664f4ee`; PR #134 added its sanitized verification record. PR #135 then merged the remaining formal dispatch/routing/cap safety guard into `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`; exact reviewed head `1b6f5d631429eda53be734266a5f47e527390739` passed CI #994 and Product Eval #233.

## Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01–W02 | Reconcile analysis + test discovery | **DONE** | Repository scope. |
| W03 | UX/Product Validation | **DONE — REAL-LAPTOP VERIFIED** | Rendered/runtime evidence closed at documented boundary. |
| W04–W08 | Runtime/provider/settings foundations | **DONE / REPO SIDE** | Existing limitations remain documented. |
| W09 | One-command startup | **DONE — WINDOWS RUNTIME VERIFIED** | Real Windows harness. |
| W10 | `ecorione doctor` | **DONE — WINDOWS RUNTIME VERIFIED** | Optional local generation canary remains diagnostic-only. |
| W11 | Installer/Launcher | **DONE — WINDOWS INSTALLER VERIFIED** | Clean Windows packaged lifecycle PASS. |
| W12 | Attachment path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → hydration. |
| W13 | Immutable local model identity | **DONE WITH LIMITATIONS — RUNTIME VERIFIED** | Reverify when model/runtime changes. |
| W14 | Product eval foundation | **DONE — REPO SIDE** | Deterministic product regressions. |
| W15 | Agentic local-model eval | **DONE — VERIFIED LOCAL MODEL PASS^3** | Bounded eval harness only. |
| W16 | Automatic semantic reference selector | **DONE — REPO SIDE** | `semantic-v1`, `maxRefs=3`. |
| W17 | ECX no-oracle validation | **DONE — VERIFIED LOCAL MODEL PASS** | 5×5×4 = 100 measured calls, 5/5 gates. |
| W18 | Hosted economic validation | **FORMAL RUNTIME PASS / CLOSURE HOLD** | 20/20 measured calls PASS; reconcile US$0.091596 pre-run ledger delta before CLOSED. |
| W19 | Release/security governance | **DONE — REPO SIDE** | CI history/naming/model-alias gates retained. |
| W20 | Final current-state sync | **BLOCKED ON W18 RECONCILIATION** | Continue immediately after ledger provenance reconciliation and W18 closure. |

## W18 current facts

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

A W18 PASS proves only a bounded hosted-cost comparison on the five synthetic extraction fixtures under the pinned OpenRouter/Anthropic route. It is not a universal savings claim and does not prove future provider pricing or end-to-end network savings.

W17's local automatic-selector evidence remains separate: W17 proved no-oracle local quality/selector behavior; W18 is specifically the hosted billed-cost closure.

## Immediate next action

```text
1. inspect data/connect-spend-budget.json locally
2. reconcile the US$0.091596 pre-run committed-spend delta
3. preserve ledger history; commit only sanitized provenance
4. if reconciled, close W18
5. complete W20 final current-state sync
6. do not rerun the paid W18 benchmark
```

Do not reopen already-closed W03/W09/W10/W11/W16/W17 unless a new reproducible regression appears on newer product code.
