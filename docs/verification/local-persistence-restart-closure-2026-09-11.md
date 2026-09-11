# Local Persistence / Restart — Closure Evidence (2026-09-11)

Status: **CLOSED / PASS — LOCAL PROCESS + TEMPORAL + POSTGRESQL-CONTAINER RESTART BOUNDARY**

This note records the successful second real-laptop persistence/restart drill after the first valid failure exposed a local runtime-path defect. It is sanitized verification evidence; raw probe state remains local under gitignored `.ecorione/evidence/`.

## Repository/runtime baseline

Successful rerun baseline revision:

`673af91642ea1b9440079e396675c69f53647951`

That revision includes:

- PR #46 path-contract fix, which anchors configured relative runtime filesystem paths to the ECORIONE repository root while preserving absolute production paths;
- PR #48 local bootstrap fix, which builds compiled workspace runtime dependencies before local dev entrypoints so a fresh `git pull` cannot leave stale `dist` exports behind.

Before the successful baseline, runtime inspection confirmed the effective durable owner paths were repository-root paths even though package cwd values remained service-local:

- Hub: `data/hub.db`;
- Context: `data/ecorione.db`;
- Flow metadata: `data/flow.sqlite`;
- Artifact: repository-root `data/artifacts` according to the configured owner boundary.

Required owner services were healthy and the Flow worker was `RUNNING`. `ECORIONE_COST_KILL_SWITCH=1` remained enabled.

## Historical first-drill recovery confirmation

Before creating the fresh second baseline, the preserved first-drill probe was read again after the path fix. The same historical state reappeared through owner APIs:

- Ledger session: HTTP 200 with the original head hash;
- Context episode: HTTP 200 with the original identity/content;
- Artifact: HTTP 200 with the original SHA-256;
- Flow: HTTP 200 / `RUNNING`;
- Hub approval: HTTP 200 / `PENDING` with the original operation identity.

This confirms the first drill's 404 results were caused by reopening different package-relative storage locations, not by deletion/corruption of the repository-root durable state. The historical failure remains preserved separately in `local-persistence-restart-first-drill-2026-09-11.md`.

The old dedicated Flow probe was then rejected through the canonical cleanup path and reached a terminal `FAILED` state.

## Fresh strict baseline

The second strict baseline passed on `673af91642ea1b9440079e396675c69f53647951`.

The dedicated LOCAL_ONLY probe recorded exact identities/digests for:

- one Historical Ledger session/event with `eventHash == headHash` and `nextSeq == 1`;
- one Context episode + SHA-256;
- one Artifact ID + byte SHA-256;
- one Temporal-backed Flow in `RUNNING` state;
- one Hub durable approval in `PENDING` state with matching operation identity.

The strict wrapper returned both baseline PASS messages and stored the raw state mode-0600 under `.ecorione/evidence/`.

## Tested restart boundary

The successful drill intentionally exercised the stronger local boundary:

1. stop only the ECORIONE Phase 4 local process group;
2. stop exact container `ecorione-temporal`;
3. stop exact container `ecorione-temporal-db`;
4. verify the named volume `ecorione_temporal_db` still exists;
5. restart PostgreSQL;
6. restart Temporal and wait for `127.0.0.1:7233` readiness;
7. restart `pnpm dev:phase4`;
8. wait for required owner services healthy and Flow worker `RUNNING`.

No unrelated Docker workload was stopped or pruned. No database, Artifact content or Docker volume was deleted/recreated.

Both stopped ECORIONE containers exited cleanly in the successful drill and the existing named PostgreSQL volume remained present.

## Strict post result

Post-restart inventory passed with synchronized/clean Git state and all required owner health checks green.

The strict post gate then passed with exact baseline identity/integrity preserved:

- Historical Ledger `nextSeq == 1`;
- Ledger post `eventHash` exactly matched baseline `eventHash`;
- Ledger post `headHash` exactly matched baseline `headHash`;
- Context exact episode ID and SHA-256 survived;
- Artifact exact ID and SHA-256 survived;
- Flow exact `flowId` remained `RUNNING`;
- Hub approval remained the same `PENDING` approval/operation identity;
- Ledger global verification remained readable/valid through the owner API.

Canonical result:

```text
PASS persistence post: Ledger, Context, Artifact and pending Flow identities survived the tested restart boundary
PASS strict persistence post
```

## Final cleanup

After post verification passed, the dedicated second Flow probe was rejected through the canonical cleanup phase. Final Flow state was terminal (`FAILED`) and both cleanup gates passed:

```text
PASS persistence cleanup: dedicated Flow probe is no longer waiting
PASS strict persistence cleanup
```

No dedicated evidence workflow remains waiting.

## Final verdict

**LOCAL PERSISTENCE / RESTART: PASS / CLOSED**

The evidence supports this bounded claim:

> On the real local laptop boundary, ECORIONE owner-process state plus the existing Temporal container and its PostgreSQL container survived the controlled stop/start sequence with exact Historical Ledger, Context, Artifact, Flow and durable approval identities/integrity preserved.

This closes the operator-approved local persistence/restart checkpoint.

## What this does not prove

The closure does **not** prove:

- local backup/restore correctness;
- off-host backup or disaster recovery;
- host-loss recovery;
- arbitrary database/disk corruption recovery;
- hard power-loss/fsync semantics beyond the controlled stop/start boundary;
- VPS/compute-host persistence;
- Cloudflare behavior;
- hosted-provider persistence/cost behavior;
- durability of intentionally process-local metrics/caches.

Those claims must remain separate.

## Next checkpoint

The next operator-approved checkpoint is **isolated local backup/restore**:

1. generate backups through existing owner-scoped tooling;
2. preserve receipts/digests;
3. restore into isolated targets rather than overwriting active state;
4. verify restored state/integrity through owner contracts;
5. keep VPS/Cloudflare deferred unless explicitly resumed.
