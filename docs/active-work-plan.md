# ECORIONE — Active Work Plan

Last updated: **2026-09-27**

Status: **NO ACTIVE PRODUCT/RUNTIME IMPLEMENTATION / CURRENT DOC LAYER RECONCILED / POST-ECX BRANCH CLEANUP READY-PENDING-EXECUTION**

## Current queue

There is **no active Product Evolution, PCS, A-series, original Batch, or ECX numbered implementation batch**.

Closed current baselines:

- original Batch 1–12 / W / F6 — CLOSED at documented boundaries;
- PE-00..PE-08 — CLOSED / PASS;
- PCS-00..PCS-10 — CLOSED / PASS;
- selected 2026-09-24 audit follow-ups through A-11 — CLOSED / PASS;
- original Off-host DR — CLOSED / PASS at documented boundary;
- ECX Recipient Execution Batch 1–7 — CLOSED / PASS.

No Batch 8, PE-09, PCS-11, Batch 13, or next A-series item is automatically opened.

## Repository housekeeping

### 1. Current-doc reconciliation — CLOSED BY THIS RECONCILIATION

Goal:

- make `README.md`, `AGENTS.md`, documentation navigation, current-state and progress summaries reflect exact current `main` + staging;
- remove stale “current” branch-hygiene claims;
- keep historical WIP/closure evidence intact;
- separate current truth from dated evidence.

Audited runtime baseline:

```text
main / staging = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
CI             = #2352 PASS
Product Eval   = #1591 PASS
Staging Deploy = #1475 PASS
services       = 15/15 running
Operations     = healthy
free disk      = 26.31 GiB stabilized
```

Evidence:
[verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md).

### 2. Post-ECX branch cleanup — REMAINING / READY / NOT YET EXECUTED

The historical 393-branch cleanup is finished and must not be rerun from zero.

Later ECX work created 15 pre-reconciliation branches beyond the old 9-branch checkpoint.

Those 15 branches are classified in:

[verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json](verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json).

Required execution sequence:

```powershell
./scripts/cleanup-merged-branches.ps1 \
  -AllowlistPath docs/verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json
```

Review the dry-run. Only if every expected ref still matches:

```powershell
./scripts/cleanup-merged-branches.ps1 \
  -AllowlistPath docs/verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json \
  -Apply
```

If any remote SHA moved, hold that branch. Do not delete it by name alone.

The current reconciliation branch is separate from the pre-audit 15 and should be deleted after merge when branch deletion tooling is available.

## ECX Recipient Execution baseline — CLOSED / PASS

| Batch | State |
|---|---|
| 1 — Recipient Execution Foundation | CLOSED / PASS |
| 2 — Execution Contract + Idempotency + Provenance | CLOSED / PASS |
| 3 — Real Agent A -> Agent B round trip | CLOSED / PASS |
| 4 — Security, isolation, result integration | CLOSED / PASS |
| 5 — End-to-end observability, quality, economics | CLOSED / PASS |
| 6 — Historical Ledger retention/compaction/migration | CLOSED / PASS |
| 7 — Advanced execution/productization | CLOSED / PASS |

Canonical final checkpoint:
[verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

Do not restart B1–B7 for freshness.

## DR-2

Issue #277 remains open but **DR-2 runtime work is not active**.

Current state:

- checkpoint 1 repository foundation — CLOSED / PASS;
- checkpoint 2 external-target selection — DEFERRED / SAFE-PAUSED;
- physical-independence runtime proof — NOT YET PROVEN;
- local backup — interim posture;
- encrypted Google Drive copy — possible later secondary copy, not currently a validated DR-2 target.

Do not select/provision/pay for external infrastructure without explicit operator authorization.

## Production

Public production promotion remains **DEFERRED / SEPARATE GATE**.

SumoPod is current verified staging.

Do not reinterpret staging Basic Auth, staging runtime evidence, or DR evidence as final production authorization/SLA.

## Separately selectable future scopes

The following are eligible only through an explicit new decision; none is current work:

- DR-2 checkpoint 2;
- production cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- hosted-provider paid reruns/W18 freshness;
- external A2A;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge;
- broad ECX/History UI;
- automatic destructive Ledger purge;
- AutoClick / L4 autonomy.

## Rules for the next implementation scope

When the operator selects the next real scope:

1. start from exact synchronized `main`;
2. name the scope explicitly;
3. define accepted behavior and non-goals before coding;
4. keep service ownership unchanged unless an explicit architecture decision says otherwise;
5. add deterministic tests for new behavior;
6. require exact-head gates;
7. merge only reviewed head;
8. prove merged-main gates;
9. deploy exact reviewed `main` to staging only when the scope changes runtime;
10. update current docs once, after the real state is known;
11. keep dated evidence historical.

Do not create documentation-only “next batches” simply to continue numbering.
