# Off-host DR checkpoint 2 — execution and clean-host recovery path — 2026-09-22

Status: **IMPLEMENTED AT REPOSITORY EXECUTION BOUNDARY / REAL-HOST DR STILL PENDING**

## Scope

Checkpoint 1 closed the portable encrypted backup foundation through PR #250 / merge `3c5417dd44099f6c74f0bc832f4631e3fa295c8d`.

Checkpoint 2 extends that foundation into one bounded, fail-closed operational path:

```text
fresh current-revision cold backup
 -> encrypted portable bundle
 -> off-host export manifest
 -> checksum-verified independent SSH transfer
 -> independent re-fetch from the off-host target
 -> retrieval receipt
 -> isolated Docker restore verification
 -> guarded exact Compose-volume restore on a clean replacement host
 -> separately restored secrets/config
 -> exact-source application start
 -> public/Ops/exact-host acceptance
 -> changed-boot-id replacement-host persistence proof
```

This workstream is still not PE-09, PCS-11, Batch 13, production promotion, or a feature batch.

## New repository controls

Checkpoint 2 adds:

- `scripts/staging-offhost-dr-canary-inner.mjs` + `scripts/staging-offhost-dr-canary.mjs`
  - create one LOCAL_ONLY Historical Ledger event, one Context episode, and one Artifact through owner APIs before backup;
  - read all three immediately and record stable identities/hashes in a mode-0600 canary state;
  - never read owner databases directly;
  - post mode re-reads the same canonical identities and refuses any Ledger hash/payload/head, Context content/digest, or Artifact size/digest drift;
  - the host wrapper executes the owner-API canary from the running Hub container so internal service ports and the internal token remain inside the staging network boundary.

- `scripts/staging-offhost-dr-export.sh`
  - serializes DR export with `flock`;
  - requires the current root-owned staging release receipt;
  - requires clean exact staging Git identity;
  - runs the existing PCS-09 cold backup first;
  - refuses backup SHA/tag drift;
  - creates the encrypted DR bundle;
  - creates and verifies the semantic owner-data canary before the cold backup;
  - writes a non-secret export manifest containing bundle, metadata, and canary filenames/hashes;
  - transfers bundle, metadata, semantic-canary state, and export manifest to the acknowledged independent target;
  - writes a root-only source-side transfer receipt only after remote checksum verification passes.

- `scripts/staging-offhost-dr-transfer.sh`
  - now supports an optional export manifest that must share the bundle stem;
  - keeps strict `known_hosts`, dedicated SSH identity, disabled forwarding, temporary remote names, remote SHA-256 verification, final atomic rename, and final SHA-256 verification;
  - never transfers the DR private key.

- `scripts/staging-offhost-dr-fetch.sh`
  - runs on the recovery/replacement host;
  - retrieves the export manifest from the acknowledged independent SSH target first;
  - derives the exact bundle/metadata/canary filenames and expected hashes from that retained manifest;
  - retrieves all three retained artifacts from the remote failure domain;
  - verifies local SHA-256 values including the canary state;
  - writes a mode-0600 retrieval receipt with `retrieval_verified=1`.

- `scripts/staging-offhost-dr-restore.mjs`
  - requires `ECORIONE_DR_RESTORE_ACK=1`;
  - requires a valid independent retrieval receipt and its exact mode-0600 semantic-canary state before mutation;
  - runs the checkpoint-1 isolated `--verify-docker` path before any real-volume mutation;
  - refuses recovery when Compose project containers already exist;
  - refuses any target volume that already exists;
  - requires every manifest volume to belong to the recorded Compose project;
  - creates exact Compose volume names with Compose project/volume labels;
  - restores every archive and recomputes deterministic tree fingerprint + file count;
  - removes only volumes created by the current failed attempt if any restore step fails;
  - never uses Docker prune;
  - writes a root-only restore receipt after all restored volumes pass.

- `scripts/staging-offhost-dr-start.sh`
  - requires the restore receipt to prove independent retrieval;
  - requires exact recovered Git SHA and clean tracked worktree;
  - refuses any pre-existing Compose project container;
  - requires every restored volume to exist;
  - starts the exact recorded image tag through the reviewed Compose topology;
  - on failed startup removes attempted containers/network without deleting recovered volumes.

- `scripts/staging-offhost-dr-acceptance.mjs`
  - refuses any restore receipt without `retrievedFromIndependentTarget=true`;
  - requires exact Git HEAD == recovered source SHA and a clean tracked worktree;
  - requires all configured services running;
  - requires the Ai container image tag to match the recorded recovery tag;
  - requires all restored volumes to exist;
  - re-reads the retained semantic canary through Historical Ledger, Context, and Artifact owner APIs;
  - runs public smoke, authenticated Operations, and sanitized exact-host evidence;
  - writes the recovered release identity only after those gates pass;
  - writes a pre-reboot recovery acceptance receipt.

- `scripts/staging-offhost-dr-reboot-evidence.mjs`
  - captures a replacement-host recovery baseline;
  - requires a later Linux `boot_id` change;
  - requires exact source/image identity, configured/running services, project volume inventory, and Connect durable-file fingerprints to remain stable;
  - re-reads the same semantic canary after the changed-boot-id reboot;
  - re-runs public smoke, authenticated Operations, and exact-host evidence after reboot;
  - updates the acceptance receipt to a total-host-loss recovery **candidate** only after post-reboot PASS.

## Provenance boundary

Checkpoint 2 deliberately separates:

```text
transfer proof
!=
retrieval proof
!=
data restore proof
!=
application recovery proof
!=
reboot persistence proof
```

A bundle copied directly from the source host to a recovery host cannot satisfy the repository's real-volume restore path. The restore gate now requires the retrieval receipt produced by `staging-offhost-dr-fetch.sh`.

The semantic canary is also part of the retained generation. Restore/acceptance cannot substitute a new local canary: the canary filename/hash must match the retrieval receipt derived from the off-host export manifest. This adds semantic owner-data proof on top of archive/tree fingerprints.

This closes the repository-side provenance gap between "an encrypted backup was uploaded somewhere" and "the replacement host actually fetched the retained generation from the declared independent target."

## Safety boundary

Real-volume recovery is deliberately destructive only to a **clean replacement namespace**:

- existing Compose project containers => fail closed;
- any exact target volume already exists => fail closed;
- partial restore failure => remove only volumes created by that attempt;
- application start is a later explicit operator step;
- secrets/configuration are never packed into the ordinary DR bundle;
- the source-host DR private key remains absent by design.

## Runtime activation prerequisite

The current proven SumoPod application runtime is still `52046db35e403babdda934881773c46bf2c57b68` / `staging-52046db35e40`. Checkpoint-2 scripts are newer repository source and must not be injected manually into that older checkout.

Before the first real checkpoint-2 export, the exact reviewed checkpoint-2 merge must be deployed through the existing PCS-08 governed staging path and must pass its normal public/Ops/exact-host/release-receipt gates. Automatic staging deployment must then be frozen again before documentation closure proceeds.

This deployment is a prerequisite to DR runtime evidence, not production promotion.

## Current non-claims

No real-host checkpoint-2 mutation has been performed by this repository work.

Therefore the following remain unproven:

- a fresh backup from current staging revision `52046db35e403babdda934881773c46bf2c57b68` has been exported off SumoPod;
- the selected external target is operationally independent in real infrastructure;
- a real bundle has been re-fetched from that target after treating the source host as unavailable;
- all real staging volumes have been restored on a clean replacement host;
- secrets/config have been recovered on that replacement host;
- exact-source application recovery has passed;
- changed-boot-id recovery persistence has passed;
- project-level total-host-loss recovery is CLOSED / PASS.

## Safe resumable handoff

The next operator mutation must begin with the checkpoint-2 export orchestrator on the current proven staging host, not with manual copy commands:

```bash
sudo -E bash scripts/staging-offhost-dr-export.sh --apply \
  /secure/path/ecorione-dr-public.pem \
  /var/lib/ecorione-staging/dr-export
```

After the source host is treated as unavailable, the recovery host must use the retained export manifest with `staging-offhost-dr-fetch.sh`, then the retrieval receipt with `staging-offhost-dr-restore.mjs`.

## Repository gate history

PR #251 initial exact head `1d2104da9e331ea49e56d90f10533702464366f9` reached CI #1767. Naming passed, while the read-only Prettier format gate correctly failed on exactly three new/changed files:

- `scripts/staging-offhost-dr-reboot-evidence.mjs`;
- `scripts/staging-offhost-dr-restore.mjs`;
- `test/offhost-dr-source-contract.test.ts`.

No gate was weakened. Those files were rewritten by the repository's exact locked Prettier toolchain. The temporary formatter workflow then removed itself from the final tree; formatting commit head was `d49a4fe53e0dc1655f9605b3cb65b33080d1bc68`.

A subsequent static review before accepting the rerun found three repository-side defects and hardened them before runtime use:

- the export script had a literal `\\n` embedded between its final metadata/export-manifest echo statements; it was repaired into two actual shell lines;
- recovery acceptance derived the host-evidence overlay path by slicing an absolute path; it now passes the reviewed operator-supplied overlay path unchanged to the existing host-evidence validator;
- real-volume restore accepted a regular retrieval receipt without enforcing mode 0600 and parsed fields into a normal object; it now requires mode 0600 and uses a null-prototype map for receipt fields.

Source-contract coverage was extended for the receipt-permission/parser and overlay-path repairs. These fixes do not change the documented DR claim boundary.

After the semantic owner-data canary was added, PR #251 exact head `8f4f8d6f9a8beefb233f6abbdd7a16f9ada4fb09` passed Product Eval #1027, MCP External HTTPS Acceptance #944, and Desktop Installer #135. CI #1788 again failed only the read-only format gate, this time on the four newly added/modified semantic-recovery files:

- `scripts/staging-offhost-dr-acceptance.mjs`;
- `scripts/staging-offhost-dr-canary-inner.mjs`;
- `scripts/staging-offhost-dr-canary.mjs`;
- `scripts/staging-offhost-dr-reboot-evidence.mjs`.

The locked repository Prettier toolchain formatted exactly those files. The temporary formatter workflow self-removed successfully; the resulting formatting commit is `dcfae1e69f71cf5239d964faf9e37561fa9a82d8`. CI was not bypassed or weakened; a later exact-head rerun remains required before merge.

Repository implementation can close only after exact-head CI/Product Eval and relevant acceptance gates pass. Real-host DR remains a separate evidence boundary.
