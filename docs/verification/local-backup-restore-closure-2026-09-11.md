# ECORIONE — Local Backup/Restore Closure Evidence

Date: **2026-09-11**  
Status: **CLOSED / PASS — ISOLATED LOCAL BACKUP/RESTORE**

## Verdict

The operator-approved isolated local backup/restore checkpoint passed on the real synchronized laptop.

Runtime revision:

```text
4e6bcd94776fc7dd75440ee35dd8fddf0b602233
```

Implementation was merged by PR #50 (`feat: add isolated local backup restore evidence`) before the real-laptop drill. The PR exact-head CI and MCP External HTTPS acceptance were green before merge.

This checkpoint proves the tested **same-laptop isolated backup/restore path** for the durable owners that had state at backup time, including a logical Temporal/PostgreSQL dump/restore path. It does not prove off-host disaster recovery or disk-loss survival.

## Preconditions

Strict inventory passed immediately before the drill:

- `HEAD == origin/main == 4e6bcd94776fc7dd75440ee35dd8fddf0b602233`;
- tracked working tree clean;
- RnD, Context, Connect, Hub, Artifact, Sandbox, Space and Flow health all returned HTTP 200;
- exact `ecorione-temporal` container running `temporalio/auto-setup:1.29.7`;
- exact `ecorione-temporal-db` container running `postgres:17.6-alpine`;
- named volume `ecorione_temporal_db` present;
- isolated verification ports `18011`, `18021`–`18028` free;
- closed persistence evidence available as the semantic comparison source;
- hosted cost kill switch forced on.

Inventory ended with:

```text
PASS backup/restore inventory: repo, owners, isolated ports and Temporal boundary are ready
```

## Full isolated drill

Command:

```bash
pnpm evidence:backup-restore
```

Run ID:

```text
backup-20260911154453-f4ac8743
```

Terminal phase:

```text
restore-verified
```

The strict harness ended with:

```text
PASS strict local backup/restore: owner backups verified, isolated restores started through owner services, and restored Temporal workflow state matched source
```

Raw local evidence remains gitignored at:

```text
.ecorione/evidence/local-backup-restore-state.json
.ecorione/evidence/local-backup-restore/
```

The raw evidence may contain private owner state and is intentionally not committed.

## Owner backup result

| Owner | Runtime backup result | Closure meaning |
|---|---:|---|
| Context | `backed-up` | SQLite online backup + isolated restore verified |
| Hub | `backed-up` | SQLite online backup + isolated Ledger/approval readability verified |
| RnD | `backed-up` | owner DB backed up; optional dataset content follows presence-at-source semantics |
| Space | `backed-up` | SQLite backup/restore verified |
| Flow graph registry | `backed-up` | Flow-owned SQLite layer backed up/restored; Temporal tested separately |
| Artifact | `backed-up` | CAS directory backup/restore + semantic artifact bytes verified |
| Sandbox receipts | `backed-up` | durable receipt directory backup/restore verified |
| Sync | `missing` | no live optional durable Sync DB existed at backup time; not seeded merely for evidence |
| Connect | `missing` | no optional durable Connect state/Vault file existed at backup time; not seeded merely for evidence |

`missing` is not converted into a runtime-restore claim. The deterministic adapters remain covered by repository tests, but this real run does not claim runtime restore of absent Sync/Connect durable state.

## Temporal/PostgreSQL result

The exact active Temporal PostgreSQL container was logically dumped without replacing or attaching the production volume.

Restored databases:

```text
temporal
temporal_visibility
```

Restored table counts observed by the evidence harness:

```text
temporal: 39
temporal_visibility: 3
```

The dumps were restored into a temporary PostgreSQL container on a dedicated temporary Docker network. A temporary Temporal container then started against that restored database state. The production `ecorione_temporal_db` volume was never attached to the isolated restore stack.

## Semantic verification through restored owner APIs

The known closed persistence identities were re-read through the isolated restored services.

### Ledger

```text
sessionId: sess_persist_4dea234b52f349608b4f
nextSeq: 1
headHash: 33344402dd8a6bfe99d0c1666cc27faaef95048a8c0bbea0c71f72bba77a2f9c
```

The restored Ledger session identity, sequence and head hash matched the active source baseline.

### Context

```text
episodeId: epi_bc883574927246858c0e9e0e
rawText: ECORIONE local persistence/restart probe persist-97f03cc862644f4084d69161ec8ebf1d
```

The restored Context identity/text matched the source baseline.

### Artifact

```text
artifactId: art_6c60fcc6232ee307f0de0291e9b87dd70b4309e7d853dd4529a8e442230f9f58
sha256: 6c60fcc6232ee307f0de0291e9b87dd70b4309e7d853dd4529a8e442230f9f58
sizeBytes: 75
```

The restored Artifact bytes matched the source digest exactly.

### Flow / approval

```text
flowId: wf_f6031aeaa0fb4d448d08ba70
flow status: FAILED
approval operationId: op_5114f45952f9461fa76980d9
approval status: REJECT
```

Those are the expected post-cleanup source states from the already-closed persistence probe. The isolated restored Flow and Hub approval matched the source baseline rather than an earlier pre-cleanup state.

## Post-run safety verification

After the successful drill, the operator verified:

```text
NO_EVIDENCE_CONTAINERS
NO_EVIDENCE_NETWORKS
NO_ISOLATED_LISTENERS
```

A fresh strict backup/restore inventory then passed again:

- active owner health remained HTTP 200;
- production Temporal/PostgreSQL remained running;
- `ecorione_temporal_db` remained present;
- isolated ports were free;
- repo remained synchronized and tracked-clean.

No temporary evidence container/network/listener remained after cleanup.

## Claim boundary

Verified by this checkpoint:

> owner-scoped local backups for the state that actually existed, integrity-checked isolated restores, service-level readability through restored owner contracts, and Temporal core/visibility logical dump + isolated PostgreSQL/Temporal restore on the tested laptop.

Not verified by this checkpoint:

- off-host or cross-machine disaster recovery;
- survival of laptop/disk loss while backup bytes remain on the same laptop;
- encrypted remote backup scheduling;
- restore of Sync state when no Sync durable DB existed in the source run;
- restore of Connect state/Vault when no such durable file existed in the source run;
- recovery of the Connect Vault master key (it remains out-of-band by design);
- hard power-loss/fsync guarantees;
- arbitrary corruption recovery;
- point-in-time recovery;
- transactionally atomic cross-owner snapshots;
- VPS/Cloudflare behavior;
- hosted-provider persistence, quality, latency or billed cost.

## Closure

**LOCAL BACKUP/RESTORE: CLOSED / PASS WITH EXPLICIT ABSENT-OWNER LIMITATIONS.**

The next operator-approved local checkpoint is **local observability baseline**. Compute-host/VPS + Cloudflare remains deferred until the operator explicitly resumes deployment.
