# Branch hygiene safe checkpoint — 2026-09-27

Date: **2026-09-27**

Status: **SAFE / RESUMABLE — STAGE 4 CLOSED / CLEANUP PARTIALLY EXECUTED**

Current repository main proven at this checkpoint:

```text
9e621680661f7128b9cfea930fd470472ed94381
```

## 1. What is already complete

Repository/documentation reconciliation is already CLOSED / PASS.

Branch hygiene then progressed through four bounded stages:

- Stage 1: exact merged-PR-head classification;
- Stage 2: main-ancestry classification and first destructive cleanup;
- Stage 3: supersession / retained-branch ancestry review;
- Stage 4: reconciliation against the real post-cleanup inventory, salvage of missing docs-only evidence, and classification of temporary execution/probe branches.

Stage 4 merged through PR **#361 — `docs: reconcile executed branch cleanup and stage 4`**.

Exact reviewed Stage-4 PR head:

```text
316ba052baec2a4b7509e3761dd151a7fcf03f1c
```

Stage-4 squash merge / current implementation-doc state:

```text
9e621680661f7128b9cfea930fd470472ed94381
```

## 2. Stage-4 gates

Exact-head PR #361 gates:

- CI **#2276** — PASS;
- Product Eval **#1515** — PASS.

Merged-main gates:

- CI **#2277** — PASS;
- Product Eval **#1516** — PASS.

Staging delivery:

- Staging Deploy **#1325** — gate PASS / deploy SKIPPED;
- Staging Deploy **#1326** — actual deploy PASS.

Actual Staging Deploy #1326 proved:

- exact target/host SHA `9e621680661f7128b9cfea930fd470472ed94381`;
- image `staging-9e621680661f`;
- clean detached staging worktree;
- root unauthenticated bootstrap `302 -> /login`;
- `/login`, `/ops`, `/settings`, representative Ai/API reads, and chat/forget mutations fail closed with `401 + Basic challenge`;
- MCP protected-resource metadata 200;
- MCP unauthenticated OAuth challenge 401;
- Operations `healthy: true`;
- Operations unhealthy services: **0**;
- configured services: **15**;
- running services: **15**;
- non-running services: **0**;
- stabilized free disk after retention: **29.92 GiB**.

## 3. Destructive cleanup already executed

The first destructive branch cleanup was executed from the one-time execution branch and is preserved in:

`docs/verification/branch-hygiene-execution-2026-09-27.md`

Execution history:

- Branch Hygiene One-Time #1 — FAIL **before deletion** because of a PowerShell repository-root scalar/array bug;
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

Therefore **354 remote branches have already been deleted** with exact-SHA revalidation.

## 4. Current real GitHub branch state

Before opening this safe-checkpoint branch, direct GitHub enumeration returned:

```text
47 total remote branches
= 1 main
+ 38 already-allowlisted cleanup-ready branches
+ 7 retained branches
+ 1 merged Stage-4 audit branch
```

PR #361's Stage-4 branch is now itself proven safe by exact merged-PR-head evidence and has been added to the allowlist.

The current durable classification therefore becomes:

```text
393 cumulative SAFE-DELETE entries
354 already deleted
39 cleanup-ready branches still present
7 retained branches
1 main
0 unclassified branches
```

The present checkpoint branch `docs/branch-hygiene-safe-checkpoint-20260927` is intentionally excluded from its own classification. Do not create an infinite documentation loop merely to classify/delete bookkeeping branches.

## 5. Seven retained branches

These seven are **not authorized for deletion**:

1. `agent/a09-space-decomposition-20260926`
2. `agent/native-multimodal-pipeline-20260910`
3. `ci/f6-e03-release-security-acceptance-gate-20260918`
4. `feat/session9-a08c-brain-grounded-chat-20260925`
5. `fix/flow-temporal-ci-timeout-20260915`
6. `fix/w18-one-call-diagnostic-v2-20260917`
7. `fix/w18-openrouter-routing-metadata-20260917`

Important protected cases:

- Brain grounded chat remains an explicit implementation reference from PR #337;
- Flow Temporal timeout contains a 30s -> 60s test-timeout change that is still not present on current main.

The other retained branches also still carry substantive/divergent or unlanded provenance and require a separate product/content decision before deletion.

## 6. Current GitHub state

At the start of this checkpoint:

- open PRs: **0**;
- open issues: **Issue #277 only**;
- Issue #277 remains the deferred DR-2 physical-independence tracker;
- public production cutover remains deferred;
- native Google Drive remains deferred;
- hosted-provider spend remains deferred;
- no A-series, PE, PCS, or product implementation batch is implicitly opened.

## 7. Next safe action

The next branch-hygiene action is **not another audit from zero**.

Resume from the committed exact-SHA allowlist:

`docs/verification/branch-hygiene-allowlist-2026-09-27.json`

The next destructive cleanup pass may target only the **39 currently present cleanup-ready branches** and must:

1. run the cleanup helper in dry-run mode first;
2. revalidate each remote branch SHA immediately before deletion;
3. tolerate already-missing branches;
4. skip/hold any branch whose SHA moved;
5. never delete `main`;
6. never delete the seven retained branches;
7. recount GitHub branches after apply;
8. write sanitized execution evidence;
9. do not create another documentation-only loop solely to self-delete the checkpoint branch.

## 8. Safe checkpoint

```text
branch hygiene: STAGE 4 CLOSED / PASS
current proven main: 9e621680661f7128b9cfea930fd470472ed94381
Stage-4 PR: #361
Stage-4 reviewed head: 316ba052baec2a4b7509e3761dd151a7fcf03f1c
exact-head CI #2276: PASS
exact-head Product Eval #1515: PASS
merged-main CI #2277: PASS
merged-main Product Eval #1516: PASS
actual staging deploy #1326: PASS
staging services: 15/15 running
Operations unhealthy services: 0
stabilized staging free disk: 29.92 GiB

cumulative safe-delete evidence: 393 branches
already deleted: 354 branches
cleanup-ready and still present: 39 branches
retained / not authorized for deletion: 7 branches
unclassified remote branches at checkpoint baseline: 0
open PRs at checkpoint start: 0
open issue: #277 only
DR-2 checkpoint 2: deferred
native Google Drive: deferred
hosted-provider spend: deferred
production cutover: deferred
```
