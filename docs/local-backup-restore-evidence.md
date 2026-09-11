# ECORIONE — Isolated Local Backup/Restore Evidence

Status: **IMPLEMENTED / RUNTIME CLOSURE PENDING**  
Date: **2026-09-11**

This workstream is the operator-approved checkpoint after local persistence/restart closure. It is a new explicit evidence scope, not Batch 13 and not production/off-host disaster recovery.

## Objective

Prove on the real synchronized laptop that ECORIONE durable owner state can be backed up with the existing owner-scoped primitives, integrity-verified, restored into isolated targets, and read again through restored owner services without overwriting active state.

The drill must also keep Flow's two durability layers separate:

- `flow.sqlite` is the Flow-owned graph/registry database;
- workflow execution/history is owned by Temporal and persisted in PostgreSQL.

A filesystem copy of Flow state is never treated as Temporal disaster recovery.

## Safety boundary

The evidence harness must not:

- restore over `./data/*` active owner state;
- delete or replace `ecorione_temporal_db`;
- stop/prune unrelated Docker workloads;
- use `docker system prune` or `docker volume prune`;
- decrypt Connect Vault merely to create a backup;
- place the Connect Vault master key in backup payload, logs, state JSON, or Git;
- seed/mutate an otherwise empty active owner merely to manufacture backup evidence;
- call a local backup a proof of off-host disaster recovery.

All backup and restore evidence is constrained to gitignored:

```text
.ecorione/evidence/local-backup-restore/
```

Raw evidence may contain private owner state and therefore remains local, mode-restricted, and uncommitted. Only sanitized verification summaries may enter Git.

## Owner matrix

| Owner | Durable state | Backup primitive | Isolated restore expectation |
|---|---|---|---|
| Context | SQLite L0/L1/L2 metadata/state | owner online SQLite backup | restored DB integrity + isolated Context API readability |
| Hub | SQLite policy/approval/audit/Historical Ledger | owner online SQLite backup | restored DB integrity + isolated Ledger/approval API readability |
| RnD | SQLite registry/traces + immutable dataset directory | SQLite + directory snapshot | restored DB integrity; dataset bytes restored when present |
| Sync | SQLite pairing/relay state | owner online SQLite backup | restore only when a live durable Sync DB existed at backup time |
| Space | SQLite notes/blocks | owner online SQLite backup | restored DB integrity + isolated service startup |
| Flow | SQLite graph registry | owner online SQLite backup | restored graph DB integrity; **not** Temporal execution history |
| Artifact | content-addressed filesystem CAS | directory snapshot | restored digest + isolated Artifact API bytes |
| Sandbox | durable execution receipts | directory snapshot | restored digest; workspaces remain non-backup runtime state |
| Connect | non-secret JSON state + credential Vault ciphertext | bundle + `vault-ciphertext` file | state restored to isolated files; Vault remains ciphertext-only |
| Temporal/PostgreSQL | Temporal core + visibility databases | `pg_dump -Fc` through the exact DB container | restore into temporary PostgreSQL + temporary Temporal, then verify Flow through isolated Flow API |

### Connect state completeness

Runtime provider/model settings are durable Connect state. This workstream adds `ECORIONE_CONNECT_SETTINGS_PATH` to `ConnectBackupPaths` so the owner bundle contains runtime settings alongside spend budget and outbound-MCP state when those files exist.

The Vault remains a separate `vault-ciphertext` backup. The master key is always out-of-band.

## Commands

With the normal Phase 4 runtime already healthy and `.env` sourced:

```bash
set -a
source .env
set +a
export ECORIONE_COST_KILL_SWITCH=1

pnpm evidence:backup-restore:inventory
```

Inventory is strict and read-only with respect to owner state. It requires:

- synchronized clean `main`;
- active RnD, Context, Connect, Hub, Artifact, Sandbox, Space and Flow health;
- exact `ecorione-temporal` and `ecorione-temporal-db` containers running on the pinned images;
- named `ecorione_temporal_db` volume still present;
- isolated verification ports `18011`, `18021`–`18028` free;
- closed persistence evidence state available so restored semantic identities can be compared without creating new active probes;
- `ECORIONE_INTERNAL_TOKEN` available.

Run the full drill only after inventory passes:

```bash
pnpm evidence:backup-restore
```

## Full drill sequence

The harness performs these gates in order:

1. repeat strict inventory;
2. read the already-closed persistence probe through active owner APIs to capture a non-mutating semantic baseline;
3. invoke one service-local backup worker per owner, so the central harness does not open another owner's SQLite database directly;
4. require backups for the core Phase 4 durable owners;
5. dump `temporal` and `temporal_visibility` from the exact running PostgreSQL container with custom-format `pg_dump`;
6. persist a mode-0600 `backup-ready` evidence state before any restore verification;
7. invoke each owner worker to restore only under the isolated evidence root;
8. restore both Temporal PostgreSQL databases into a temporary PostgreSQL container on a dedicated temporary Docker network;
9. start a temporary Temporal container against that restored PostgreSQL state on a random loopback host port;
10. start isolated ECORIONE owner services on `180xx` ports with **all durable paths overridden to restored targets** and hosted cost kill switch forced on;
11. require isolated owner health;
12. re-read the known Ledger session, Context episode, Artifact bytes, Flow execution, and Hub approval through the isolated owner APIs;
13. require the same Ledger hash/sequence, Context identity/text, Artifact SHA-256, Flow identity/status, and approval identity/status as the active source baseline;
14. stop isolated service processes and remove only the temporary evidence Temporal/PostgreSQL containers/network;
15. leave the local backup manifests/dumps/restored copy and mode-0600 evidence JSON under `.ecorione/` for audit until explicit cleanup.

The production Temporal volume is never attached to the isolated restore stack.

## Missing/empty owners

The drill intentionally does not create active records just so an owner has something to back up.

- Core owners that should exist in the running Phase 4 boundary fail closed if their backup is missing.
- Optional state, such as an unused Sync database, absent Connect Vault, absent Connect non-secret state file, or absent RnD dataset releases, is reported as missing rather than created in active storage.
- An absent optional component cannot be claimed as runtime-restored evidence; deterministic adapter tests still cover its restore primitive.

## Evidence state

Canonical raw state:

```text
.ecorione/evidence/local-backup-restore-state.json
```

Expected terminal phase after a successful drill:

```text
restore-verified
```

The file records backup IDs/digests, Temporal dump SHA-256 values, isolated restore receipts, PostgreSQL restored table counts, owner health, and semantic identity comparisons. It must not contain provider secrets, Vault plaintext, the Vault master key, or temporary PostgreSQL passwords.

## PASS definition

The checkpoint can be called local backup/restore `PASS` only when all of these are true on synchronized merged `main`:

- inventory PASS;
- required owner backup manifests created and verified;
- owner restores target only the isolated evidence root;
- restored SQLite owners pass integrity checks;
- restored directory/bundle digests match manifests;
- Temporal core and visibility dumps restore successfully into temporary PostgreSQL;
- temporary Temporal starts from those restored databases;
- isolated owner services become healthy;
- Ledger, Context, Artifact, Flow and approval semantic identities match the source baseline through owner APIs;
- no evidence container/network remains after the run;
- repository exact-head gates and post-merge gates are green;
- a sanitized verification note records the actual run without widening the claim.

## Claim boundary

A successful run proves only **isolated local backup/restore semantics on the tested laptop**, including the tested Temporal/PostgreSQL logical dump/restore path.

It does **not** prove:

- off-host or cross-machine disaster recovery;
- survival of laptop/disk loss when backup bytes remain on the same disk;
- encrypted remote backup scheduling;
- hard power-loss/fsync guarantees;
- arbitrary database corruption recovery;
- point-in-time recovery;
- a transactionally atomic snapshot across every ECORIONE owner simultaneously;
- VPS/Cloudflare behavior;
- hosted-provider persistence, availability, quality, latency or billed cost.

Production DR still requires verified backups copied to a different failure domain and separate out-of-band protection of the Connect Vault master key.
