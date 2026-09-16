# W17 — Local Closure Runner

Date: 2026-09-16  
Status: **REPO IMPLEMENTATION / REAL LOCAL RUN STILL REQUIRED**

## Purpose

The W17 no-oracle comparative harness is merged, but W17 runtime closure still requires a real local-model run. `scripts/w17-local-closure.mjs` provides a single fail-closed evidence command so that closure cannot be claimed from an exploratory or partially configured invocation.

## Command

With ECORIONE Phase 4 and the verified local model already running:

```text
pnpm evidence:w17:closure
```

Optional explicit output path:

```text
pnpm evidence:w17:closure --output .ecorione/evidence/w17-no-oracle-formal.json
```

The command is intentionally separate from `pnpm engine:start`. A closure run must not silently start or replace an operator runtime; it verifies the runtime that is already active.

## Fail-closed preflight

Before the 100 measured calls start, the runner requires:

1. current Git branch is exactly `main`;
2. worktree is clean;
3. local `HEAD` equals local `origin/main`;
4. `.env` exists;
5. `ECORIONE_INTERNAL_TOKEN` is available from `.env` or an explicit process environment override;
6. Connect, Hub, and Artifact health endpoints are reachable;
7. the configured local model runtime is reachable;
8. the configured model is listed by the runtime;
9. `ECORIONE_LOCAL_MODEL_DIGEST` resolves to the same immutable runtime digest.

A failure stops before the formal benchmark begins.

`HEAD == origin/main` means the operator must synchronize/fetch the local clone before closure. The runner does not mutate Git refs or perform an implicit pull.

## Formal run shape

The runner invokes the merged comparative harness with:

```text
5 tasks
× 5 repeats
× 4 lanes
= 100 measured model calls
```

Lanes:

```text
full-inline
ecx-all
ecx-selective-auto
ecx-selective-oracle
```

The automatic lane receives no fixture oracle indexes.

## Post-run validation

A zero exit from the comparative harness is not accepted by itself. The closure runner reopens the raw JSON and requires:

- schema version `2`;
- local target;
- exactly 5 repeats;
- exactly the four W17 lanes;
- `oracleIndexesSuppliedToAutoLane === false`;
- exactly 5 tasks;
- exactly 100 measured model calls;
- 5/5 passed task gates;
- zero failed tasks;
- selector oracle recall `1` on every task;
- automatic selected refs are non-empty, unique, and at most 3 per task;
- zero cache hits in every lane/task summary;
- median quality `1` in every lane/task summary;
- one stable non-empty model/response-model identity across the measured calls.

If any condition fails, the runner exits non-zero and does not mark the result closure-eligible.

## Evidence files

Raw evidence is written under `.ecorione/evidence/` by default and remains local/gitignored.

On a valid run the runner also writes a small local summary containing:

- repository branch/head/origin-main state;
- verified local model tag/status without credentials;
- raw evidence path;
- raw evidence SHA-256;
- raw evidence byte size;
- stable measured model identity;
- aggregate W17 measurements;
- `closureEligible: true`.

The raw model outputs remain local. Only a sanitized verified summary should be committed when the operator supplies the real result.

## Claim boundary

This runner reduces operator error; it does not replace real runtime evidence. Until the command completes successfully on the intended local machine and its evidence is reviewed, W17 remains:

```text
HARNESS READY / REAL LOCAL-MODEL RUN PENDING
```

A local W17 PASS also does not establish hosted-provider billed-cost savings. That remains W18.
