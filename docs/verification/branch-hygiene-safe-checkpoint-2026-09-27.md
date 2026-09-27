# Branch hygiene final safe checkpoint — 2026-09-27

Date: **2026-09-27**

Status: **FINAL / CLOSED / LOCKED — CLEANUP COMPLETE**

Execution baseline main proven immediately before this final documentation lock:

```text
c52564a31bbd2d5ed9f988525c78ff1f6da8c09f
```

This document is the canonical branch-hygiene closure checkpoint. The documentation-lock commit that contains this file intentionally advances `main` by docs only; it does not change product/runtime behavior.

## 1. What is complete

Repository/documentation reconciliation and branch hygiene are complete.

The bounded branch-hygiene stages were:

- Stage 1: exact merged-PR-head classification;
- Stage 2: main-ancestry classification and first destructive cleanup;
- Stage 3: supersession / retained-branch ancestry review;
- Stage 4: reconciliation against the real post-cleanup inventory, salvage of missing docs-only evidence, and classification of temporary execution/probe branches;
- Cleanup pass 2: exact-SHA revalidation and deletion of the final 39 cleanup-ready branches.

Stage 4 merged through PR **#361 — `docs: reconcile executed branch cleanup and stage 4`**.

Stage-4 reviewed head:

```text
316ba052baec2a4b7509e3761dd151a7fcf03f1c
```

Stage-4 merge:

```text
9e621680661f7128b9cfea930fd470472ed94381
```

The safe-checkpoint documentation PR **#362 — `docs: add branch hygiene safe checkpoint`** merged as:

```text
c52564a31bbd2d5ed9f988525c78ff1f6da8c09f
```

## 2. Proven pre-cleanup runtime state

Stage-4 exact-head and merged-main gates passed:

- CI #2276 — PASS;
- Product Eval #1515 — PASS;
- merged-main CI #2277 — PASS;
- merged-main Product Eval #1516 — PASS.

Actual Staging Deploy #1326 proved:

- exact target/host SHA `9e621680661f7128b9cfea930fd470472ed94381`;
- image `staging-9e621680661f`;
- clean detached staging worktree;
- auth + MCP smoke PASS;
- Operations `healthy: true`;
- Operations unhealthy services: **0**;
- configured services: **15**;
- running services: **15**;
- non-running services: **0**;
- stabilized free disk: **29.92 GiB**.

PR #362 final reviewed head `b957ae98ccdbeb2db2d13614c03ec8c06289b1ba` also passed exact-head CI/Product Eval, post-merge CI/Product Eval, and actual Staging Deploy #1332. That deploy proved exact-host identity, preserved auth/MCP boundaries, healthy Operations, **15/15** configured services running, and **28.78 GiB** stabilized free disk.

## 3. First destructive cleanup

The first destructive cleanup is preserved in:

`docs/verification/branch-hygiene-execution-2026-09-27.md`

Historical execution:

- Branch Hygiene One-Time #1 — FAIL before deletion because of a PowerShell repository-root scalar/array bug;
- Branch Hygiene One-Time #2 — DRY-RUN PASS;
- Branch Hygiene One-Time #3 — APPLY PASS.

Dry-run #2:

```text
allowlisted=354
would-delete=354
already-missing=0
hold=0
failed=0
skip=0
```

Apply #3:

```text
allowlisted=354
deleted=354
already-missing=0
hold=0
failed=0
skip=0
```

Therefore the first cleanup deleted **354 remote branches** with exact-SHA revalidation.

## 4. Cleanup pass 2 — final destructive cleanup

Cleanup pass 2 used the committed exact-SHA allowlist:

`docs/verification/branch-hygiene-allowlist-2026-09-27.json`

Before APPLY, all 39 still-present cleanup-ready branches were independently revalidated against their committed expected SHA.

One-time execution:

- workflow: **Branch Hygiene Pass 2 One-Time**;
- Actions run ID: **36294553329**;
- execution head: `ac13919d2ff9b7723038b22afd0b8111fdac8c25`;
- result: **PASS**.

Dry-run:

```text
allowlisted=393
would-delete=39
already-missing=354
hold=0
failed=0
skip=0
```

APPLY:

```text
allowlisted=393
deleted=39
already-missing=354
hold=0
failed=0
skip=0
```

Final workflow verification:

```text
FINAL_REMOTE_BRANCH_COUNT=9
BRANCH_HYGIENE_PASS2=PASS
```

The temporary pass-2 execution branch self-deleted after the exact final inventory check.

Cumulative destructive result:

```text
393 cumulative SAFE-DELETE entries
393 deleted / absent
0 SAFE-DELETE entries still present
0 SHA-drift holds during cleanup
0 deletion failures
0 protected/current-branch skips
```

## 5. Final remote branch inventory

Post-cleanup remote GitHub inventory is exactly:

```text
9 total remote branches
= 1 main
+ 7 retained branches
+ 1 final checkpoint branch
```

Final branch set:

1. `main`
2. `agent/a09-space-decomposition-20260926`
3. `agent/native-multimodal-pipeline-20260910`
4. `ci/f6-e03-release-security-acceptance-gate-20260918`
5. `feat/session9-a08c-brain-grounded-chat-20260925`
6. `fix/flow-temporal-ci-timeout-20260915`
7. `fix/w18-one-call-diagnostic-v2-20260917`
8. `fix/w18-openrouter-routing-metadata-20260917`
9. `docs/branch-hygiene-safe-checkpoint-20260927`

Reconciliation against the committed allowlist proved:

- SAFE-DELETE entries still present: **0 / 393**;
- retained branches present: **7 / 7**;
- unexpected branches: **0**;
- open PRs at final remote verification: **0**.

## 6. Seven retained branches

These seven remain **not authorized for deletion**:

1. `agent/a09-space-decomposition-20260926`
2. `agent/native-multimodal-pipeline-20260910`
3. `ci/f6-e03-release-security-acceptance-gate-20260918`
4. `feat/session9-a08c-brain-grounded-chat-20260925`
5. `fix/flow-temporal-ci-timeout-20260915`
6. `fix/w18-one-call-diagnostic-v2-20260917`
7. `fix/w18-openrouter-routing-metadata-20260917`

All seven were post-cleanup reverified at their checkpoint SHA with exact identity (`identical`, ahead 0, behind 0).

Important protected cases remain unchanged:

- Brain grounded chat is an explicit implementation reference from PR #337;
- Flow Temporal timeout contains a 30s -> 60s test-timeout change still not present on the execution-baseline main;
- the other retained branches preserve substantive/divergent or unlanded provenance pending separate product/content decisions.

The final checkpoint branch `docs/branch-hygiene-safe-checkpoint-20260927` is bookkeeping evidence and remains intentionally retained. Do not create another documentation-only loop solely to classify/delete it.

## 7. Deferred scopes remain separate

Branch hygiene does not open or resolve unrelated deferred scopes.

At closure:

- open PRs: **0**;
- Issue #277 remains the deferred DR-2 physical-independence tracker;
- public production cutover remains deferred;
- native Google Drive remains deferred;
- hosted-provider spend remains deferred;
- no A-series, PE, PCS, or product/runtime implementation batch is implicitly opened.

## 8. Final locked checkpoint

```text
branch hygiene: FINAL / CLOSED / LOCKED
execution baseline main: c52564a31bbd2d5ed9f988525c78ff1f6da8c09f
Stage-4 PR: #361
safe-checkpoint PR: #362
cleanup pass-2 Actions run: 36294553329
cleanup pass-2 execution head: ac13919d2ff9b7723038b22afd0b8111fdac8c25

cumulative safe-delete evidence: 393 branches
first cleanup deleted: 354 branches
second cleanup deleted: 39 branches
safe-delete branches still present: 0
retained / not authorized for deletion: 7 branches
final checkpoint bookkeeping branch: 1
main: 1
final remote branch count: 9
unexpected remote branches: 0
open PRs at final verification: 0

DR-2 checkpoint 2: deferred
native Google Drive: deferred
hosted-provider spend: deferred
production cutover: deferred
```

Branch hygiene is closed. Do not rerun Stages 1–4 or repeat historical branch classification unless future remote branch changes create genuinely new work.
