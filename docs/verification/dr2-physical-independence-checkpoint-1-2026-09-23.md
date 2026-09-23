# DR-2 physical independence checkpoint 1 closure — 2026-09-23

Status: **CLOSED / PASS — REPOSITORY FOUNDATION ONLY**

Issue: #277
Implementation PR: #278

## Scope

Checkpoint 1 adds provider-neutral repository tooling for a stronger future DR claim without changing the already-closed Issue #266 runtime evidence.

It does not provision or contact an external target, does not create a fresh retained generation, and does not claim physical independence by itself.

## Delivered

- `scripts/staging-dr2-host-evidence.mjs` captures sanitized Linux host evidence for `backup-target` or `replacement-host` roles;
- raw `/etc/machine-id` is never emitted; only SHA-256 is recorded;
- raw DMI/system UUID is never emitted; only SHA-256 is recorded when available;
- output receipts are mode 0600 and refuse overwrite;
- `scripts/staging-dr2-physical-independence-preflight.mjs` requires explicit `ECORIONE_DR_PHYSICAL_INDEPENDENCE_ACK=1`;
- preflight rejects reused failure-domain labels;
- preflight rejects matching machine-id fingerprints;
- preflight rejects matching system UUID fingerprints when both exist;
- if both hosts report WSL, both system UUID fingerprints are required;
- evidence freshness is bounded to 24 hours with limited future-clock skew;
- deterministic tests cover PASS and negative paths;
- package commands and operator documentation are wired;
- current-state and active-work docs preserve the original DR closure and open DR-2 as a separate scope.

## Reviewed implementation identity

```text
PR #278
exact head = 200f050bc74072ebe5f0945aec82b353201e70fe
merge main = 4d1f4ef82839c74cc1ca8454511405a68424f0b7
```

## Exact-head gates

```text
CI #1913                         PASS
Product Eval #1152              PASS
MCP External HTTPS #1011        PASS
Desktop Installer #197          PASS
```

## Merged-main gates

```text
CI #1914                         PASS
Product Eval #1153              PASS
MCP External HTTPS #1012        PASS
Staging Deploy #591 gate        PASS / deploy SKIPPED
Staging Deploy #592 gate        PASS / deploy SKIPPED
```

The staging deploy jobs intentionally skipped runtime deployment. Checkpoint 1 is repository foundation only and makes no newer staging-runtime claim.

## Security and evidence boundary

The host receipts contain stable hashes and must remain mode 0600 operational evidence. They must not be committed to Git.

The tooling does not collect IP addresses, secrets, raw machine identifiers, database contents, or user data.

Distinct hashes are supporting evidence, not a physical-host oracle. Final physical-independence evidence still requires explicit operator confirmation plus a real external target and full recovery drill.

## Relationship to Issue #266

Issue #266 remains CLOSED / PASS for total loss of the tested SumoPod staging host at its documented boundary.

DR-2 is additive. Checkpoint 1 neither rewrites nor invalidates that closure.

## Next gate

Checkpoint 2 is **external target selection and custody setup**.

No external target has been selected or paid for yet. Before runtime execution, the operator must choose a genuinely external physical/storage failure domain and establish strict SSH identity + pinned host trust there.

Only after that choice should real DR-2 host evidence be captured and the physical-independence preflight executed.
