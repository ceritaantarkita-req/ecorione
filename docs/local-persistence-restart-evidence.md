# Local Persistence / Restart Evidence

Status: **CLOSED / PASS — LOCAL PROCESS + TEMPORAL + POSTGRESQL-CONTAINER RESTART VERIFIED**  
Started: **2026-09-11**  
Runtime closure revision: `673af91642ea1b9440079e396675c69f53647951`  
Canonical closure evidence: `docs/verification/local-persistence-restart-closure-2026-09-11.md`

This workstream verified that ECORIONE local durable state survives a controlled restart according to existing owner contracts. It is a post-closure evidence scope, **not Batch 13**, and it does not resume VPS/Cloudflare deployment.

## Final verdict

**PASS / CLOSED for the tested real-laptop boundary.**

The successful second drill proved that the same durable identities/integrity survived a controlled stop/start of:

- the ECORIONE Phase 4 local process group;
- exact container `ecorione-temporal`;
- exact container `ecorione-temporal-db`;
- with existing named PostgreSQL volume `ecorione_temporal_db` preserved.

The strict post gate verified exact Historical Ledger, Context, Artifact, Flow and Hub approval identity/integrity after restart. The strict cleanup gate then terminalized the dedicated waiting Flow probe.

The first runtime drill remains preserved as a **valid failure** in `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`. It exposed a real relative-path defect: configured values such as `./data/hub.db` were previously resolved from package-local cwd under `pnpm --filter`, causing restarted owner services to open `services/<service>/data/...` instead of repository-root `data/...`.

PR #46 fixed that path contract across affected runtime services. PR #48 then fixed a second local bootstrap issue where service source could import a new shared export while the local compiled workspace `dist` remained stale after `git pull`. The successful rerun occurred only after both fixes were merged and verified.

Before the second baseline, the original failed probe reappeared through owner APIs with its original Ledger/Context/Artifact/Flow/approval identity. That recovery confirmed the first failure was wrong-path reopening rather than data deletion/corruption.

## Canonical commands

The default command remains the strict gate:

```bash
pnpm evidence:persistence-restart:inventory
pnpm evidence:persistence-restart --phase baseline
# operator-controlled restart boundary
pnpm evidence:persistence-restart --phase post
pnpm evidence:persistence-restart --phase cleanup
```

`scripts/local-persistence-restart-evidence.mjs` remains available through `pnpm evidence:persistence-restart:raw` for diagnostics, but it is **not** the canonical closure gate.

## Durable boundaries exercised

| Owner | Local durable boundary exercised |
|---|---|
| Hub | repository-root SQLite at `data/hub.db`; Historical Ledger and durable approval state inside Hub-owned storage |
| Context | repository-root SQLite at `data/ecorione.db` |
| Artifact | repository-root content-addressed directory `data/artifacts` plus Context metadata authorization |
| Flow | repository-root metadata SQLite `data/flow.sqlite`; workflow execution durability in Temporal |
| Temporal | exact local Temporal container backed by exact local PostgreSQL container + named volume `ecorione_temporal_db` |

Owner behavior was verified through owner HTTP/runtime contracts. No cross-service database reads were used for acceptance evidence.

## Safety rules retained

1. Start from synchronized reviewed `main` and record exact SHA.
2. Never run global `docker stop $(docker ps -q)`, broad `docker compose down`, `docker system prune`, `docker volume prune`, or equivalent unrelated mutation.
3. Identify ECORIONE-owned Temporal/PostgreSQL containers exactly before mutation.
4. Restart only the intended ECORIONE process/container boundary.
5. Do not delete/replace owner databases, Artifact bytes or PostgreSQL volumes during the drill.
6. Use owner HTTP contracts for application-level proof.
7. Keep `ECORIONE_COST_KILL_SWITCH=1`; hosted calls are unnecessary.
8. Raw local evidence belongs under gitignored `.ecorione/evidence/`; commit only sanitized summaries.
9. A failed persistence check is evidence; never weaken acceptance criteria to manufacture PASS.
10. Use the strict wrapper as the canonical baseline/post/cleanup gate.

## Successful execution sequence

### 1. Inventory

The synchronized laptop runtime was checked for:

- exact Git revision/clean tracked tree;
- required service health/listeners;
- exact ECORIONE Temporal/PostgreSQL containers;
- data-path configuration;
- Temporal endpoint/namespace.

### 2. Effective-path verification

After the path/bootstrap fixes, runtime file-descriptor inspection confirmed that service-local cwd no longer changed durable storage location:

- Hub opened repository-root `data/hub.db`;
- Context opened repository-root `data/ecorione.db`;
- Flow opened repository-root `data/flow.sqlite`.

### 3. Fresh strict baseline

A new LOCAL_ONLY probe recorded:

- dedicated Historical Ledger session/event + exact head/event hash;
- dedicated Context episode + SHA-256;
- dedicated Artifact + SHA-256;
- dedicated Temporal-backed Flow `RUNNING`;
- matching Hub approval `PENDING` with exact operation identity.

The strict baseline required `eventHash == headHash`, `nextSeq == 1`, Flow `RUNNING`, approval `PENDING`, and exact approval operation identity.

### 4. Controlled shutdown

Only the reviewed ECORIONE boundary was stopped:

1. Phase 4 process group;
2. `ecorione-temporal`;
3. `ecorione-temporal-db`.

The named PostgreSQL volume remained present. No unrelated workload was stopped/pruned.

### 5. Controlled restart

Restart order was:

1. PostgreSQL;
2. Temporal;
3. wait for `127.0.0.1:7233`;
4. `pnpm dev:phase4`;
5. wait for required owner health + Flow worker `RUNNING`.

`pnpm dev:phase4` now builds compiled runtime workspace dependencies first, preventing stale shared-package `dist` exports after source updates.

### 6. Strict post verification

The same baseline probe survived with exact identity/integrity:

- Ledger `nextSeq == 1`;
- Ledger event/head hashes unchanged;
- global Ledger verify remained readable/valid;
- Context episode ID/SHA unchanged;
- Artifact ID/SHA unchanged;
- Flow exact `flowId` remained `RUNNING`;
- Hub approval remained the same `PENDING` approval with matching operation identity;
- all required owner services were healthy.

Canonical result:

```text
PASS persistence post: Ledger, Context, Artifact and pending Flow identities survived the tested restart boundary
PASS strict persistence post
```

### 7. Cleanup

The dedicated second Flow probe was rejected only after strict post PASS. It reached terminal state and cleanup returned:

```text
PASS persistence cleanup: dedicated Flow probe is no longer waiting
PASS strict persistence cleanup
```

## Acceptance criteria — result

All applicable closure conditions passed:

- explicit synchronized repository identity and restart boundary;
- no unrelated Docker workload stopped/pruned;
- strict waiting Flow + pending approval baseline;
- Hub Ledger exact event/head-hash survival + verification;
- Context exact episode/digest survival;
- Artifact exact ID/byte-digest survival;
- same Temporal-backed Flow + durable approval identity survival;
- Phase 4 healthy after restart;
- cleanup left the dedicated Flow terminal;
- raw evidence preserved locally/gitignored;
- historical first failure preserved rather than rewritten away;
- sanitized closure evidence committed separately.

Repository exact-head/post-merge verification for the closure documentation is completed by the closure PR workflow and recorded in the canonical handoff once merged.

## Claim boundary

The correct claim is:

> **Local owner storage + ECORIONE Phase 4 process restart + Temporal container restart + PostgreSQL container restart persistence verified on the real laptop boundary.**

This does **not** prove:

- backup/restore correctness;
- off-host disaster recovery;
- host-loss recovery;
- VPS durability;
- Cloudflare/public-edge behavior;
- hosted-provider persistence/cost;
- hard power-loss/fsync semantics beyond the controlled stop/start boundary;
- arbitrary disk/database corruption recovery;
- durability of intentionally process-local metrics/caches.

## Next checkpoint

```text
local persistence/restart — CLOSED / PASS
  -> isolated local backup/restore — ACTIVE NEXT CHECKPOINT
  -> local observability baseline
  -> UX/product validation
  -> immutable local model identity hardening
  -> VPS/Cloudflare only when explicitly resumed
```

Canonical handoff: `docs/current-state-and-next-steps.md`.
