# GitHub branch-hygiene audit — 2026-09-27

Date: **2026-09-27**

Status: **AUDIT COMPLETE / DELETION NOT YET EXECUTED**

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

Classification at the audited baseline:

- **332 branches — SAFE-DELETE CANDIDATES**
  - merged PR exists;
  - current branch head exactly matches merged PR head;
  - no post-merge branch movement detected.
- **61 branches — HOLD / REVIEW**
  - **43** have no matching PR record;
  - **14** have a closed PR but no merged PR;
  - **4** have a merged PR but the branch head advanced after the merged PR head.
- `main` is excluded by definition.
- this audit branch is also excluded from its own allowlist.

Machine-readable evidence:

`docs/verification/branch-hygiene-allowlist-2026-09-27.json`

That JSON records for every safe-delete candidate:

- branch name;
- expected exact remote SHA;
- merged PR number;
- merged timestamp;
- merge commit SHA.

It also records every held branch and why it was not admitted to the safe-delete set.

## 4. Why the remaining 61 are held

The hold set contains several kinds of potentially meaningful provenance:

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

This audit **does not authorize deletion of the 61 held branches**.

A second-stage audit is required for them. That review should determine whether each held branch is:

- an ancestor/checkpoint already represented by current `main`;
- superseded by another merged PR;
- uniquely carrying commits or tree state;
- useful recovery provenance;
- disposable test/probe state.

## 7. Execution limitation in this session

The repo-side audit and safe cleanup tooling are complete. Actual remote deletion requires an authenticated git client capable of `git push origin --delete`.

The authorized desktop connector was offline during this audit, and the available GitHub connector does not expose a remote-branch deletion mutation. Therefore no branch deletion is claimed in this record.

When an authenticated local git client is available, run the cleanup script in dry-run mode first, inspect the result, then use `-Apply`.

## 8. Safe resume

1. Do not recompute the 332 allowlisted branches by branch-name pattern alone.
2. Use the committed JSON allowlist and exact-SHA revalidation.
3. Run dry-run first.
4. Apply deletion only to branches still matching their audited SHA.
5. Recount branches after cleanup.
6. Audit the remaining hold set separately.
7. Do not touch `main`, Issue #277/DR-2 scope, staging credentials, production cutover, or runtime code as part of branch cleanup.
