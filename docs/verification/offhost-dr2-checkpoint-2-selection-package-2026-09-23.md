# DR-2 checkpoint 2 — external target selection package — 2026-09-23

Status: **PREPARED / OPERATOR TARGET CHOICE REQUIRED / NO EXTERNAL MUTATION YET**

Issue: #277

## Purpose

Prepare the exact decision and acceptance boundary for DR-2 checkpoint 2 without selecting, contacting, provisioning, paying for, or mutating any external target.

The original Off-host DR workstream remains CLOSED / PASS at the documented SumoPod staging-host-loss boundary. This checkpoint belongs only to the additive DR-2 physical-independence workstream.

## Current gate

DR-2 checkpoint 2 can close only after the operator explicitly selects a genuinely external backup target and strict SSH custody/trust is established for that target.

Until that operator choice exists:

- no external host may be treated as selected;
- no paid infrastructure may be provisioned;
- no fresh DR generation may be exported;
- no checkpoint 3 host-evidence capture may be presented as final DR-2 proof;
- no DR-2 physical-independence claim may be made.

## Preferred transport

Use the already-proven strict SSH path first.

That path already supports:

- dedicated SSH identity;
- pinned server host-key trust;
- encrypted DR artifact transfer;
- remote checksum verification;
- manifest-last generation commit semantics;
- independent retrieval;
- retained-generation audit.

Object storage is not required for DR-2 closure and would add a second transport implementation surface. It remains a separate future decision.

## Eligible target classes

An eligible checkpoint-2 target may be one of these:

1. **Existing operator-owned external Linux VPS**
   - physically outside the replacement-compute host/storage domain;
   - enough free disk for configured retention plus working headroom;
   - dedicated non-root backup user possible;
   - SSH key-only access possible;
   - no need to expose application services publicly.

2. **New external Linux VPS**
   - same requirements as above;
   - provisioning/payment requires explicit operator approval before creation.

3. **Existing remote Linux machine under operator control**
   - acceptable only if its physical/storage failure domain is independently known to be distinct from replacement compute;
   - must satisfy the same SSH, ownership, permissions, retention, and free-space requirements.

## Explicitly ineligible for checkpoint 2

Do not select:

- another WSL distro on the same Windows host as replacement compute;
- another directory/disk path on the same physical host as replacement compute when the failure domain is not independently separate;
- the SumoPod source host itself;
- a target whose physical/storage relationship to replacement compute is unknown;
- a target that requires password/root login as the normal transfer path;
- a target where the DR private key would be copied into the backup target;
- an object-storage target without a separately reviewed transport decision.

## Selection record required from the operator

The operator decision must establish, without secrets:

- target class: existing external VPS / new external VPS / remote Linux machine;
- sanitized target label;
- sanitized failure-domain label;
- whether the target is already provisioned;
- whether using it introduces new paid infrastructure;
- intended replacement-compute class for the drill;
- operator attestation that backup target and replacement compute are physically/storage independent;
- permission to establish dedicated SSH custody/trust.

Raw IPs, private keys, passwords, provider API tokens, machine IDs, and system UUIDs do not belong in Git.

## Strict SSH custody/trust acceptance

After target selection, checkpoint 2 must prove all of the following before closing:

- dedicated backup user exists on the target;
- target backup root exists with restrictive ownership/permissions;
- recovery/source transfer credentials use dedicated key material;
- private transfer/recovery key material is not stored on the backup target;
- target public host key is pinned by the authorized sender/recovery environment;
- password authentication is not required for the DR transfer path;
- strict SSH succeeds non-interactively with the intended dedicated identity;
- target free-space/readiness gate passes;
- no existing unrelated target workloads are modified beyond the explicitly approved backup user/path boundary;
- evidence contains no secrets or raw machine identifiers.

## Minimal target layout

The preferred initial target layout is intentionally narrow:

```text
dedicated backup user
└── /srv/backups/ecorione/
    └── retained encrypted DR generations only
```

The backup target does not need:

- ECORIONE application source;
- deployment env;
- Connect Vault master key;
- operator credentials;
- Docker;
- Node.js;
- application databases in decrypted form.

## Checkpoint 2 close criteria

Checkpoint 2 may be labeled **CLOSED / PASS** only when:

1. operator target choice is explicit;
2. the target is genuinely external to replacement compute's physical/storage failure domain;
3. new paid infrastructure, if any, was explicitly approved before provisioning;
4. strict SSH custody/trust is established;
5. remote backup root and permissions are correct;
6. target readiness/free-space checks pass;
7. no fresh generation has yet been incorrectly promoted as DR-2 runtime proof unless checkpoint 4 has actually begun;
8. current docs and Issue #277 record the selected target class and claim boundary without secrets.

## Safe stop / checkpoint boundary

If work stops after this selection package but before operator choice, the safe project state is:

- repository `main` remains authoritative;
- original Off-host DR remains CLOSED / PASS;
- DR-2 checkpoint 1 remains CLOSED / PASS;
- DR-2 checkpoint 2 remains ACTIVE / OPERATOR GATE;
- no external target is selected;
- no external system is mutated;
- no paid infrastructure is created;
- no new recovery claim is made.

This is a valid safe checkpoint.

## Next action after operator choice

Once the operator selects the target, perform only checkpoint 2 custody/trust establishment and readiness verification. Do **not** proceed automatically into checkpoint 3 host-evidence/preflight or later runtime recovery in the same uncontrolled step.

Checkpoint 3 begins only after checkpoint 2 is explicitly closed and recorded.
