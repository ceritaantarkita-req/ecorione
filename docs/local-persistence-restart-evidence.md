# Local Persistence / Restart Evidence

Status: **IN PROGRESS — OPERATOR-APPROVED LOCAL CHECKPOINT**  
Started: **2026-09-11**  
Baseline `main`: `84cf086745a14e75c3a976ceb5ca7847f691a76f`  
Working branch: `ops/local-persistence-restart-evidence-20260911`  
Harness PR: **#43 — implementation verification in progress; runtime restart not started yet**

This workstream verifies that ECORIONE local durable state survives a controlled restart according to existing owner contracts. It is a new post-closure evidence scope, **not Batch 13**, and it does not resume VPS/Cloudflare deployment.

The scope is intentionally local-first. Do not stop/prune unrelated Docker workloads, do not mutate VPS/Cloudflare state, and do not bypass owner APIs by opening another service's database directly.

## Goal

Produce real laptop evidence that, after a controlled restart of the relevant ECORIONE runtime boundaries:

- Historical Ledger state in Hub remains readable and hash-chain verification still passes;
- Context authoritative local data remains readable;
- Artifact content-addressed bytes and Context metadata still agree;
- a Temporal-backed Flow waiting on durable approval remains the same workflow after process/container restart;
- intentionally ephemeral state is identified explicitly rather than mistaken for a persistence defect;
- no unrelated project/container is stopped or pruned.

## Existing durability boundaries

Current implementation stores local durable state as follows:

| Owner | Local durable boundary relevant to this drill |
|---|---|
| Hub | SQLite at `ECORIONE_HUB_DB_PATH` or default `data/hub.db`; Historical Ledger is inside Hub-owned state |
| Context | SQLite at `ECORIONE_DB_PATH` or default `data/ecorione.db` |
| Artifact | content-addressed directory at `ECORIONE_ARTIFACT_DIR` or default `data/artifacts` plus metadata in Context |
| Flow | Flow graph metadata in `ECORIONE_FLOW_DB_PATH` / default `data/flow.sqlite`; workflow execution durability belongs to Temporal |
| Temporal | external durable execution engine at `ECORIONE_TEMPORAL_ADDRESS`, currently local Temporal backed by PostgreSQL in the laptop rehearsal |

This drill verifies owner behavior through HTTP/runtime contracts. It does not grant cross-service database access.

## Safety rules

1. Start from synchronized reviewed `main` and record exact SHA.
2. Never run global `docker stop $(docker ps -q)`, `docker compose down` against unrelated stacks, `docker system prune`, `docker volume prune`, or equivalent broad mutation.
3. Identify ECORIONE-owned Temporal/PostgreSQL containers by exact name/label before any container restart.
4. Restart only the ECORIONE Phase 4 process group and the specifically verified ECORIONE Temporal/PostgreSQL containers needed by the test.
5. Do not delete/replace local owner databases or Artifact bytes during this checkpoint.
6. Use owner HTTP contracts for application-level proof; filesystem metadata may be inventoried, but another service must not open an owner's database.
7. Keep `ECORIONE_COST_KILL_SWITCH=1`; hosted calls are not needed.
8. Raw local evidence belongs under gitignored `.ecorione/evidence/`; commit only sanitized verification summaries.
9. If a prerequisite is ambiguous, stop before mutation and inspect it first.
10. A failed persistence check is evidence; do not weaken the acceptance criteria to manufacture PASS.

## Twelve-step execution plan

### Step 1 — Preflight and inventory

Record:

- local `HEAD` and `origin/main`;
- clean tracked-tree status;
- ECORIONE service listeners/health;
- Docker container names/images/status for ECORIONE Temporal/PostgreSQL only;
- relevant data paths and basic file/directory existence;
- current Temporal endpoint/namespace.

**Gate:** exact repo identity is known and no mutation has happened.

### Step 2 — Define restart boundary

Explicitly separate:

- Phase 4 Node/Next processes owned by this ECORIONE checkout;
- ECORIONE Temporal container;
- ECORIONE Temporal PostgreSQL container;
- unrelated Docker containers/projects on the laptop.

**Gate:** exact restart target list is recorded. No broad Docker command is allowed.

### Step 3 — Baseline health

Verify at minimum:

- Context `127.0.0.1:17022`;
- Connect `127.0.0.1:17023`;
- Hub `127.0.0.1:17024`;
- Artifact `127.0.0.1:17025`;
- Flow `127.0.0.1:17028`;
- Temporal connectivity through Flow/worker.

Process metrics are expected to reset after restart and are **not** a persistence requirement.

### Step 4 — Baseline Historical Ledger probe

Through Hub owner API:

1. create a dedicated LOCAL_ONLY persistence-probe session;
2. append a deterministic probe event;
3. read the same event back;
4. record session ID, event ID, seq, head hash and `/v1/history/verify` result.

**Post-restart requirement:** exact session/event/hash remains readable and full Ledger verification still passes.

### Step 5 — Baseline Context probe

Through Context owner API:

1. append a dedicated LOCAL_ONLY/INTERNAL episode tagged as persistence evidence;
2. record its episode ID and stable expected text/digest;
3. GET the exact episode before restart.

**Post-restart requirement:** the same episode ID and content remain readable.

### Step 6 — Baseline Artifact probe

Through Artifact owner API:

1. upload a small deterministic LOCAL_ONLY/INTERNAL probe artifact;
2. record Artifact ID, size and expected SHA/content digest;
3. read it back through the authorized Artifact API before restart.

**Post-restart requirement:** the same Artifact ID returns byte-identical content and Context metadata authorization still works.

### Step 7 — Baseline Flow / Temporal probe

Through Flow owner API:

1. start one dedicated workflow with `delayMs=0` and a human approval prompt;
2. wait until its Hub durable approval exists and the workflow remains running/waiting;
3. record `flowId`, `operationId`, approval idempotency key and pre-restart Temporal status;
4. do **not** approve it before the restart.

**Post-restart requirement:** the same `flowId` remains addressable and still represents the same pending durable workflow/approval rather than a newly-created workflow.

### Step 8 — Controlled shutdown

Stop only:

- the ECORIONE Phase 4 process group owned by this checkout;
- then, for the stronger Temporal durability boundary, the exact ECORIONE Temporal container;
- restart PostgreSQL only if its exact ECORIONE ownership/name is verified and the test explicitly advances to that sub-boundary.

Do not delete volumes.

### Step 9 — Controlled restart

Restart in dependency-safe order:

1. ECORIONE Temporal PostgreSQL if it was stopped;
2. ECORIONE Temporal;
3. wait for Temporal readiness;
4. start `pnpm dev:phase4` from the synchronized checkout;
5. wait for Flow worker state `RUNNING` and service health.

### Step 10 — Post-restart verification

Re-read all baseline probes:

- Hub Historical Ledger exact session/event/hash + global verify;
- Context exact episode ID/content;
- Artifact exact ID/content/digest;
- Flow exact `flowId` + Hub approval identity/status.

Then reject/close the dedicated Flow probe cleanly so the drill does not leave a permanent waiting workflow.

**Gate:** all declared durable state survives with the same identity and integrity.

### Step 11 — Failure/recovery review

Record:

- durable state that survived;
- state that reset intentionally (for example process-lifetime observability counters);
- any defect or race discovered;
- whether the failure was repository logic, runtime readiness, environment/config, or test-fixture design;
- follow-up code/docs needed before closure.

### Step 12 — Closure

After runtime PASS or a fully-understood bounded result:

1. create sanitized verification note under `docs/verification/`;
2. update `docs/current-state-and-next-steps.md`;
3. update `docs/EXECUTION-PROGRESS.md`;
4. update this document with final verdict;
5. reconcile `README.md`, `AGENTS.md`, `docs/fase6-hardening.md`, and operations docs if their next-work/status text changed;
6. add/update ADR only if architecture/ownership/authority changed;
7. run exact-head CI;
8. merge with expected-head guard;
9. verify post-merge `main` CI;
10. synchronize laptop and confirm `TRACKED_SYNC_OK`.

## Acceptance criteria

This checkpoint can close **PASS** only if all applicable conditions hold:

- repository identity and restart boundary were explicit before mutation;
- no unrelated Docker workload was stopped/pruned;
- Hub probe survives with same event/hash identity and Ledger verification passes;
- Context probe survives with same episode identity/content;
- Artifact probe survives with same Artifact ID and byte digest;
- Flow/Temporal probe survives the tested restart boundary with the same workflow and durable approval identity;
- Phase 4 returns healthy after restart;
- intentionally ephemeral state is documented rather than counted as a failure;
- raw evidence is preserved locally/gitignored;
- sanitized verification accurately records limitations;
- exact-head and post-merge repository gates pass.

If PostgreSQL itself is not restarted in the first pass because ownership/readiness is not yet safely identified, the result must say **process + Temporal-container persistence verified; PostgreSQL-container restart pending** rather than silently upgrading the claim.

## Non-goals

This checkpoint does not prove:

- backup/restore correctness — that is the next separate checkpoint;
- off-host disaster recovery;
- VPS durability;
- Cloudflare/public-edge behavior;
- hosted-provider behavior/cost;
- hard power-loss/fsync semantics beyond the restart boundary actually exercised;
- durability of intentionally process-local metrics/caches;
- automatic recovery from arbitrary disk/database corruption.

## Expected follow-up sequence

```text
local persistence/restart
  -> local backup/restore
  -> local observability baseline
  -> UX/product validation
  -> immutable local model identity hardening
  -> VPS/Cloudflare only when explicitly resumed
```

Canonical handoff: `docs/current-state-and-next-steps.md`.
