# Dataset Governance + Backup / Restore / DR Operations

Batch 8 operational contract. Architectural rules are in ADR-29.

## 1. Dataset release lifecycle

Dataset releases are RnD-owned and are **not backups**.

Production RnD uses `ECORIONE_RND_DATASET_ROOT` (default `./data/rnd-datasets`). The owner API is:

- `POST /v1/datasets/releases` — create/idempotently resolve an immutable governed release;
- `GET /v1/datasets/releases?dataset=<name>` — list registered releases;
- `GET /v1/datasets/releases/<releaseId>` — verify and read one manifest.

A release request must provide:

- dataset name;
- schema name + explicit schema version;
- at least one source lineage entry (`owner`, `kind`, `identity`, SHA-256 digest);
- explicit source record IDs;
- optional `groupId` for leakage-safe grouping;
- optional train/eval/regression percentages that sum to exactly 100.

Before release, RnD deterministically redacts obvious secret-bearing field names and email/phone/Bearer-like string values, deduplicates governed payload bytes, rejects empty payloads, computes quality counts, and writes immutable `manifest.json` + `records.ndjson` under the content-derived release ID.

Important limitation: deterministic sanitation is a baseline guard, **not a universal PII classifier**. Highly sensitive exports still require source-specific review/classification before being submitted to RnD.

## 2. Backup inventory

Batch 8 local owner adapters cover these durable states:

| Owner | Durable state | Backup kind | Restore rule |
|---|---|---|---|
| Context | SQLite memory DB, including authoritative L0 and projections | `sqlite` | online backup; offline restore |
| Hub | SQLite policy/audit/approval/history/authority state | `sqlite` | online backup; offline restore |
| RnD | SQLite traces | `sqlite` | online backup; offline restore |
| RnD | governed dataset releases | `directory` via owner primitive when deployed | quiesce writers during directory restore |
| Sync | SQLite device/relay state; relay payload is ciphertext | `sqlite` | online backup; offline restore |
| Space | SQLite pages/blocks | `sqlite` | online backup; offline restore |
| Artifact | content-addressed blob directory | `directory` | quiesce writers during directory restore |
| Sandbox | durable execution receipt directory | `directory` | quiesce writers during directory restore |
| Connect | spend budget, outbound MCP registry/invocation state | `bundle` | restore while Connect is stopped |
| Connect | encrypted credential vault file | `vault-ciphertext` | restore ciphertext; supply master key separately |
| Flow | Temporal persistence | external dependency | use Temporal persistence backup/restore for deployment |

Do not add a coordinator that opens the files above directly. Call/import the adapter owned by the relevant service or execute the operation in that owner process/tool.

## 3. Backup invariants

Every owner backup:

1. uses an owner-specific backup root;
2. rejects traversal and symlinks;
3. writes files with restrictive permissions;
4. records per-file SHA-256;
5. records an aggregate digest;
6. derives a content-bound backup ID from manifest state;
7. can be verified before restore;
8. serializes backup/restore for that owner with an operation lock.

SQLite owners additionally run `quick_check`; owners with foreign keys also run `foreign_key_check` before online backup.

A local backup directory on the same disk is only a **recovery snapshot**, not a disaster-recovery copy. Production must replicate a verified backup directory to a different failure domain (other machine/object storage/off-site medium) while preserving the manifest and bytes.

## 4. Restore procedure

### SQLite owners

1. Verify the selected backup ID.
2. Stop the target owner service and close its SQLite handle.
3. Confirm the intended target DB path belongs to that owner.
4. Invoke the owner restore adapter.
5. The restore primitive first creates a pre-restore safety backup when a target exists.
6. Backup payload is copied to staging and digest-checked.
7. Staging atomically replaces the target file.
8. Reopen the owner database.
9. Run owner integrity checks and application-level verification.
10. Keep the restore receipt and safety backup until the incident is closed.

Never replace an open SQLite file and never use another service to open the database for restore.

### Artifact / Sandbox / bundle directories

Stop or quiesce writers first. Restore is staged into a sibling temporary directory; the old target is displaced only at commit time. If commit fails, the displaced target is moved back. Existing target state is also captured as a safety backup.

### Connect Vault

The credential-vault backup API accepts the encrypted vault file only. It intentionally has **no master-key parameter**. Restore the ciphertext file, then supply `ECORIONE_CONNECT_VAULT_MASTER_KEY` through the normal out-of-band secret channel. Validate credentials by normal Connect vault reads after startup.

Do not store the master key next to the vault backup, inside the backup manifest, in Git, or in dataset releases.

## 5. Flow / Temporal recovery

Flow durable execution belongs to Temporal. A complete deployment DR plan therefore needs the persistence backup mechanism for the selected Temporal deployment (for example its backing PostgreSQL/MySQL storage or the managed service's documented recovery facility).

After Temporal recovery, verify at minimum:

- namespace availability;
- representative workflow history is readable;
- a workflow waiting for approval remains waiting rather than restarting from application defaults;
- a completed workflow remains completed/idempotent;
- workers can reconnect and continue polling without creating a second durability store.

Copying `services/flow/`, worker logs, or a local working directory is **not** a Temporal backup.

## 6. Recovery drill required for closure

Batch 8 automated evidence exercises:

- live Context SQLite online backup;
- mutation after backup;
- service close + offline restore;
- restored application data equals the pre-failure state;
- SQLite `quick_check` passes;
- generic payload tampering causes backup verification failure;
- path traversal and symlink inclusion fail closed;
- Connect credential vault backup contains ciphertext only and round-trips with the separate original key;
- RnD dataset release redacts governed sensitive content, deduplicates, keeps a group in one split, is idempotent/immutable, and detects tampering;
- RnD HTTP release/list contract works behind normal internal bearer auth.

For production operations, repeat the same drill against a **copy** of real deployment state and a backup replicated to another failure domain. Do not test destructive restore against the only production copy.

## 7. Incident restore decision order

Prefer the least destructive recovery path:

1. if only derived Context projection is damaged, use Batch 7 rebuild from immutable source;
2. if owner state bytes are corrupt/lost but backup is valid, use Batch 8 restore;
3. if the machine/disk is lost, provision replacement infrastructure and restore from off-host verified backup;
4. if Temporal persistence is affected, restore Temporal through its deployment-specific DR path before starting Flow workers;
5. if Connect vault is restored but the master key is lost, the ciphertext is intentionally unrecoverable—rotate/re-provision credentials rather than bypassing encryption.

## 8. What Batch 8 does not claim

- It does not make same-disk snapshots into off-site DR automatically.
- It does not claim deterministic regex sanitation catches every form of PII.
- It does not export raw production memory as a training dataset automatically.
- It does not back up or persist the Connect master key.
- It does not invent a second durability engine for Flow.
- It does not replace Batch 7 projection rebuild semantics.
