# Off-host DR checkpoint 4 — runtime readiness guardrails — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–3 are CLOSED / PASS at their repository boundaries. The active Off-host Backup & DR workstream is now runtime execution.

Checkpoint 4 adds a fail-closed **read-only readiness layer** between governed staging activation and the first real DR mutation.

This checkpoint is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Why this checkpoint exists

Before checkpoint 4 the runbook could move from a successful governed staging deployment directly into semantic-canary creation + cold backup + encrypted export.

That was safe at the individual script level, but operationally it still allowed several external/runtime prerequisites to be discovered only after entering the mutation path.

Checkpoint 4 introduces two explicit no-mutation gates:

```text
governed staging deployment
 -> source-host readiness
 -> independent-target readiness
 -> ONLY THEN semantic canary + cold backup + encrypted export
```

## Source-host readiness

`scripts/staging-offhost-dr-source-readiness.sh --check` requires:

- root execution;
- safe root-owned staging release receipt;
- valid `current_sha` / `current_tag` pair;
- exact local Git HEAD == release receipt;
- clean tracked worktree;
- all DR entrypoints present as regular non-symlink files;
- explicit `ECORIONE_DR_PUBLIC_KEY` present as a regular non-symlink file;
- configured DR key contains no private-key PEM marker;
- DR key parses as RSA with modulus >= 3072 bits;
- required local commands;
- pinned PCS-09 helper image present;
- configured SumoPod edge network present;
- strict PCS-09 staging inventory PASS for the exact release SHA;
- rendered Compose config valid;
- every configured service running;
- at least one project-owned persistent volume;
- deterministic read-only measurement of current volume sizes;
- enough local free disk for the same PCS-09 cold-backup + isolated-restore formula;
- current Ai container image tag == release receipt.

The gate outputs:

```text
source_sha=
source_tag=
compose_project=
volume_count=
volume_total_kib=
backup_required_kib=
target_min_free_kib=
backup_available_kib=
```

`target_min_free_kib` is intentionally derived from the current source-volume footprint rather than using an arbitrary fixed target-capacity default.

The source readiness gate does **not**:

- accept private DR key material on the source host;
- create the semantic canary;
- stop Compose;
- create a backup;
- create a bundle;
- create Docker volumes;
- contact/upload to the off-host target.

## Independent-target readiness

`scripts/staging-offhost-dr-target-readiness.sh --check` requires:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- strict SSH target syntax;
- absolute safe remote directory path;
- dedicated SSH identity mode 0600;
- non-empty trusted `known_hosts` mode 0600/0644;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- existing remote backup directory;
- remote directory is not a symlink;
- remote directory is writable by the backup account;
- remote directory mode 0700 or 0750;
- explicit `ECORIONE_DR_TARGET_MIN_FREE_KIB`;
- available remote storage >= that source-derived capacity floor.

The target readiness gate performs only remote `test`, `stat`, and `df`-class reads. It performs no:

- `scp` upload;
- remote `mkdir`;
- rename;
- deletion;
- DR artifact creation.

## Capacity binding

The intended sequence is:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem
sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

Record the emitted:

```text
target_min_free_kib=<N>
```

Then configure the independent target and require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

Only after both gates PASS may the real export orchestrator run.

## Static audit repairs during checkpoint 4

Repository review found two pre-runtime defects in the existing export/transfer path:

1. the export manifest recorded a semantic-canary filename/hash, but the export orchestrator called the transfer helper without passing the canary file; a later independent fetch would therefore be unable to retrieve the retained canary even though the source-side manifest referenced it;
2. the transfer helper's remote temporary filename used a literal `part-# Off-host DR checkpoint 4 — runtime readiness guardrails — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–3 are CLOSED / PASS at their repository boundaries. The active Off-host Backup & DR workstream is now runtime execution.

Checkpoint 4 adds a fail-closed **read-only readiness layer** between governed staging activation and the first real DR mutation.

This checkpoint is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Why this checkpoint exists

Before checkpoint 4 the runbook could move from a successful governed staging deployment directly into semantic-canary creation + cold backup + encrypted export.

That was safe at the individual script level, but operationally it still allowed several external/runtime prerequisites to be discovered only after entering the mutation path.

Checkpoint 4 introduces two explicit no-mutation gates:

```text
governed staging deployment
 -> source-host readiness
 -> independent-target readiness
 -> ONLY THEN semantic canary + cold backup + encrypted export
```

## Source-host readiness

`scripts/staging-offhost-dr-source-readiness.sh --check` requires:

- root execution;
- safe root-owned staging release receipt;
- valid `current_sha` / `current_tag` pair;
- exact local Git HEAD == release receipt;
- clean tracked worktree;
- all DR entrypoints present as regular non-symlink files;
- explicit `ECORIONE_DR_PUBLIC_KEY` present as a regular non-symlink file;
- configured DR key contains no private-key PEM marker;
- DR key parses as RSA with modulus >= 3072 bits;
- required local commands;
- pinned PCS-09 helper image present;
- configured SumoPod edge network present;
- strict PCS-09 staging inventory PASS for the exact release SHA;
- rendered Compose config valid;
- every configured service running;
- at least one project-owned persistent volume;
- deterministic read-only measurement of current volume sizes;
- enough local free disk for the same PCS-09 cold-backup + isolated-restore formula;
- current Ai container image tag == release receipt.

The gate outputs:

```text
source_sha=
source_tag=
compose_project=
volume_count=
volume_total_kib=
backup_required_kib=
target_min_free_kib=
backup_available_kib=
```

`target_min_free_kib` is intentionally derived from the current source-volume footprint rather than using an arbitrary fixed target-capacity default.

The source readiness gate does **not**:

- accept private DR key material on the source host;
- create the semantic canary;
- stop Compose;
- create a backup;
- create a bundle;
- create Docker volumes;
- contact/upload to the off-host target.

## Independent-target readiness

`scripts/staging-offhost-dr-target-readiness.sh --check` requires:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- strict SSH target syntax;
- absolute safe remote directory path;
- dedicated SSH identity mode 0600;
- non-empty trusted `known_hosts` mode 0600/0644;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- existing remote backup directory;
- remote directory is not a symlink;
- remote directory is writable by the backup account;
- remote directory mode 0700 or 0750;
- explicit `ECORIONE_DR_TARGET_MIN_FREE_KIB`;
- available remote storage >= that source-derived capacity floor.

The target readiness gate performs only remote `test`, `stat`, and `df`-class reads. It performs no:

- `scp` upload;
- remote `mkdir`;
- rename;
- deletion;
- DR artifact creation.

## Capacity binding

The intended sequence is:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem
sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

Record the emitted:

```text
target_min_free_kib=<N>
```

Then configure the independent target and require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

Only after both gates PASS may the real export orchestrator run.

 suffix instead of PID-scoped `part-$`, weakening collision isolation for standalone/concurrent transfer invocation.

Checkpoint 4 repairs both before any real-host DR execution:

- export now transfers `bundle + metadata + canary + manifest`;
- the manifest remains transferred last as the generation commit marker;
- transfer temp names are PID-scoped with literal `$`;
- source-contract tests lock the canary argument, readiness-before-canary ordering, canary-before-manifest publication, and PID-scoped temp suffix.

Checkpoint 4 also integrates the two readiness gates into `staging-offhost-dr-export.sh` itself. The orchestrator now re-runs source readiness and independent-target readiness before local export directory creation, semantic-canary creation, cold backup, bundling, or transfer. Failure at either readiness gate exits before those mutations.

## Repository gate history

PR #254 initial reviewed candidate reached Product Eval #1078 PASS. CI #1839 passed naming but stopped at the read-only Prettier format gate on exactly `test/offhost-dr-source-contract.test.ts`. The gate was not bypassed or weakened. The repository's locked Prettier toolchain formatted that test, and the temporary formatter workflow self-removed successfully; formatter result head was `11a6136e7e18450555cfc4c5c104272277f60bae`.

The checkpoint-4 static audit also found and repaired two pre-existing runtime-path defects before any real DR execution:

- `staging-offhost-dr-export.sh` recorded the semantic canary in the export manifest but did not pass the canary file to `staging-offhost-dr-transfer.sh`; export now transfers bundle + metadata + canary + manifest, with the manifest published last as the generation commit marker;
- `staging-offhost-dr-transfer.sh` used a literal `.part-# Off-host DR checkpoint 4 — runtime readiness guardrails — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–3 are CLOSED / PASS at their repository boundaries. The active Off-host Backup & DR workstream is now runtime execution.

Checkpoint 4 adds a fail-closed **read-only readiness layer** between governed staging activation and the first real DR mutation.

This checkpoint is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Why this checkpoint exists

Before checkpoint 4 the runbook could move from a successful governed staging deployment directly into semantic-canary creation + cold backup + encrypted export.

That was safe at the individual script level, but operationally it still allowed several external/runtime prerequisites to be discovered only after entering the mutation path.

Checkpoint 4 introduces two explicit no-mutation gates:

```text
governed staging deployment
 -> source-host readiness
 -> independent-target readiness
 -> ONLY THEN semantic canary + cold backup + encrypted export
```

## Source-host readiness

`scripts/staging-offhost-dr-source-readiness.sh --check` requires:

- root execution;
- safe root-owned staging release receipt;
- valid `current_sha` / `current_tag` pair;
- exact local Git HEAD == release receipt;
- clean tracked worktree;
- all DR entrypoints present as regular non-symlink files;
- explicit `ECORIONE_DR_PUBLIC_KEY` present as a regular non-symlink file;
- configured DR key contains no private-key PEM marker;
- DR key parses as RSA with modulus >= 3072 bits;
- required local commands;
- pinned PCS-09 helper image present;
- configured SumoPod edge network present;
- strict PCS-09 staging inventory PASS for the exact release SHA;
- rendered Compose config valid;
- every configured service running;
- at least one project-owned persistent volume;
- deterministic read-only measurement of current volume sizes;
- enough local free disk for the same PCS-09 cold-backup + isolated-restore formula;
- current Ai container image tag == release receipt.

The gate outputs:

```text
source_sha=
source_tag=
compose_project=
volume_count=
volume_total_kib=
backup_required_kib=
target_min_free_kib=
backup_available_kib=
```

`target_min_free_kib` is intentionally derived from the current source-volume footprint rather than using an arbitrary fixed target-capacity default.

The source readiness gate does **not**:

- accept private DR key material on the source host;
- create the semantic canary;
- stop Compose;
- create a backup;
- create a bundle;
- create Docker volumes;
- contact/upload to the off-host target.

## Independent-target readiness

`scripts/staging-offhost-dr-target-readiness.sh --check` requires:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- strict SSH target syntax;
- absolute safe remote directory path;
- dedicated SSH identity mode 0600;
- non-empty trusted `known_hosts` mode 0600/0644;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- existing remote backup directory;
- remote directory is not a symlink;
- remote directory is writable by the backup account;
- remote directory mode 0700 or 0750;
- explicit `ECORIONE_DR_TARGET_MIN_FREE_KIB`;
- available remote storage >= that source-derived capacity floor.

The target readiness gate performs only remote `test`, `stat`, and `df`-class reads. It performs no:

- `scp` upload;
- remote `mkdir`;
- rename;
- deletion;
- DR artifact creation.

## Capacity binding

The intended sequence is:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem
sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

Record the emitted:

```text
target_min_free_kib=<N>
```

Then configure the independent target and require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

Only after both gates PASS may the real export orchestrator run.

## Static audit repairs during checkpoint 4

Repository review found two pre-runtime defects in the existing export/transfer path:

1. the export manifest recorded a semantic-canary filename/hash, but the export orchestrator called the transfer helper without passing the canary file; a later independent fetch would therefore be unable to retrieve the retained canary even though the source-side manifest referenced it;
2. the transfer helper's remote temporary filename used a literal `part-# Off-host DR checkpoint 4 — runtime readiness guardrails — 2026-09-22

Status: **IMPLEMENTED / REPOSITORY GATES PENDING / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–3 are CLOSED / PASS at their repository boundaries. The active Off-host Backup & DR workstream is now runtime execution.

Checkpoint 4 adds a fail-closed **read-only readiness layer** between governed staging activation and the first real DR mutation.

This checkpoint is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Why this checkpoint exists

Before checkpoint 4 the runbook could move from a successful governed staging deployment directly into semantic-canary creation + cold backup + encrypted export.

That was safe at the individual script level, but operationally it still allowed several external/runtime prerequisites to be discovered only after entering the mutation path.

Checkpoint 4 introduces two explicit no-mutation gates:

```text
governed staging deployment
 -> source-host readiness
 -> independent-target readiness
 -> ONLY THEN semantic canary + cold backup + encrypted export
```

## Source-host readiness

`scripts/staging-offhost-dr-source-readiness.sh --check` requires:

- root execution;
- safe root-owned staging release receipt;
- valid `current_sha` / `current_tag` pair;
- exact local Git HEAD == release receipt;
- clean tracked worktree;
- all DR entrypoints present as regular non-symlink files;
- explicit `ECORIONE_DR_PUBLIC_KEY` present as a regular non-symlink file;
- configured DR key contains no private-key PEM marker;
- DR key parses as RSA with modulus >= 3072 bits;
- required local commands;
- pinned PCS-09 helper image present;
- configured SumoPod edge network present;
- strict PCS-09 staging inventory PASS for the exact release SHA;
- rendered Compose config valid;
- every configured service running;
- at least one project-owned persistent volume;
- deterministic read-only measurement of current volume sizes;
- enough local free disk for the same PCS-09 cold-backup + isolated-restore formula;
- current Ai container image tag == release receipt.

The gate outputs:

```text
source_sha=
source_tag=
compose_project=
volume_count=
volume_total_kib=
backup_required_kib=
target_min_free_kib=
backup_available_kib=
```

`target_min_free_kib` is intentionally derived from the current source-volume footprint rather than using an arbitrary fixed target-capacity default.

The source readiness gate does **not**:

- accept private DR key material on the source host;
- create the semantic canary;
- stop Compose;
- create a backup;
- create a bundle;
- create Docker volumes;
- contact/upload to the off-host target.

## Independent-target readiness

`scripts/staging-offhost-dr-target-readiness.sh --check` requires:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- strict SSH target syntax;
- absolute safe remote directory path;
- dedicated SSH identity mode 0600;
- non-empty trusted `known_hosts` mode 0600/0644;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- existing remote backup directory;
- remote directory is not a symlink;
- remote directory is writable by the backup account;
- remote directory mode 0700 or 0750;
- explicit `ECORIONE_DR_TARGET_MIN_FREE_KIB`;
- available remote storage >= that source-derived capacity floor.

The target readiness gate performs only remote `test`, `stat`, and `df`-class reads. It performs no:

- `scp` upload;
- remote `mkdir`;
- rename;
- deletion;
- DR artifact creation.

## Capacity binding

The intended sequence is:

```bash
export ECORIONE_DR_PUBLIC_KEY=/secure/path/ecorione-dr-public.pem
sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
```

Record the emitted:

```text
target_min_free_kib=<N>
```

Then configure the independent target and require:

```bash
export ECORIONE_DR_TARGET_MIN_FREE_KIB='<N>'
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check
```

Only after both gates PASS may the real export orchestrator run.

 suffix instead of PID-scoped `part-$`, weakening collision isolation for standalone/concurrent transfer invocation.

Checkpoint 4 repairs both before any real-host DR execution:

- export now transfers `bundle + metadata + canary + manifest`;
- the manifest remains transferred last as the generation commit marker;
- transfer temp names are PID-scoped with literal `$`;
- source-contract tests lock the canary argument, readiness-before-canary ordering, canary-before-manifest publication, and PID-scoped temp suffix.

Checkpoint 4 also integrates the two readiness gates into `staging-offhost-dr-export.sh` itself. The orchestrator now re-runs source readiness and independent-target readiness before local export directory creation, semantic-canary creation, cold backup, bundling, or transfer. Failure at either readiness gate exits before those mutations.

 remote temp suffix; it now uses PID-scoped `.part-$`.

The final exact-head repository gates must rerun after this evidence commit.

## Repository evidence boundary

This checkpoint adds repository tooling only. It does not prove:

- checkpoint-4 exact-head CI/Product Eval yet;
- a newer governed SumoPod deployment;
- a configured independent target;
- source readiness PASS on SumoPod;
- target readiness PASS against a real independent failure domain;
- a real current-revision off-host generation;
- total-host-loss recovery.

## Safe resumable handoff

Repository-side:

1. require exact-head format/lint/typecheck/test/security/build gates;
2. require Product Eval;
3. merge only the reviewed head;
4. require merged-main gates;
5. converge canonical docs with exact identities.

Runtime-side after repository closure:

1. enable staging CD only for the controlled exact-current-main deployment;
2. manually dispatch Staging Deploy;
3. require deploy/public/Ops/host/release receipt PASS;
4. immediately freeze staging CD again;
5. run source readiness;
6. use its exact `target_min_free_kib` as the target readiness floor;
7. run independent-target readiness;
8. only then run the real off-host export.

No workflow bypass or real-host mutation is performed by this checkpoint.
