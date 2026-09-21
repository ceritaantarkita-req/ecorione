# Post-closure maintenance checkpoint 5 — 2026-09-21

Status: **BOUNDED MAINTENANCE CLOSED THROUGH PR #244 / NO NEW ROADMAP OPENED**

## Safety boundary

This checkpoint records the next bounded maintenance defect after the PR #242 checkpoint.

Rules preserved during this slice:

- `main` remains repository source of truth;
- one proven defect scope per implementation PR;
- merge only after exact-head CI/Product Eval and every relevant acceptance gate pass;
- no production promotion;
- no Cloudflare/public-edge activation;
- no paid-provider/W18 rerun;
- no weakening of secret-history, release-security, dependency, toolchain, or acceptance gates;
- historical evidence remains historical and is not rewritten;
- repository merge does not itself prove a newer SumoPod staging deployment.

Implementation checkpoint immediately before this docs convergence:

```text
3114354ab44894ef80e75b9983fceac64babc2e0
```

## Closed maintenance PR

| PR | Exact implementation head | Merge commit | Verified boundary | Exact-head gates |
| --- | --- | --- | --- | --- |
| #244 | `462c9418078baefc7cd00eed79dd85dac4ee1bf9` | `3114354ab44894ef80e75b9983fceac64babc2e0` | Failed Sandbox receipt-lock metadata initialization cleans the just-created file descriptor and lock file before rethrowing, so a pre-effect failure cannot leave the idempotency key permanently busy. | CI #1747 PASS; Product Eval #986 PASS |

## Preserved correctness and security invariants

- Workspace and owner authority boundaries are unchanged.
- Hub remains capability/policy/approval authority.
- Sandbox still acquires the idempotency lease before authority/effect execution.
- Successful receipt-lock acquisition and release semantics are unchanged.
- Only the failure path after exclusive lock creation but before lease return is changed.
- If lock metadata initialization fails, cleanup is best-effort and the original acquisition error is rethrown.
- A cleanup failure does not silently permit concurrent execution; any surviving lock still causes later acquisition to fail closed as busy.
- The regression proves the normal failure path removes the stale lock and permits a later retry of the same idempotency key.
- Release-security acceptance pins the lock-cleanup invariant.
- No second scheduler, retry database, execution authority, provider fallback, or new product feature was introduced.
- No release-security, secret-history, dependency, toolchain, or acceptance gate was bypassed.

## Runtime/staging claim boundary

This checkpoint is repository evidence.

It does **not** prove that SumoPod staging is running `3114354ab44894ef80e75b9983fceac64babc2e0`. The latest proven staging application evidence remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

A later explicit deployment + runtime verification record is required before changing that claim.

Staging remains distinct from production. Same-host backup evidence remains distinct from off-host disaster-recovery evidence.

## Current boundary after checkpoint

- PE-00..PE-08 — CLOSED / PASS
- PCS-00..PCS-10 — CLOSED / PASS
- bounded maintenance through PR #244 — CLOSED at repository boundary
- active implementation queue — NONE
- production promotion — DEFERRED / separate explicit gate
- Cloudflare named Tunnel/public edge — optional / not implicitly authorized
- paid W18 rerun — closed / not authorized
- AutoClick and L4 autonomy — deferred by design
