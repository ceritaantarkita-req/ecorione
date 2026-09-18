# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-18**

Status: **CURRENT — defined closure map complete; future work remains evidence-driven**

Start from `docs/current-state-and-next-steps.md`, then this file. Historical Batch 1–12 chronology remains in `docs/archive/`; dated audits and failed-attempt records are evidence snapshots and must not be rewritten into current status.

## Status legend

| Status | Meaning |
|---|---|
| `CLOSED` | Implementation/evidence boundary satisfied and documented. |
| `PASS WITH LIMITATIONS` | Gates passed with bounded limitations retained. |
| `REPO SIDE DONE` | Repository implementation/gates complete; runtime evidence may remain external. |
| `FORMAL RUN READY` | Prerequisites and bounded diagnostic passed; final runtime evidence not yet executed. |
| `BLOCKED` | Intentionally waiting on an earlier workstream. |
| `DEFERRED` | Explicitly postponed by operator/design. |
| `OPEN-ENDED` | Evidence-driven hardening, never permanently finished. |

## Current closure map

| ID / area | State | Current boundary |
|---|---:|---|
| Batch 1–12 | **12/12 CLOSED** | Defined implementation roadmap. |
| Historical Ledger + ECX | **CLOSED / PASS** | Local chronology/hash-chain + pointer/hydration evidence. |
| Historical Comparative ECX | **CLOSED / PASS WITH LIMITATIONS** | Oracle-control local benchmark; not automatic selector or hosted-dollar proof. |
| W03 | **CLOSED — REAL-LAPTOP VERIFIED** | UX/product runtime boundary completed. |
| W09/W10 | **CLOSED — WINDOWS RUNTIME VERIFIED** | Startup/doctor bounded Windows evidence. |
| W11 | **CLOSED — WINDOWS INSTALLER VERIFIED** | Packaged installer lifecycle passed. |
| W12–W15 | **CLOSED at documented boundaries** | Attachment path, immutable identity, product eval, bounded agentic local eval. |
| W16 | **REPO SIDE DONE** | Automatic `semantic-v1` selector, `maxRefs=3`. |
| W17 | **CLOSED — VERIFIED LOCAL MODEL PASS** | 100 measured calls, 5/5 task gates, no-oracle automatic lane. |
| W18 | **CLOSED / PASS WITH DOCUMENTED DUPLICATE-EXECUTION INCIDENT** | Formal hosted economics passed; duplicate batch reconciled; one-shot guard merged via PR #142. |
| W19 | **REPO SIDE DONE** | Release/security governance gates retained. |
| W20 | **CLOSED** | Final canonical current-state synchronization completed. |
| F6-E01 | **IMPLEMENTED / IN REVIEW** | 10 held-out bug/task-derived selector cases; 26/50 global eval inventory; Product Eval wired; exact-head gates pending. |
| Compute-host/VPS + Cloudflare | **DEFERRED BY OPERATOR** | Not a W18 blocker. |
| AutoClick | **DEFERRED BY DESIGN** | No implicit activation. |
| Fase 6+ | **OPEN-ENDED / ACTIVE THROUGH F6-E01** | Evidence-driven; no implicit Batch 13. |

## W16/W17 transition retained

W16 removed the caller/oracle requirement from the automatic selector by adding `selection: { mode: "semantic-v1", maxRefs: 3 }`. W17 then closed the bounded local no-oracle validation over:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured calls
cache hits = 0
passed task gates = 5/5
median automatic selector recall = 1.0
```

W17 proves local model-context/input-token and selected-hydration reductions at the tested boundary. It does not prove hosted provider billed-cost savings or universal end-to-end network savings.

## W18 chronology and current closure state

Attempts 1–4 remain preserved in their dated verification notes. The final formal runtime then executed on synchronized clean `main` `f249d9c0681462253bff21ca30354892ca4ce60f`.

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

### Duplicate-execution reconciliation

The local durable ledger resolves the US$0.091596 delta as an earlier complete 20-entry settled W18-shaped batch. Its full-inline actual total was US$0.059046 and automatic ECX total US$0.032550. The later PASS batch cost US$0.091716. Combined durable spend was US$0.183312, below the US$0.25 monetary ceiling.

The duplicated execution violated the one-attempt process boundary and exposed missing persistent authorization consumption in the wrapper. PR #142 fixed this by refusing completed formal PASS evidence and atomically consuming a gitignored one-shot marker before hosted dispatch. Exact reviewed head `1f0d87963857d4bb261579204e76bae970c496b0` passed CI #1012 and Product Eval #251 and merged at `cff6e21edc8085bb895c6ed59c32b5e4aa134ee0`.

Canonical verification: `docs/verification/w18-formal-hosted-economics-pass-reconcile-2026-09-18.md`, `docs/verification/w18-duplicate-execution-reconciliation-2026-09-18.md`, and `docs/verification/w18-final-closure-2026-09-18.md`.

W20 final closure: `docs/verification/w20-final-current-state-closure-2026-09-18.md`.

## Persistent evidence rules

- Historical Ledger and Context L0 remain semantic ground truth.
- Memory is untrusted data, never instructions.
- No cross-service DB access.
- Hub remains policy/approval authority; Connect remains provider/credential/MCP authority; Artifact owns L3 bytes.
- No silent provider fallback.
- Hosted dispatch obeys kill switch and durable cumulative budget.
- Exact-cache hits cannot contaminate comparative model-compute evidence.
- Local USD `0` is not hosted billed-cost evidence.
- Provider-reported billed cost is authoritative for W18.
- Valid failed evidence is preserved after fixes.
- Raw private runtime evidence remains local/gitignored; commit only sanitized summaries.
- Historical dated audits are not silently rewritten into current status.


## F6-E01 active scope

Baseline is synchronized local/remote `main` at `943e46bf7cfd53063e8d8e4970d0c9aa7713dce9`.

F6-E01 now implements 10 deterministic held-out `semantic-v1` selector cases derived only from real bug/task provenance, keeps expected relevance evaluation-only, enforces a repository-wide governed inventory of 26/50 cases, and is wired into Product Eval. It does not call a provider and does not create a universal optimizer/generalization claim. Closure waits on exact-head CI/Product Eval and guarded merge.
