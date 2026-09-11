# Local Persistence / Restart — First Runtime Drill (2026-09-11)

Status: **HISTORICAL VALID FAILURE / ROOT CAUSE FIXED / SUCCESSFUL RERUN CLOSED SEPARATELY**

This note preserves the first real laptop persistence/restart drill as defect evidence. It is intentionally **not** rewritten as PASS. The final successful rerun is recorded separately in `docs/verification/local-persistence-restart-closure-2026-09-11.md`.

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

## Repository fixes

PR #46, **`fix: anchor local runtime paths to repo root`**, corrected the path contract across the affected runtime services.

Merged revision: `778e7eb19a0e2f528c64e68459d8ff6e6ecbe1ce`.

The fix:

- adds shared `resolveRepoRuntimePath` behavior;
- anchors configured relative filesystem paths to the ECORIONE repository root;
- preserves absolute paths unchanged for production/container deployments;
- applies the rule across Hub, Context, Artifact, Flow, RnD, Connect, Sandbox, Space and Sync;
- adds regression coverage for relative, fallback, empty and absolute paths.

A subsequent laptop start exposed a second bounded local bootstrap issue: the service source imported the new shared export while the compiled `@ecorione/shared-server/dist` could remain stale after `git pull`.

PR #48, **`fix: build compiled runtime deps before local dev`**, corrected that bootstrap contract. Merged revision: `673af91642ea1b9440079e396675c69f53647951`.

Local dev entrypoints now build the relevant compiled workspace dependencies before starting service processes, and regression coverage prevents the bootstrap step from being silently removed.

## Recovery confirmation after the fixes

The original failed raw state was preserved before cleanup. After synchronizing to the fixed runtime and confirming owner services opened repository-root durable paths, the same first-drill probe became readable again through owner APIs:

- Ledger: **HTTP 200** with the original head hash;
- Context: **HTTP 200** with the original episode identity/content;
- Artifact: **HTTP 200** with the original SHA-256;
- Flow: **HTTP 200 / RUNNING**;
- Hub approval: **HTTP 200 / PENDING** with the original operation identity.

This recovery confirmed the first drill's 404s were caused by wrong-path reopening. The original durable state had not been deleted or corrupted.

The original dedicated Flow probe was then rejected through the canonical cleanup path and reached terminal state.

## Historical claim boundary

The first drill remains a **valid failed persistence attempt**. Its value is that the strict harness caught a real durability-path defect before ECORIONE could incorrectly claim persistence closure.

Do not reinterpret the first drill as a successful persistence test. The later successful second drill used a fresh strict baseline on merged revision `673af91642ea1b9440079e396675c69f53647951` and independently exercised the same process + Temporal + PostgreSQL restart boundary.

Final closure evidence:

- `docs/verification/local-persistence-restart-closure-2026-09-11.md`

Final checkpoint status after the independent rerun:

> **LOCAL PERSISTENCE / RESTART CLOSED / PASS for the tested local process + Temporal + PostgreSQL-container restart boundary.**
