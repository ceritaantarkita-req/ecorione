# DR-2 safe checkpoint — 2026-09-23

Status: **SAFE / DEFERRED / RESUMABLE**

Issue: #277

## Exact repository checkpoint

Current reviewed repository state:

```text
main=ec30f4cf9bbb1eef57d6d990be4ec1bab36b108e
```

This main includes:

- PR #283 — operator decision to defer DR-2 checkpoint 2 and keep local backup as the interim posture;
- PR #284 — final synchronization of living/current documentation so DR-2 is no longer described as an active runtime scope.

Merged-main gates on `ec30f4cf9bbb1eef57d6d990be4ec1bab36b108e`:

```text
CI #1927 PASS
Product Eval #1166 PASS
Staging Deploy #617 PASS (deploy skipped)
Staging Deploy #618 PASS (deploy skipped)
```

No application deployment is implied by these documentation-only merges.

## Current project boundary

The current DR state is:

```text
Original Off-host DR: CLOSED / PASS
DR-2 checkpoint 1: CLOSED / PASS
DR-2 checkpoint 2: DEFERRED / SAFE-PAUSED
DR-2 checkpoint 3+: NOT STARTED
```

The original Off-host DR result remains valid at its documented boundary: total loss of the tested SumoPod staging host was recovered on exact application runtime `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`.

DR-2 physical independence remains intentionally unproven.

## Interim backup posture

The operator-approved interim posture is:

- local backup is sufficient for the current operating phase;
- an encrypted Google Drive copy may be added later as a secondary off-device copy;
- Google Drive is not currently integrated or validated as a DR-2 recovery target;
- no external VPS/object-store target is selected;
- no paid infrastructure is authorized;
- no fresh DR-2 generation has been exported;
- no checkpoint-3 physical-independence preflight has started.

If Google Drive is used later, only encrypted DR artifacts and non-secret manifests/checksums should be copied there. Private decryption keys, SSH private keys, deployment secrets, operator credentials, Vault master keys, and unencrypted volume/database content remain outside Drive.

## Runtime/deployment state

Repository state and staging runtime remain separate evidence boundaries.

At this checkpoint:

- GitHub `main` = `ec30f4cf9bbb1eef57d6d990be4ec1bab36b108e`;
- latest proven original-DR staging application runtime remains `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`;
- later DR-2/docs merges have not redeployed the application;
- Staging Deploy gate workflows for the docs-only merges passed with deploy skipped.

## Safe-stop guarantees

Stopping work here is safe because:

1. no external target has been selected or mutated;
2. no paid infrastructure has been created;
3. no existing original-DR runtime/evidence is modified;
4. no secret values are committed;
5. checkpoint 3 and later destructive/runtime steps have not begun;
6. living documentation consistently describes DR-2 as deferred;
7. the exact Git checkpoint and CI/evaluation status are recorded.

## Resume procedure

When the operator chooses to resume DR-2:

1. start from current `main` and re-read:
   - `docs/current-state-and-next-steps.md`;
   - `docs/active-work-plan.md`;
   - `docs/offhost-dr-physical-independence.md`;
   - `docs/verification/offhost-dr2-checkpoint-2-selection-package-2026-09-23.md`;
2. explicitly choose the external target class;
3. if the target creates cost, obtain explicit approval before provisioning;
4. close checkpoint 2 custody/trust/readiness only;
5. update Issue #277 and current docs;
6. begin checkpoint 3 only after checkpoint 2 is explicitly CLOSED / PASS.

Do not reuse Issue #266's loss marker as a DR-2 marker, and do not relabel the old WSL-on-one-Windows drill as physical-independence proof.

## Final safe checkpoint statement

**ECORIONE is safe to leave at this state.**

There is no active DR-2 runtime mutation in flight. The project can continue normal non-DR work without completing DR-2 now, as long as the deferred physical-independence limitation remains documented.
