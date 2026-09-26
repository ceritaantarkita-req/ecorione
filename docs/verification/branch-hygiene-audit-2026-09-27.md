# GitHub branch-hygiene audit — 2026-09-27

Date: **2026-09-27**

Status: **STAGE-2 CLOSED / 354 SAFE-DELETE / 39 RETAINED / DELETION NOT YET EXECUTED**

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

## 4. Why the remaining 39 are held

The remaining hold set contains several kinds of potentially meaningful provenance:

- checkpoint/recovery branches;
- probe/diagnostic branches;
- abandoned or superseded PR heads;
- branches with no PR mapping;
- branches whose remote head moved after a merged PR.

Examples include `checkpoint/*`, installer/probe branches, duplicate historical docs heads, and four branches with post-merge movement.

No held branch should be deleted merely because its name looks old.

## 5. Cleanup tool

`scripts/cleanup-merged-branches.ps1` is the bounded cleanup executor.

Safety properties:

- dry-run by default;
- requires explicit `-Apply` for deletion;
- fetches/prunes before evaluation;
- loads only the committed exact-SHA allowlist;
- refuses `main`;
- skips the currently checked-out local branch;
- re-reads each remote branch SHA with `git ls-remote`;
- deletes only when the current remote SHA still equals the allowlisted expected SHA;
- if a branch moved after this audit, it is automatically skipped;
- branches already deleted are reported, not treated as failures;
- writes an execution report locally.

This means a later branch mutation cannot silently inherit an old deletion decision.

## 6. Destructive boundary

This audit **does not authorize deletion of the 39 held branches**.

A second-stage audit is required for them. That review should determine whether each held branch is:

- an ancestor/checkpoint already represented by current `main`;
- superseded by another merged PR;
- uniquely carrying commits or tree state;
- useful recovery provenance;
- disposable test/probe state.

## 7. Stage-2 merge + runtime proof

Stage 2 merged through PR **#357**.

Exact reviewed PR head:

```text
8cddeb0f6bb4b81001faccabbeed8440317087a5
```

Exact-head gates:

- CI **#2268** — PASS;
- Product Eval **#1507** — PASS.

Squash-merged `main`:

```text
97a34c3582917745dc4ecfb7f175b77cc3598148
```

Merged-main gates:

- CI **#2269** — PASS;
- Product Eval **#1508** — PASS.

Staging delivery:

- Staging Deploy **#1309** — gate PASS, deploy SKIPPED;
- Staging Deploy **#1310** — gate PASS, deploy PASS.

Actual deploy #1310 proved exact host SHA `97a34c3582917745dc4ecfb7f175b77cc3598148`, clean worktree, preserved public/auth + MCP boundaries, healthy Operations with no unhealthy services, no non-running configured services, and **27.81 GiB** stabilized free space.

PR #358 was later closed **without merge** because it duplicated Stage-2 containment work after PR #357 had already merged. Its stale branch is not authority.

## 8. Execution limitation in this session

The repo-side audit and safe cleanup tooling are complete. Actual remote deletion requires an authenticated git client capable of `git push origin --delete`.

The authorized desktop connector was offline during this audit, and the available GitHub connector does not expose a remote-branch deletion mutation. Therefore no branch deletion is claimed in this record.

When an authenticated local git client is available, run the cleanup script in dry-run mode first, inspect the result, then use `-Apply`.

## 8. Safe resume

1. Do not recompute the 332 allowlisted branches by branch-name pattern alone.
2. Use the committed JSON allowlist and exact-SHA revalidation.
3. Run dry-run first.
4. Apply deletion only to branches still matching their audited SHA.
5. Recount branches after cleanup.
6. Audit the remaining 39-branch hold set separately.
7. Do not touch `main`, Issue #277/DR-2 scope, staging credentials, production cutover, or runtime code as part of branch cleanup.
