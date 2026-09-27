# ECORIONE — Current State & Next Steps

Last updated: **2026-09-28**

Status: **CURRENT / REPOSITORY+STAGING CONVERGED / ECX B1–B7 CLOSED-PASS / NO ACTIVE PRODUCT-RUNTIME BATCH / DR-2 CHECKPOINT 2 DEFERRED / PRODUCTION CUTOVER DEFERRED**

## Repository identity

```text
repository              = ceritaantarkita-req/ecorione
default branch          = main
runtime compatibility   = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
latest audited docs SHA = 72d680bfb944cc98f60caddcfc94bbffd45f0653
```

`2c2e3c8...` remains the exact closed Batch 7 runtime compatibility baseline. The later reconciliation commits are docs/evidence only.

## Current runtime / staging truth

Latest audited docs-only repository/staging convergence before this cleanup-closure pass:

```text
SHA   = 72d680bfb944cc98f60caddcfc94bbffd45f0653
image = staging-72d680bfb944
```

Latest proof:

| Gate / runtime | Result |
|---|---|
| CI #2356 | PASS |
| Product Eval #1595 | PASS |
| Staging Deploy #1482 | gate PASS |
| Staging Deploy #1483 | actual deploy PASS |
| expected host SHA | matched |
| Operations | `healthy: true` |
| unhealthy services | 0 |
| configured/running services | 15 / 15 |
| non-running services | 0 |
| stabilized free disk | 28.79 GiB |

SumoPod remains **staging, not production**.

## Current architecture

```text
Ai
 -> Hub
    -> Context
    -> Connect -> local/hosted models + MCP
    -> Artifact
    -> Space
    -> Flow -> Temporal
    -> Sandbox
    -> RnD
```

Current ownership remains:

- Hub: policy, approvals, capability authority, audit, orchestration, Historical Ledger and ECX coordination;
- Connect: provider/runtime invocation, credentials/Vault, MCP runtime state and hosted-spend authority;
- Context: memory/retrieval semantics;
- Artifact: raw artifact bytes;
- Flow + Temporal: durable workflow execution/timers/retry/recovery;
- Space: composition/references without duplicating owner data;
- Sandbox: governed execution;
- RnD: trace/eval and dataset-governance foundation.

No ECX Batch 1–7 work introduced a new service or changed these ownership boundaries.

## Closed roadmap families

| Scope | State |
|---|---|
| Original Batch 1–12 / W / F6 | CLOSED at documented boundaries |
| Product Evolution PE-00..PE-08 | CLOSED / PASS |
| PCS-00..PCS-10 | CLOSED / PASS |
| Original Off-host DR | CLOSED / PASS at documented boundary |
| 2026-09-24 audit follow-ups through A-11 | CLOSED / PASS |
| Repository/documentation reconciliation through PR #354 | CLOSED / PASS |
| Historical 393-branch hygiene program | CLOSED / PASS |
| ECX Recipient Execution Batch 1–7 | CLOSED / PASS |

There is **no active Product Evolution, PCS, A-series, or ECX numbered batch**.

There is **no implicit Batch 8, PE-09, PCS-11, Batch 13, or A-12 continuation**.

## ECX Recipient Execution — current capability

The final bounded Batch 1–7 implementation includes:

1. governed single-recipient Hub -> Connect agent execution;
2. durable execution receipts and request-fingerprint conflict protection;
3. one-claim dispatch and success replay without provider redispatch;
4. real Agent A -> Agent B -> Agent A round-trip behavior;
5. single-recipient `delta` parent continuation and `full` standalone handback;
6. explicit `agent.result.receive` authority;
7. returned-result trust/sensitivity/byte/hash evidence;
8. **65,536-byte** per-child returned-result integration cap;
9. hosted-parent owner-backed source eligibility rechecks;
10. Connect completion usage/cost/budget telemetry preservation;
11. replay-safe model-call/token/cost process metrics;
12. deterministic offline quality/economics evidence;
13. Historical Ledger hot-retention + immutable gzip archive compaction;
14. transparent logical replay across archive + hot suffix;
15. archived EventId retry/conflict preservation and fail-closed archive integrity;
16. deterministic **2–8 recipient `delta` fan-out**;
17. per-child Batch 2–4 execution/security semantics;
18. **131,072-byte** aggregate returned-material cap;
19. aggregate SHA-256 evidence;
20. durable fan-out receipts and Workspace-scoped status;
21. exactly one sender/parent aggregation continuation;
22. bounded Historical Ledger aggregate-return/continuation provenance.

Canonical final checkpoint:
[verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

### ECX explicit non-claims

Current ECX does **not** implement or prove:

- external A2A interoperability;
- arbitrary recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- default broadcast;
- broad ECX/History product UI;
- automatic destructive Historical Ledger purge scheduling;
- paid-provider/W18 freshness;
- universal quality, latency or savings superiority;
- DR-2 physical independence;
- production promotion/cutover.

## Current security / identity boundary

The general Ai staging surface is private-by-default behind the existing operator Basic-Auth boundary while MCP discovery/OAuth remains separate.

This is a bounded staging human gate. It is **not** final multi-user identity/RBAC and must not be described as production authorization.

The 2026-09-24 selected audit follow-ups through A-11 remain closed at their documented scopes.

## Backup / DR

The original total-SumoPod-host-loss Off-host DR drill is **CLOSED / PASS** at its documented boundary.

DR-2 is additive and remains **DEFERRED at checkpoint 2** before genuinely external target selection.

Current facts:

- Issue #277 is the only open issue at the audit boundary;
- DR-2 physical independence is **not yet proven**;
- local backup remains the interim posture;
- an encrypted Google Drive copy may be considered later but is not currently a validated DR-2 target.

Do not downgrade or rewrite the original DR closure merely because DR-2 remains deferred.

## Repository / branch hygiene

Both bounded cleanup waves are now **CLOSED / PASS**.

Historical cleanup:

```text
393 / 393 historical exact-SHA safe-delete entries absent
```

Post-ECX cleanup (Actions run `36338085729`):

```text
15 allowlisted ECX branches deleted
2 reconciliation branches deleted after exact-ref validation
1 temporary helper self-deleted
final remote branch count = 9
unexpected branches = 0
```

The retained 9-branch set is `main`, seven retained substantive/provenance branches, and the historical branch-hygiene checkpoint branch.

Execution evidence:
[verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md).

## Current active work

There is **no active product/runtime implementation scope and no active repository-hygiene scope**.

Current docs are reconciled, the post-ECX branch delta is cleaned, and no new roadmap is opened.

## Explicit deferred / separately selectable future scopes

Any of the following requires a new explicit operator decision and its own bounded scope:

- DR-2 checkpoint 2 external target selection and later runtime proof;
- public production promotion/cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- paid hosted-provider/W18 reruns;
- external A2A interoperability;
- recursive agent graphs;
- Flow/Temporal long-running ECX execution;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge;
- AutoClick / L4 autonomy.

## Resume instructions

For a new session/agent:

1. read [README.md](../README.md);
2. read this file;
3. read [active-work-plan.md](active-work-plan.md);
4. read [../AGENTS.md](../AGENTS.md);
5. inspect exact current `main`;
6. open only the explicitly authorized new scope;
7. use dated verification files as evidence, not as the current queue.

Latest repository truth reconciliation:
[verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md).

Do not restart closed roadmap work merely for freshness.
