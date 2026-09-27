# GitHub branch-hygiene execution — 2026-09-27

Date: **2026-09-27**

Status: **STAGE-2 CLEANUP EXECUTION — PASS**

Repository:

```text
ceritaantarkita-req/ecorione
```

This record captures the actual destructive remote-branch cleanup that followed the Stage-2 branch-hygiene audit. It is separate from the classification audit so historical deletion evidence is not confused with later Stage-3/Stage-4 reclassification.

## Execution branch

One-time execution branch:

```text
ops/branch-hygiene-exec-20260927
```

Final execution-branch head:

```text
3b0e74753c997879f5e2d3af56c211664df0f74b
```

The branch added a one-time GitHub Actions workflow and fixed one PowerShell root-resolution bug in `scripts/cleanup-merged-branches.ps1`. Stage 4 replays the script fix into canonical main; the one-time workflow itself is intentionally non-canonical.

## Run #1 — failed before deletion

Workflow: **Branch Hygiene One-Time #1**

Result: **FAIL / NO DELETION**

The first run failed while resolving the repository root because PowerShell treated the single returned line as `System.Char` under the original indexing expression.

Observed failure:

```text
Method invocation failed because [System.Char] does not contain a method
```

No apply phase ran and no deletion is claimed from this attempt.

## Run #2 — dry-run proof

Workflow: **Branch Hygiene One-Time #2**

Result: **PASS**

The workflow first required exact current main:

```text
97a34c3582917745dc4ecfb7f175b77cc3598148
```

The cleanup helper then loaded the Stage-2 allowlist audited against:

```text
d0b9c9141cba27fe640f325efff122486d1a1b56
```

Dry-run summary:

```text
allowlisted=354
would-delete=354
already-missing=0
hold=0
failed=0
skip=0
```

This proves all 354 candidates still existed at their exact allowlisted remote SHA immediately before destructive execution.

## Run #3 — apply

Workflow: **Branch Hygiene One-Time #3**

Result: **PASS**

Mode:

```text
APPLY
```

Final summary:

```text
allowlisted=354
deleted=354
already-missing=0
hold=0
failed=0
skip=0
```

Therefore the Stage-2 cleanup deleted **354 remote branches** with no SHA drift, no skipped protected/current branch, and no failed deletion.

## Post-execution inventory

A later direct GitHub REST recount during Stage 4 observed **47 remote branches** including `main` and the active Stage-4 audit branch.

The shape exactly matches the executed Stage-2 boundary:

- the 354 Stage-2 allowlisted branches are gone;
- the original 39 held branches remain;
- later branch-hygiene audit branches remain;
- the one-time execution branch remains;
- `main` remains.

Stage 3 had already reclassified 19 of the original 39 held branches as safe, but that classification merged after the Stage-2 deletion run. Those 19 were therefore not part of the 354-branch apply and correctly remain present until a later cleanup pass.

## Stage-4 reconciliation

Stage 4 uses the real post-execution inventory rather than assuming the original 394/395-branch baseline still exists.

It:

- preserves the 354-deletion execution as historical fact;
- keeps the cumulative exact-SHA allowlist so already-missing branches are harmlessly reported as such;
- adds Stage-3 and Stage-4 eligible branches only with explicit evidence;
- salvages the PowerShell root-resolution fix into canonical source;
- excludes the active Stage-4 branch from its own allowlist.

No production cutover, DR-2 target selection, provider spend, native Drive work, runtime feature change, or credential mutation is part of branch cleanup.
