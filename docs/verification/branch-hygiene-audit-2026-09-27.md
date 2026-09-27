# GitHub branch-hygiene audit — 2026-09-27

Date: **2026-09-27**

Status: **STAGE-4 AUDIT COMPLETE / STAGE-2 CLEANUP EXECUTED PASS / 392 CUMULATIVE SAFE-DELETE / 7 RETAINED / STAGE-4 MERGE PENDING**

Audited repository:

```text
ceritaantarkita-req/ecorione
```

Audited `main`:

```text
c71df6debc1404ea0e974168d5cab38c2952429f
```

This is a non-destructive GitHub branch-hygiene audit after the repository/documentation reconciliation. It classifies remote branches by verifiable PR/head evidence and creates an exact-SHA cleanup allowlist. It does not delete a branch by itself.

## 1. Baseline

At audit start:

- total remote branches including `main`: **394**;
- open pull requests: **0**;
- open issue inventory: **Issue #277 only**, the deferred DR-2 tracker;
- GitHub Releases: **0**;
- current `main`: `c71df6debc1404ea0e974168d5cab38c2952429f`;
- current staging had already converged through Staging Deploy #1302 on the same exact `main` SHA.

Closed PR history scanned: **352** PRs.

## 2. Classification rule

A branch is placed on the safe-delete allowlist only when all of the following are true:

1. it is not `main`;
2. GitHub has a merged PR whose `head.ref` equals the branch name;
3. the branch's **current remote head SHA exactly equals the merged PR head SHA**.

This deliberately avoids assuming that a similarly named branch is safe, avoids treating a closed-unmerged PR as merged, and detects branches that received commits after their merged PR.

Anything failing that exact rule is held for a second-stage audit.

## 3. Result

### Stage 1 — merged-PR/head proof

Initial classification:

- **332 branches — SAFE-DELETE** because a merged PR exists and the current branch head exactly equals the merged PR head;
- **61 branches — HOLD / REVIEW** because they did not satisfy that rule.

### Stage 2 — main-ancestry proof

The 61 held branches collapsed to **49 unique head SHAs**. Each unique head was compared directly against exact audited main:

```text
d0b9c9141cba27fe640f325efff122486d1a1b56
```

A held branch was promoted only when `compare(branch_head...main)` returned `behind_by = 0`, proving that the branch head itself is already an ancestor of `main`.

Stage 2 promoted **22 branches**:

- checkpoint/session6-a02-code-20260925
- checkpoint/session6-a02-final-20260925
- checkpoint/session6-a02-safe-20260925
- checkpoint/session7-a03-code-20260925
- checkpoint/session7-a03-final-20260925
- docs/f6-e03-close-next-audit-20260918
- docs/offhost-dr-checkpoint2-repo-closure-20260922
- docs/w11-artifact-ready-20260916
- fix/w09-w10-port-runtime-followup-v3-20260916
- noop
- docs/w03-final-closure-20260915-copy
- docs/w03-final-closure-20260915-final
- docs/w03-final-closure-20260915-pr
- docs/w03-final-closure-20260915-pr2
- docs/w03-final-closure-20260915-pr3
- docs/w03-final-closure-20260915-pr4
- docs/w03-final-closure-20260915-prhead
- docs/w03-final-closure-20260915-ready
- docs/w03-final-closure-20260915-x
- docs/w03-final-closure-20260915-y
- docs/w03-final-closure-20260915-z
- zzz-test-ignore

Final classification after Stage 2:

- **354 branches — SAFE-DELETE**
  - **332** exact merged-PR-head;
  - **22** verified ancestor-of-main heads.
- **39 branches — HOLD / REVIEW**
  - every held head has `behind_by > 0` against audited `main`, so at least one commit remains outside the `main` commit graph.
- `main` is excluded by definition.
- audit/execution branches created after the baseline are not silently admitted; they require their own later proof.

Machine-readable evidence:

- `docs/verification/branch-hygiene-allowlist-2026-09-27.json`
- `docs/verification/branch-hygiene-hold-review-2026-09-27.json`

The allowlist records every safe-delete candidate's exact remote SHA and proof kind. The hold-review record separately captures all **39** retained branches, their original classification, exact tip SHA, and their audited main-graph `ahead_by` / `behind_by` result. That makes the remaining unique-commit risk explicit instead of relying on branch names or PR status.

## 4. Stage 3 — supersession and retained-branch ancestry

Stage 3 reviewed the 39 unique/diverged branches that remained after Stage 2.

It promoted **19** additional branches:

- **3** heads proven ancestors of a retained successor branch;
- **12** closed-unmerged branches with explicit PR-history supersession / duplicate-verification / abandoned-by-later-merged-path evidence;
- **4** branches whose post-merge deltas were demonstrably superseded by merged/current-main content.

That produced:

- **373 cumulative SAFE-DELETE candidates**;
- **20 retained branches**.

Two retained exceptions were explicitly protected:

- PR #337 / Brain grounded assistant — the cleanup comment says the branch/head remains useful implementation reference;
- PR #91 / Flow Temporal timeout — the branch's 30s -> 60s Temporal integration timeout change is still absent from current main.

Stage 3 merged through PR **#360** as:

```text
a1991f1fd1e321ecbe32f997d0ef87982fc0b20a
```

Final exact-head gates on PR #360:

- CI **#2274** — PASS;
- Product Eval **#1513** — PASS.

Merged-main gates:

- CI **#2275** — PASS;
- Product Eval **#1514** — PASS.

Staging:

- Staging Deploy **#1321** — gate PASS / deploy SKIPPED;
- Staging Deploy **#1322** — actual deploy PASS.

Actual #1322 runtime proof:

- exact host SHA `a1991f1fd1e321ecbe32f997d0ef87982fc0b20a`;
- image `staging-a1991f1fd1e3`;
- public/auth smoke PASS;
- MCP protected-resource metadata + unauthenticated challenge PASS;
- Operations healthy;
- no unhealthy services;
- no non-running configured services;
- clean exact-host worktree;
- **25.01 GiB** stabilized free disk.

## 5. Actual Stage-2 cleanup execution

The destructive cleanup was executed after Stage 2 from the one-time branch:

```text
ops/branch-hygiene-exec-20260927
```

Canonical evidence:

`docs/verification/branch-hygiene-execution-2026-09-27.md`

Execution summary:

- Branch Hygiene One-Time #1 — **FAIL before deletion** due a PowerShell repository-root scalar/array bug;
- Branch Hygiene One-Time #2 — **DRY-RUN PASS**;
- Branch Hygiene One-Time #3 — **APPLY PASS**.

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

Therefore **354 remote branches were actually deleted** with exact-SHA revalidation and zero drift/failure/skip.

A direct GitHub REST recount during Stage 4 observed **47 remote branches** including `main` and the active Stage-4 branch.

## 6. Stage 4 — current-inventory reconciliation

Stage 4 audits the real 47-branch post-execution inventory rather than the original 394/395-branch baseline.

### 6.1 Ephemeral workflow/probe branches

Twelve branches are promoted because their unique commits are explicitly temporary execution/probe workflows and the underlying product/runtime work is already closed elsewhere.

The group contains:

- two temporary Prettier probe branches;
- four one-shot W11 installer-build branches;
- one W11 exact-main installer execution branch;
- two temporary dynamic-port desktop follow-up branches;
- one dynamic-port helper branch containing only temporary patch workflows;
- two temporary W09/W10 port follow-up branches.

Supporting closure paths:

- W09/W10 runtime behavior landed through PRs #103/#104 and closed through PR #107;
- W11 real Windows installer acceptance closed through PR #124.

### 6.2 Comparative-cache closure salvage

`docs/comparative-cache-fix-closure-20260911` carried a docs-only closure delta that had not been replayed into current main.

Stage 4 salvages that delta into:

`docs/verification/comparative-smoke-cache-defect-2026-09-11.md`

before admitting the branch to cleanup.

The preserved evidence records PR #40 exact-head/post-merge CI success and keeps the important claim boundary that the failed cached smoke is not comparative efficiency evidence.

### 6.3 Branch-hygiene branches created after the baseline

Stage 4 also classifies the hygiene machinery itself:

- PR #356 branch — exact merged head;
- PR #357 branch — exact merged head;
- stale PR #358 branch — explicitly superseded by merged PR #357;
- PR #359 branch — exact merged head;
- PR #360 branch — exact merged head;
- `ops/branch-hygiene-exec-20260927` — one-time execution helper whose script fix and execution evidence are preserved by Stage 4.

The active Stage-4 branch is deliberately excluded from its own allowlist.

### 6.4 Stage-4 result

Cumulative machine-readable classification after Stage 4:

- **392 SAFE-DELETE entries**;
- **7 retained substantive branches**.

Of the 392 cumulative entries, the first **354 are already deleted** by execution run #3. The remaining eligible branches can be processed by a later exact-SHA cleanup pass; already-missing entries are explicitly tolerated by the helper.

Machine-readable evidence:

- `docs/verification/branch-hygiene-allowlist-2026-09-27.json`
- `docs/verification/branch-hygiene-hold-review-2026-09-27.json`
- `docs/verification/branch-hygiene-execution-2026-09-27.md`

## 7. The seven retained branches

The remaining seven are intentionally not cleanup-authorized:

1. `agent/a09-space-decomposition-20260926` — four-commit alternative Space decomposition, diverged from merged A-09e PR #348;
2. `agent/native-multimodal-pipeline-20260910` — 21-commit alternative multimodal implementation, diverged from merged Batch 5 PR #15;
3. `ci/f6-e03-release-security-acceptance-gate-20260918` — nine-commit candidate diverged from clean merged PR #151;
4. `feat/session9-a08c-brain-grounded-chat-20260925` — explicitly preserved implementation reference from PR #337;
5. `fix/flow-temporal-ci-timeout-20260915` — unlanded 30s -> 60s Temporal-test timeout change from PR #91;
6. `fix/w18-one-call-diagnostic-v2-20260917` — alternate diagnostic implementation diverged from merged PR #129;
7. `fix/w18-openrouter-routing-metadata-20260917` — alternate routing-metadata implementation diverged from merged PR #132.

These branches require an explicit product/provenance decision, not age- or name-based deletion.

## 8. Cleanup helper

`scripts/cleanup-merged-branches.ps1` remains the bounded executor.

Safety properties:

- dry-run by default;
- explicit `-Apply` required;
- fetch/prune before evaluation;
- exact allowlist only;
- refuses `main`;
- skips the current local branch;
- re-reads each remote ref with `git ls-remote`;
- deletes only on exact SHA match;
- branch movement becomes `hold`;
- missing already-deleted branches become `already-missing`;
- writes a JSON execution report.

Stage 4 also brings the successful execution-branch root-resolution fix into canonical source:

- normalize `Invoke-Git rev-parse --show-toplevel` to an array;
- require at least one line;
- cast the first line to string before `.Trim()`.

## 9. Destructive boundary

The seven retained branches are **not authorized for deletion**.

Branch hygiene also does not authorize:

- runtime feature changes;
- DR-2 external-target selection;
- native Google Drive work;
- hosted-provider spend;
- production cutover;
- credential mutation.

## 10. Safe resume

1. Merge Stage 4 only after exact-head CI + Product Eval PASS.
2. Verify merged-main CI + Product Eval and actual staging deployment on the exact merge SHA.
3. Use the updated allowlist from merged main for the next dry-run.
4. Expect historical Stage-2 entries to report `already-missing`, not failure.
5. Delete only still-present entries whose remote SHA exactly matches the allowlist.
6. Recount remote branches after apply.
7. Keep all seven retained branches unless a later explicit product/provenance decision resolves them.
8. After Stage-4 merge, its own branch may be separately admitted/deleted using the exact merged PR head; do not create an infinite documentation loop just to self-delete audit branches.
