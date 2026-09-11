# ECORIONE — Isolated Local Backup/Restore Evidence

Status: **CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS**  
Date: **2026-09-11**

This workstream is the operator-approved checkpoint after local persistence/restart closure. It is a new explicit evidence scope, not Batch 13 and not production/off-host disaster recovery.

Final sanitized runtime evidence:

- `docs/verification/local-backup-restore-closure-2026-09-11.md`

Implementation merge:

- PR #50 → `4e6bcd94776fc7dd75440ee35dd8fddf0b602233`

## Objective

Prove on the real synchronized laptop that ECORIONE durable owner state can be backed up with owner-scoped primitives, integrity-verified, restored into isolated targets, and read again through restored owner services without overwriting active state.

Flow's two durability layers remain separate:

- `flow.sqlite` is the Flow-owned graph/registry database;
- workflow execution/history is owned by Temporal and persisted in PostgreSQL.

A filesystem copy of Flow state is never treated as Temporal disaster recovery.

## Safety boundary

The evidence harness must not:

- restore over active `./data/*` owner state;
- delete, replace or attach the production `ecorione_temporal_db` volume to the isolated restore stack;
- stop/prune unrelated Docker workloads;
- use `docker system prune` or `docker volume prune`;
- decrypt Connect Vault merely to create a backup;
- place the Connect Vault master key in backup payload, logs, state JSON or Git;
- seed/mutate an otherwise empty active owner merely to manufacture backup evidence;
- call a local same-disk backup proof of off-host disaster recovery.

All raw evidence is constrained to gitignored `.ecorione/evidence/` and may contain private owner state. Only sanitized verification summaries enter Git.

## Owner matrix

| Owner | Durable state | Backup primitive | Isolated restore expectation |
|---|---|---|---|
| Context | SQLite L0/L1/L2 metadata/state | owner online SQLite backup | DB integrity + isolated Context API readability |
| Hub | SQLite policy/approval/audit/Historical Ledger | owner online SQLite backup | DB integrity + isolated Ledger/approval API readability |
| RnD | SQLite registry/traces + immutable dataset directory | SQLite + directory snapshot | DB integrity; dataset bytes restored when present |
| Sync | SQLite pairing/relay state | owner online SQLite backup | restore only when a live durable Sync DB existed at backup time |
| Space | SQLite notes/blocks | owner online SQLite backup | DB integrity + isolated service startup |
| Flow | SQLite graph registry | owner online SQLite backup | graph DB integrity; Temporal tested separately |
| Artifact | content-addressed filesystem CAS | directory snapshot | restored digest + isolated Artifact API bytes |
| Sandbox | durable execution receipts | directory snapshot | restored digest; workspaces remain runtime state |
| Connect | non-secret JSON state + Vault ciphertext | bundle + `vault-ciphertext` | state restored to isolated files; Vault remains ciphertext-only |
| Temporal/PostgreSQL | Temporal core + visibility databases | `pg_dump -Fc` | restore into temporary PostgreSQL + temporary Temporal |

Connect runtime provider/model settings are part of durable Connect state and are included in the non-secret owner bundle when the state file exists. Vault master key remains out-of-band.

## Commands

With normal Phase 4 runtime healthy and `.env` sourced:

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
- exact `ecorione-temporal` and `ecorione-temporal-db` containers running on pinned images;
- named `ecorione_temporal_db` volume present;
- isolated verification ports `18011`, `18021`–`18028` free;
- closed persistence evidence state available for semantic comparison;
- `ECORIONE_INTERNAL_TOKEN` available.

Full drill:

```bash
pnpm evidence:backup-restore
```

## Full drill sequence

The strict harness:

1. repeats inventory;
2. captures the already-closed persistence identities through active owner APIs without creating a new probe;
3. invokes one service-local backup worker per owner;
4. requires backups for durable owners expected to exist in the Phase 4 boundary;
5. dumps `temporal` and `temporal_visibility` from the exact running PostgreSQL container;
6. stores a mode-0600 `backup-ready` state;
7. restores owner backups only under the isolated evidence root;
8. restores both Temporal databases into temporary PostgreSQL on a dedicated temporary network;
9. starts temporary Temporal against that restored PostgreSQL state;
10. starts isolated ECORIONE owner services on `180xx` ports with all durable paths redirected to restored targets and hosted dispatch disabled;
11. requires isolated health;
12. re-reads Ledger, Context, Artifact, Flow and approval through isolated owner APIs;
13. requires semantic identity/status equality with source baseline;
14. stops isolated service processes and removes only temporary evidence Docker resources;
15. leaves local backup manifests/dumps/restored copies and mode-0600 state under `.ecorione/` for audit until explicit cleanup.

## Missing/empty owners

The drill intentionally does not create active state simply to make every row say `backed-up`.

- Core owners expected in Phase 4 fail closed when required backup state is unavailable.
- Optional state such as unused Sync DB, absent Connect Vault/non-secret state, or absent RnD dataset releases is reported `missing` rather than seeded.
- An absent optional component cannot be claimed as runtime-restored evidence.
- Deterministic adapter tests cover those restore primitives separately.

## Final real-laptop result

Runtime revision:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Run ID:

```text
backup-20260911154453-f4ac8743
```

Terminal phase:

```text
restore-verified
```

Runtime owner result:

```text
context  backed-up
hub      backed-up
rnd      backed-up
sync     missing
space    backed-up
flow     backed-up
artifact backed-up
sandbox  backed-up
connect  missing
```

`sync` and `connect` were optional absent durable source state in this run, so they are explicit limitations rather than failures or fabricated evidence.

Temporal logical restore verified both databases:

```text
temporal            39 restored tables
temporal_visibility  3 restored tables
```

Semantic verification through isolated restored services matched the source baseline:

- Ledger session `sess_persist_4dea234b52f349608b4f`, `nextSeq=1`, head hash `33344402dd8a6bfe99d0c1666cc27faaef95048a8c0bbea0c71f72bba77a2f9c`;
- Context episode `epi_bc883574927246858c0e9e0e` with expected probe text;
- Artifact `art_6c60fcc6232ee307f0de0291e9b87dd70b4309e7d853dd4529a8e442230f9f58`, 75 bytes, exact SHA-256;
- Flow `wf_f6031aeaa0fb4d448d08ba70` remained in expected post-cleanup `FAILED` state;
- approval `op_5114f45952f9461fa76980d9` remained in expected `REJECT` state.

Strict terminal output:

```text
PASS strict local backup/restore: owner backups verified, isolated restores started through owner services, and restored Temporal workflow state matched source
```

Post-run checks confirmed:

```text
NO_EVIDENCE_CONTAINERS
NO_EVIDENCE_NETWORKS
NO_ISOLATED_LISTENERS
PASS backup/restore inventory: repo, owners, isolated ports and Temporal boundary are ready
```

Active owners remained healthy and the tracked working tree remained clean.

## Evidence state

Canonical raw state:

```text
.ecorione/evidence/local-backup-restore-state.json
```

Expected terminal phase:

```text
restore-verified
```

Raw state records backup IDs/digests, Temporal dump digests, isolated restore receipts, PostgreSQL restored table counts, owner health and semantic comparisons. It must not contain provider secrets, Vault plaintext, the Vault master key or temporary PostgreSQL passwords.

## Closed claim boundary

A successful run proves only **isolated local backup/restore semantics on the tested laptop**, including the tested Temporal/PostgreSQL logical dump/restore path.

It does not prove:

- off-host or cross-machine DR;
- survival of laptop/disk loss while backup bytes remain on the same disk;
- encrypted remote backup scheduling;
- runtime restore of Sync state when no Sync durable DB existed in the source run;
- runtime restore of Connect state/Vault when no Connect durable state file existed in the source run;
- Connect Vault master-key recovery;
- hard power-loss/fsync guarantees;
- arbitrary database corruption recovery;
- point-in-time recovery;
- transactionally atomic snapshots across every owner;
- VPS/Cloudflare behavior;
- hosted-provider persistence, availability, quality, latency or billed cost.

Production DR still requires verified backups copied to a different failure domain and separate out-of-band protection of the Connect Vault master key.

## Next checkpoint

The next operator-approved local checkpoint is **local observability baseline**. Compute-host/VPS + Cloudflare remains deferred until explicitly resumed by the operator.
