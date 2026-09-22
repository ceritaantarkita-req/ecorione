# Off-host DR checkpoint 4 — runtime readiness guardrails — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–3 are CLOSED / PASS at their repository boundaries. The active Off-host Backup & DR workstream is now runtime execution.

Checkpoint 4 adds a fail-closed pre-mutation readiness layer between governed staging activation and the first real DR mutation.

This checkpoint is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Why this checkpoint exists

Before checkpoint 4, the runbook could move from a successful governed staging deployment directly into semantic-canary creation, cold backup, encrypted bundling, and off-host transfer.

The individual mutation scripts were guarded, but some external/runtime prerequisites could still be discovered only after entering that mutation path.

Checkpoint 4 changes the preferred sequence to:

```text
governed staging deployment
 -> freeze staging CD again
 -> source-host readiness
 -> independent-target readiness
 -> ONLY THEN semantic canary + cold backup + encrypted export
```

The export orchestrator also re-runs both readiness gates immediately before its first persistent mutation.

## Source-host readiness

`scripts/staging-offhost-dr-source-readiness.sh --check` requires:

- root execution;
- safe root-owned staging release receipt;
- valid `current_sha` / `current_tag` pair;
- exact local Git HEAD == release receipt;
- clean tracked worktree;
- all required DR entrypoints present as regular non-symlink files;
- explicit `ECORIONE_DR_PUBLIC_KEY`;
- public-key file mode 0600 or 0644;
- no private-key PEM marker in the configured DR key;
- RSA public key with modulus >= 3072 bits;
- required local commands;
- pinned PCS-09 helper image present;
- configured SumoPod edge network present;
- strict PCS-09 staging inventory PASS for the exact release SHA;
- valid rendered Compose configuration;
- every configured service running;
- at least one project-owned persistent volume;
- read-only measurement of current volume sizes;
- enough local free disk for the PCS-09 cold-backup + isolated-restore formula;
- current Ai container image tag == release receipt.

The gate emits:

```text
source_sha=
source_tag=
compose_project=
volume_count=
volume_total_kib=
backup_required_kib=
target_min_free_kib=
backup_available_kib=
dr_public_key_ready=1
```

`target_min_free_kib` is derived from the current source-volume footprint instead of using an arbitrary fixed target-capacity default.

The source readiness gate does **not**:

- accept private DR key material;
- create the semantic canary;
- stop Compose;
- create a backup;
- create a bundle;
- create Docker volumes;
- upload to the off-host target.

It may use short-lived read-only helper containers to measure project volumes, matching the existing PCS-09 helper-image boundary.

## Independent-target readiness

`scripts/staging-offhost-dr-target-readiness.sh --check` requires:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- strict SSH target syntax;
- safe absolute remote directory path;
- dedicated SSH identity mode 0600;
- non-empty trusted `known_hosts` mode 0600 or 0644;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- explicit `ECORIONE_DR_TARGET_MIN_FREE_KIB`;
- existing remote backup directory;
- remote directory is not a symlink;
- remote directory is writable by the backup account;
- remote directory mode 0700 or 0750;
- available remote storage >= the source-derived capacity floor.

The target readiness gate performs only SSH read/probe operations such as `test`, `stat`, and `df`.

It performs no:

- `scp` upload;
- remote `mkdir`;
- rename;
- deletion;
- DR artifact creation.

## Export-integrated readiness

`scripts/staging-offhost-dr-export.sh` now re-runs both readiness gates before:

- receipt/export-directory creation;
- semantic-canary creation;
- Compose cold-stop;
- backup creation;
- encrypted bundle creation;
- remote transfer.

The export path passes its positional DR public-key path into source readiness. The effective remote capacity floor is:

```text
max(source-derived target_min_free_kib, operator-supplied ECORIONE_DR_TARGET_MIN_FREE_KIB)
```

A missing/invalid source key, stale release identity, insufficient local capacity, missing target trust configuration, unavailable independent target, unsafe remote directory, or insufficient remote capacity therefore fails before the actual DR mutation sequence begins.

## Static audit repairs during checkpoint 4

Checkpoint-4 review found two pre-existing runtime-path defects before any real DR execution.

### Semantic canary was recorded but not transferred

The export manifest already recorded:

```text
canary_filename=
canary_sha256=
```

but the export orchestrator invoked the transfer helper without passing the semantic-canary file.

That would allow source-side generation bookkeeping to reference a canary that was never retained on the independent target, causing later recovery fetch to fail.

Checkpoint 4 repairs this so export transfers:

```text
bundle
metadata
semantic canary
export manifest
```

The transfer helper publishes the export manifest last. Recovery therefore treats final manifest presence as the generation commit marker only after the referenced bundle, metadata, and canary are final.

### Remote temporary transfer suffix was not collision-safe

The transfer helper used:

```text
.part-$
```

rather than the intended PID-scoped:

```text
.part-$$
```

Checkpoint 4 repairs the temporary name to literal `$$`.

The source-contract suite now locks:

- readiness-before-canary ordering;
- readiness-before-cold-backup ordering;
- canary argument presence in the export transfer call;
- canary publication before manifest publication;
- manifest-last generation semantics;
- literal PID-scoped `.part-$$` transfer temp names.

## Operator sequence

After the exact reviewed runtime has been deployed through PCS-08 and staging CD is frozen again:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem

sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

Record:

```text
target_min_free_kib=<N>
```

Configure the independent target and require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'

sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

Only after both PASS may the real export orchestrator run. The orchestrator re-runs both checks automatically.

## Repository gate history

PR #254 candidate reached Product Eval #1078 PASS.

CI #1839 passed naming but stopped at the read-only Prettier format gate on exactly:

```text
test/offhost-dr-source-contract.test.ts
```

No gate was weakened. The repository's locked Prettier toolchain formatted that test, and the temporary formatter workflow self-removed successfully. The formatter result head was:

```text
11a6136e7e18450555cfc4c5c104272277f60bae
```

A later normal user commit records this evidence so the final exact-head gates can rerun on a non-bot head.

## Repository evidence boundary

Checkpoint 4 still does **not** prove:

- final checkpoint-4 exact-head CI/Product Eval/MCP/Desktop gates;
- merged-main checkpoint-4 gates;
- a newer governed SumoPod deployment;
- source readiness PASS on SumoPod;
- a configured independent off-host target;
- target readiness PASS against a real independent failure domain;
- a real current-revision off-host generation;
- total-host-loss recovery.

## Safe resumable handoff

Repository-side:

1. require final exact-head CI + Product Eval + relevant acceptance gates;
2. merge only that reviewed head;
3. require merged-main gates;
4. converge canonical docs with exact merge identities.

Runtime-side after repository closure:

1. enable staging CD only for the controlled exact-current-main deployment;
2. manually dispatch **Staging Deploy**;
3. require deploy/public/Ops/host/release-receipt PASS;
4. immediately freeze staging CD again;
5. place only the RSA-3072+ DR public key on the source host;
6. run source readiness;
7. configure the independent SSH target;
8. run target readiness using the source-derived capacity floor;
9. only then run the real off-host export;
10. continue with independent retrieval, replacement-host restore, semantic acceptance, and changed-boot-id reboot proof.

No workflow bypass or real-host DR mutation is performed by this checkpoint.
