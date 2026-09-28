# ECORIONE — Active Work Plan

Last updated: **2026-09-28**

Status: **NO ACTIVE PRODUCT/RUNTIME IMPLEMENTATION / NVIDIA HOSTED TRIAL CLOSED-PASS / CURRENT DOC LAYER RECONCILED / BRANCH HYGIENE CLOSED-PASS**

## Current queue

There is **no active Product Evolution, PCS, A-series, original Batch, or ECX numbered implementation batch**.

Closed current baselines:

- original Batch 1–12 / W / F6 — CLOSED at documented boundaries;
- PE-00..PE-08 — CLOSED / PASS;
- PCS-00..PCS-10 — CLOSED / PASS;
- selected 2026-09-24 audit follow-ups through A-11 — CLOSED / PASS;
- original Off-host DR — CLOSED / PASS at documented boundary;
- ECX Recipient Execution Batch 1–7 — CLOSED / PASS;
- NVIDIA hosted-provider trial + staging activation + Docker native-build hardening — CLOSED / PASS.

No Batch 8, PE-09, PCS-11, Batch 13, or next A-series item is automatically opened.

## Repository housekeeping

Repository/documentation reconciliation and the post-ECX branch cleanup are both **CLOSED / PASS**.

Latest hygiene executions:

```text
post-ECX cleanup run         = 36338085729
NVIDIA trial cleanup run     = 36368987090
NVIDIA work branches deleted = 3
helpers self-deleted         = yes
final remote branch count    = 9
unexpected branches          = 0
```

Evidence:

- [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)

There is no active repository-hygiene queue. Future branch growth must be handled as a new exact-SHA delta, not by rerunning historical cleanups.

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

## NVIDIA hosted-provider trial — CLOSED / PASS

Current proven boundary:

- provider `nvidia` / NVIDIA / NIM is live in Settings and Connect;
- pinned hosted model is `z-ai/glm-5.3`;
- staging operator hosted kill switch is open under bounded spend controls; runtime hosted activation still follows the normal Settings/provider activation path;
- Docker native dependency fallback is hardened and proven on SumoPod;
- the latest runtime-changing merge and staging are converged at `0f86a34cde66dd541dae9a830ae8cc155e1efe6b`; later docs-only checkpoint commits may advance live Git/staging SHA without changing runtime behavior;
- user NVIDIA secret has not yet been stored/tested.

User-level validation is not a new implementation batch. It is a normal Settings action: enter key -> Test API key -> Save & activate -> send one Ai message.

Checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

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
