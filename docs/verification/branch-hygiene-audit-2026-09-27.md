# GitHub branch-hygiene audit — 2026-09-27

Date: **2026-09-27**

Status: **STAGE-3 AUDIT COMPLETE / 373 SAFE-DELETE / 20 RETAINED / DELETION NOT YET EXECUTED**

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

Stage 3 reviewed the 39 unique/diverged branches instead of assuming every non-main commit must keep its own branch forever.

Three additional branch heads were proven ancestors of a retained successor branch:

```text
automation/dynamic-ai-port-helper
  -> dynamic-ai-port-helper-v5
  -> dynamic-ai-port-helper-v6
  -> dynamic-ai-port-helper-v7
```

The first three heads are fully contained in retained `v7` and therefore do not carry unique provenance once `v7` is preserved.

Fourteen closed-unmerged PR branches were reviewed from their PR body/conversation history:

- **12** contain explicit supersession, duplicate-verification, or abandoned-by-later-merged-path evidence and were promoted;
- **PR #337 / Brain grounded chat** remains retained because its cleanup comment explicitly says the branch/head is useful implementation reference;
- **PR #91 / Flow Temporal timeout** remains retained because its 30s -> 60s timeout change is still absent from current main.

The four branches that had advanced after a merged PR were then reviewed:

- `feat/session8-a05b3a-url-source-ingestion-20260925`: post-merge DNS-pinning work is represented by merged PR #323 and current main;
- `fix/session7-a03-stale-project-selection-20260925`: the only post-merge delta is formatter alignment already superseded by current-main formatting;
- `pe/pe-03-trigger-control-plane-20260919`: the only post-merge delta is an older closure-candidate document superseded by the current CLOSED / PASS record;
- `security/f6-e06-immutable-node-toolchain-20260918`: the only post-merge delta is an expected line-number adjustment superseded by the current test.

Stage 3 therefore promotes **19** more branches:

- 3 ancestor-of-retained-branch;
- 12 explicit PR-history supersession;
- 4 post-merge deltas superseded by merged/current-main content.

Final Stage-3 classification:

- **373 SAFE-DELETE candidates**;
- **20 RETAINED branches** with unresolved unique provenance.

## 5. Why the remaining 20 are held

Every remaining branch still carries commits outside audited main and lacks sufficient proof that those commits are preserved elsewhere or intentionally disposable.

The retained set includes:

- implementation/probe branches with no PR mapping;
- divergent alternative attempts;
- the explicitly retained Brain grounded-assistant reference;
- the unlanded Temporal timeout change;
- diagnostic/runtime branches whose versioned names do not form a proven ancestry chain.

No retained branch should be deleted merely because its name looks old or a newer-looking sibling exists.

## 6. Cleanup tool

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

## 7. Destructive boundary

This audit **does not authorize deletion of the 20 retained branches**.

A later content/provenance audit is required for them. That review should determine whether each held branch is:

- an ancestor/checkpoint already represented by current `main`;
- superseded by another merged PR;
- uniquely carrying commits or tree state;
- useful recovery provenance;
- disposable test/probe state.

## 8. Stage-2 merge + runtime proof

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

The retained-branch evidence follow-up then merged through PR **#359** as `23188ca5a4268e121841b167932b984d95102386`. Exact-head CI #2270 + Product Eval #1509 passed; merged-main CI #2271 + Product Eval #1510 passed; Staging Deploy #1313 was gate-only and actual Staging Deploy #1314 passed on exact merge SHA with preserved auth/MCP boundaries, healthy Operations, clean exact-host identity, no non-running configured services, and **26.44 GiB** stabilized free space.

## 9. Execution limitation in this session

The repo-side audit and safe cleanup tooling are complete. Actual remote deletion requires an authenticated git client capable of `git push origin --delete`.

The authorized desktop connector was offline during this audit, and the available GitHub connector does not expose a remote-branch deletion mutation. Therefore no branch deletion is claimed in this record.

When an authenticated local git client is available, run the cleanup script in dry-run mode first, inspect the result, then use `-Apply`.

## 10. Safe resume

1. Do not recompute the **373** allowlisted branches by branch-name pattern alone.
2. Use the committed JSON allowlist and exact-SHA revalidation.
3. Run dry-run first.
4. Apply deletion only to branches still matching their audited SHA.
5. Recount branches after cleanup.
6. Keep the **20 retained branches** unless a later supersession/provenance audit proves where their unique commits are preserved or that they are intentionally disposable.
7. Preserve PR #337's Brain implementation reference and PR #91's unlanded Temporal timeout change unless a later explicit decision supersedes them.
8. Do not touch `main`, Issue #277/DR-2 scope, staging credentials, production cutover, or runtime code as part of branch cleanup.
