# Off-host DR checkpoint 5 — retained-generation audit and RPO/RTO evidence — 2026-09-22

Status: **CLOSED / PASS AT REPOSITORY BOUNDARY / REAL-HOST DR STILL PENDING**

## Scope

Checkpoints 1–4 are CLOSED / PASS at repository boundaries.

Checkpoint 5 closes two remaining repository-side gaps before the real off-host DR drill:

1. retained-generation integrity/retention was documented as policy but not mechanically audited;
2. final DR closure required measured RPO/RTO evidence but there was no deterministic receipt generator.

This remains part of the explicitly opened **Off-host Backup & DR** workstream. It is not PCS-11, PE-09, Batch 13, production promotion, public-edge activation, or a feature batch.

## Retained-generation audit

Checkpoint 5 adds:

```text
scripts/staging-offhost-dr-target-audit.sh
```

Modes:

```bash
sudo -E bash scripts/staging-offhost-dr-target-audit.sh --report
sudo -E bash scripts/staging-offhost-dr-target-audit.sh --check
```

The audit uses the same strict SSH custody boundary as transfer/readiness:

- explicit `ECORIONE_DR_FAILURE_DOMAIN_ACK=1`;
- dedicated mode-0600 SSH identity;
- non-empty pinned `known_hosts`;
- `BatchMode=yes`;
- `IdentitiesOnly=yes`;
- `StrictHostKeyChecking=yes`;
- `ClearAllForwardings=yes`;
- safe absolute remote target directory.

For every remote `ecorione-dr-*.receipt.env` generation commit marker, it requires:

- manifest is a regular non-symlink file;
- manifest mode 0600;
- schema version 1;
- failure-domain acknowledgement;
- `transfer_intent=1`;
- valid source SHA/tag pair;
- valid bundle/metadata/canary filenames;
- exact shared artifact stem;
- SHA-256 values present and syntactically valid;
- bundle/metadata/canary each exist as regular non-symlink files;
- every retained artifact mode 0600;
- remote SHA-256 for every artifact matches the retained manifest.

The audit reports:

```text
complete_generations=
incomplete_generations=
retention_min_generations=
retention_ready=
latest_created_at=
latest_manifest=
latest_source_sha=
latest_source_tag=
```

`--report` is observational and may report `retention_ready=0`.

`--check` additionally fails if:

- any retained generation is incomplete/corrupt; or
- complete generation count is below `ECORIONE_DR_RETENTION_MIN_GENERATIONS`.

The default minimum remains **3 generations**, matching the existing initial retention policy.

The audit performs no upload, remote mkdir, rename, or deletion.

## Sanitized closure timing evidence

Checkpoint 5 adds:

```text
scripts/staging-offhost-dr-closure-evidence.mjs
```

Inputs:

- retrieved export manifest;
- retrieved semantic canary state;
- independent retrieval receipt;
- clean-host restore receipt;
- final application/reboot acceptance receipt;
- explicit operator-supplied `loss_declared_at`;
- a new output path.

The tool validates cross-receipt identity before computing timing:

- source SHA/tag are consistent;
- manifest/retrieval filenames align;
- bundle/metadata/canary filenames and hashes align;
- local canary SHA-256 matches manifest/restore/acceptance;
- restore proves independent retrieval;
- final acceptance proves:
  - pre-reboot acceptance;
  - semantic canary acceptance;
  - reboot persistence;
  - semantic canary after reboot;
  - changed Linux boot ID;
  - total-host-loss recovery candidate state.

It refuses impossible chronology:

```text
backup canary boundary
 <= successful export manifest
 <= loss_declared_at
 <= independent retrieval completion
 <= real-volume restore start
 <= data ready
 <= application accepted
 <= final post-reboot accepted
```

The generated mode-0600 JSON contains only sanitized identities, timestamps, durations and counts.

## RPO definition

Checkpoint 5 does **not** infer or invent failure time.

The operator must provide the timestamp at which the drill declares the original source unavailable:

```text
loss_declared_at
```

The conservative RPO boundary is measured from the semantic-canary creation timestamp to `loss_declared_at`.

The canary is created before the coordinated cold backup, so this intentionally uses an earlier conservative boundary rather than pretending the later export-manifest timestamp is the exact data-capture instant.

The evidence also records `exportAgeAtLossSeconds` separately.

## RTO milestones

Measured from `loss_declared_at`:

- `retrievalReadyRtoSeconds`;
- `dataReadyRtoSeconds`;
- `applicationReadyRtoSeconds`;
- `finalRecoveryRtoSeconds`.

`finalRecoveryRtoSeconds` ends only after changed-boot-ID post-reboot acceptance.

These values are evidence for one drill. They are not a production SLA.

## Behavioral coverage

Checkpoint 5 includes a real-process deterministic test for the closure evidence generator.

Synthetic mode-0600 receipts prove:

- conservative RPO calculation;
- retrieval/data/application/final RTO calculations;
- source identity propagation;
- changed-boot-ID requirement;
- final total-host-loss recovery candidate requirement.

A negative case proves the generator rejects a declared loss timestamp that predates the successful export generation.

Source-contract coverage also locks:

- target-audit strict SSH boundary;
- mode/hash checking;
- no remote mutation commands;
- retention-count outputs;
- RPO/RTO field presence;
- no secret/password/private-key fields in sanitized timing evidence.

## Repository gate history

PR #256 initial exact head `cd4de5b80b4e3c6fac7fab3c0503c4757cfd32c8` reached CI #1847. Naming passed, while the read-only Prettier gate failed on exactly:

- `scripts/staging-offhost-dr-closure-evidence.mjs`;
- `test/offhost-dr-closure-evidence.test.ts`.

No gate was weakened. The repository's locked Prettier toolchain formatted only those two files. The temporary formatter workflow completed successfully and self-removed; the formatter result head is `ddc5323b4a65d0a1192d5f9efa41e461eeef90ca`.

A new exact-head CI/Product Eval/MCP/Desktop run is required after this evidence commit.

## Repository closure

Checkpoint 5 implementation closed through PR #256.

```text
PR exact head       7c1c8948022fc81e0c640fff7a8bcb7e4e689db3
CI                  #1850 PASS
Product Eval        #1089 PASS
MCP HTTPS           #996 PASS
Desktop Installer   #184 PASS
merge main          941cb8c9ed237a5417550449c7d73e712b10ba72
merged-main CI      #1851 PASS
merged-main Product #1090 PASS
merged-main MCP     #997 PASS
Staging Deploy      #468 gate PASS / deploy SKIPPED
Staging Deploy      #469 gate PASS / deploy SKIPPED
```

Both post-merge Staging Deploy triggers kept the deploy job skipped. Checkpoint-5 repository closure therefore caused no SumoPod runtime mutation.

Checkpoint 5 is CLOSED / PASS at the repository evidence-tooling boundary. Real retained-generation counts, target integrity, RPO/RTO measurements, and total-host-loss recovery remain runtime evidence.

## Current non-claims

Checkpoint 5 does **not** prove:

- final exact-head repository gates yet;
- a newer governed SumoPod deployment;
- a real independent target;
- three real retained generations;
- a real target audit;
- a real `loss_declared_at`;
- measured real-host RPO/RTO;
- total-host-loss recovery.

Those remain runtime evidence boundaries.

## Safe resumable handoff

Repository-side:

1. repository checkpoint 5 is CLOSED / PASS through PR #256 / merge `941cb8c9ed237a5417550449c7d73e712b10ba72`;
2. preserve this docs-only closure as bookkeeping only;
3. do not infer real target retention or RPO/RTO measurements from repository closure.

Runtime-side after repository closure:

1. perform the governed exact-current-main staging activation;
2. freeze staging CD immediately after PASS;
3. pass source readiness;
4. pass independent-target readiness;
5. run real off-host export;
6. run target audit/report;
7. perform independent fetch + replacement-host restore + acceptance + reboot proof;
8. generate sanitized closure timing evidence using the operator-declared source-loss timestamp;
9. accumulate/verify retained generations and require retention `--check` when the policy minimum is reached.

No workflow bypass or real-host mutation is performed by this checkpoint.
