# Local Persistence / Restart — First Runtime Drill (2026-09-11)

Status: **VALID FAILURE / ROOT CAUSE FIXED IN CODE / RERUN REQUIRED**

This note preserves the first real laptop persistence/restart drill as defect evidence. It does **not** upgrade the persistence checkpoint to PASS.

## Baseline

The laptop was synchronized to reviewed `main` at `0a5e585d53e01d819027c602a2ac69f7dc130723`. The strict inventory gate passed with Context, Connect, Hub, Artifact and Flow healthy, the existing ECORIONE Temporal/PostgreSQL containers running, and the hosted-cost kill switch enabled.

The strict baseline gate then passed. The dedicated LOCAL_ONLY probe established:

- one Historical Ledger session/event with recorded event/head hash identity;
- one Context episode with recorded SHA-256 digest;
- one Artifact with recorded content digest;
- one Temporal-backed Flow in `RUNNING` state;
- one matching Hub approval in `PENDING` state with the recorded operation identity.

Raw probe identifiers and evidence remain local under gitignored `.ecorione/evidence/` and are intentionally not copied into this repository note.

## Tested restart boundary

The operator stopped only the reviewed ECORIONE-owned boundary:

1. the Phase 4 local process group;
2. `ecorione-temporal`;
3. `ecorione-temporal-db`.

The named Docker volume `ecorione_temporal_db` remained present. No unrelated Docker workload was stopped or pruned.

Restart order was dependency-safe: PostgreSQL, then Temporal, then the Phase 4 process group. Temporal became reachable again on `127.0.0.1:7233`, all required owner services returned healthy, and the Flow worker returned to `RUNNING` on task queue `ecorione-flow-v1`.

## Strict post result

The strict post gate failed on the first durable owner read:

- Hub Historical Ledger baseline session: **404 NOT_FOUND**.

Read-only diagnosis then showed:

- Context baseline episode: **404 NOT_FOUND**;
- Artifact baseline content: **404 NOT_FOUND**;
- Hub baseline approval: **404 NOT_FOUND**;
- the same Flow: **200 / RUNNING**.

Therefore Temporal/PostgreSQL retained the workflow execution, while file-backed owner state was reopened from different local filesystem locations.

## Root cause

The local `.env` uses relative filesystem values such as `./data/hub.db`. Runtime entrypoints accepted configured relative paths verbatim. Under `pnpm --filter`, each package runs with a package-local current working directory, so the same relative value can resolve under `services/<service>/data/...` instead of repository-root `data/...`.

Runtime inspection confirmed the restarted Hub had:

- cwd: `services/hub`;
- configured DB path: `./data/hub.db`;
- open SQLite file: `services/hub/data/hub.db`.

At the same time, the repository-root `data/hub.db` plus WAL/SHM files from the baseline still existed. The equivalent 404 results for Context and Artifact established that this was a storage-path contract defect, not a Temporal durability failure.

## Repository fix

PR #46, **`fix: anchor local runtime paths to repo root`**, corrected the path contract across the affected runtime services.

Merged revision: `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`.

The fix:

- adds shared `resolveRepoRuntimePath` behavior;
- anchors configured relative filesystem paths to the ECORIONE repository root;
- preserves absolute paths unchanged for production/container deployments;
- applies the rule across Hub, Context, Artifact, Flow, RnD, Connect, Sandbox, Space and Sync;
- adds regression coverage for relative, fallback, empty and absolute paths.

PR exact-head verification passed format, lint, typecheck, tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, production build and MCP External HTTPS acceptance. Post-merge `main` verification also passed.

## Claim boundary and next action

The first drill remains a **valid failed persistence attempt** and must not be rewritten as PASS. The failure is useful evidence that the strict harness caught a real durability contract defect.

Required next sequence:

1. synchronize the laptop to `main` at or after `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`;
2. preserve the original local failed evidence before mutating its state;
3. cleanly terminate the old dedicated waiting Flow probe;
4. verify owner services now open repository-root durable paths;
5. create a fresh strict baseline;
6. repeat the reviewed process + Temporal + PostgreSQL restart boundary;
7. require strict `post` PASS;
8. require strict `cleanup` PASS;
9. only then publish the final local persistence/restart closure claim.

Until that rerun succeeds, the correct checkpoint status is:

> **first runtime drill failed validly; path-resolution defect fixed in code; local persistence/restart proof pending rerun**
