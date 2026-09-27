# ECX Execution — Batch 5 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **HISTORICAL WIP / SUPERSEDED BY FINAL BATCH 5 CLOSURE**

## Resume identity

```text
base main    = 0e3f0470cd8353791456ae85863c46a9bbbe6ddd
branch       = agent/ecx-observability-quality-economics-b5-20260927
telemetry    = f9a4b8728084a506ec1b1de6479b30bb39b5773b
evidence     = 0fb98b4dd5c3fe079ac0176360fa07706e658bd7
tests        = 63884db142be2b568220c172235609f45ca3aa70
compile-fix  = 7896f5561feb2cfc18c75dd24fd87e7db579ad61
format/lint  = 16b490f0d1212b8bbb7f265153028827fca6ac16
test-fix-1   = 7c0ccd876c541fa673881bdbd9f937b6ebdb4ef7
test-fix-2   = cb0ae7e28c0610db3b63997decfe730b20ac2705
canonical PR = #371
duplicate PR = #372 CLOSED UNMERGED
```

This was the canonical safe resume pointer before Batch 5 CI/PR closure. It is preserved as historical WIP evidence and superseded by [ecx-execution-b5-safe-checkpoint-2026-09-27.md](ecx-execution-b5-safe-checkpoint-2026-09-27.md). PR #371 merged successfully; PR #372 remains closed unmerged and must not be treated as a second source of truth.

## Why this scope

The current repository already has ADR-32 owner-local process telemetry, distributed HTTP tracing, Connect model/token/cost accounting, historical W17 selector evidence, and closed W18 paid hosted economics evidence. The missing Batch 5 link is the **real single-recipient Batch 3/4 round-trip path**: Connect returns detailed usage/cost/budget data, but the ECX completion schema previously stripped those fields, so Hub could not observe round-trip economics end-to-end.

Batch 5 closes that gap without creating a new analytics owner.

## Bounded implementation

### 1. Preserve Connect completion telemetry

`EcxExecutionCompletionSchema` now preserves optional Connect fields:

- pricing model;
- model identity provenance;
- input/output/cache token usage;
- actual/naive cost record and cost-accounting metadata;
- hosted spend-budget settlement evidence when present.

The fields are optional for backward compatibility with historical durable receipts and older deterministic mocks. New real Connect completions provide them.

### 2. Hub round-trip process metrics

For **new successful non-replay** single-recipient round trips Hub records:

- `ecorione_ecx_round_trips_total`;
- `ecorione_ecx_round_trip_model_calls_total`;
- input/output/cache token totals;
- `ecorione_ecx_round_trip_actual_cost_usd_total`;
- budget settlement counts when Connect reports a budget receipt;
- child hydrated bytes;
- returned-result bytes;
- end-to-end round-trip duration histogram.

Labels are bounded to response mode, child/parent leg, local/hosted target, provider, and parent-continuation boolean.

Successful replay records replay count + replay latency only. It **does not** add model-call/token/cost counters a second time.

Metrics remain process-lifetime projections under ADR-32. Batch 5 does not add an analytics table or time-series database.

### 3. Deterministic quality/economics evidence

New `scripts/ecx-round-trip-b5-evidence.mjs`:

- consumes previously captured round-trip response cases from a JSON file;
- performs no network/provider call;
- reuses the established exact JSON `scoreReply` evaluator from comparative evidence;
- requires non-replay success;
- requires pinned model identity per measured completion;
- requires usage + actual-cost telemetry;
- rejects non-settled budget evidence when a budget receipt is present;
- reports actual model calls, tokens, cost, transport bytes, optional duration, and exact quality pass rate;
- deliberately does not emit `savedUsd` or `savedPct`.

Root command:

```bash
pnpm run evidence:ecx-round-trip:b5 -- <evidence.json>
```

### 4. Claim boundary

Batch 5 measures **observed** actual cost/token/quality evidence for the bounded round-trip path.

It does **not**:

- infer dollar savings from packet/hydration byte reduction;
- rerun W18 merely for freshness;
- turn historical W18 measurements into current production claims;
- claim universal model quality, latency, or savings;
- create durable telemetry retention inside owner databases.

## Current gate state / latest defect resolution

Canonical PR: **#371**.

Latest reviewed functional head before this checkpoint refresh: `7c0ccd876c541fa673881bdbd9f937b6ebdb4ef7`.

Known gate state before rerun from that fix:

- Product Eval #1563 — PASS on prior head;
- MCP External HTTPS Acceptance #1162 — PASS on prior head;
- Desktop Installer #255 bundle — PASS; installer continuation was still running;
- CI #2324 Format — PASS;
- CI #2324 Lint — PASS;
- CI #2324 Typecheck — PASS;
- CI #2324 Test — FAILED only in `services/hub/src/ecx-b5-observability.test.ts`.

The CI failure was a **test harness assumption**, not a runtime Batch 5 behavior defect:

- the test built Hub without an internal token;
- ADR-32 correctly registers `/v1/ops/observability` only for tokenized internal services;
- the test therefore read a 404 body and interpreted absent counters as zero.

Fix `7c0ccd876c541fa673881bdbd9f937b6ebdb4ef7` imports `observabilityFor(app)` and reads the already-attached Hub `OperationalMetrics.snapshot()` directly inside the unit test. Production auth/telemetry endpoint registration is unchanged.

The next exact-head rerun proved that endpoint/snapshot diagnosis: the previous 404/counter failures disappeared, Format/Lint/Typecheck passed, Product Eval #1565 passed, MCP #1164 passed, and only one test assertion remained. The remaining assertion expected round-trip duration histogram count 2 by reading the first series with `.find()`; runtime correctly emits separate labeled series for `outcome=success` and `outcome=replay`. Fix `cb0ae7e28c0610db3b63997decfe730b20ac2705` updates only the test helper to aggregate counts across all label-series sharing the same metric name. Production telemetry remains unchanged.

Alternate PR #372 was closed unmerged after the first diagnosis. Do not reopen it unless PR #371 is explicitly abandoned.

## Focused tests

Coverage added for:

- full round-trip preservation of usage/cost fields;
- full actual model-call/token/cost counters;
- duration/returned-byte telemetry;
- successful replay without model-call/token/cost double counting;
- delta aggregation of child + parent actual economics exactly once;
- deterministic exact-quality pass;
- fail-closed quality mismatch;
- fail-closed unpinned identity;
- fail-closed missing economics evidence;
- source contract forbidding savings-from-bytes metric names;
- source contract preserving no analytics DB/fan-out/A2A scope.

## Historical closure follow-up

All closure requirements listed in the original WIP checkpoint were subsequently completed through canonical PR #371 exact head `98fdf004e421778874a68be032fc69af9e48fad4` / merge `5b29c15b8878549ed47d6acf2349364f6ce4fc4a`. Exact-head CI #2328 + Product Eval #1567 + MCP #1166 + Desktop Installer #259 passed; merged-main CI #2329 + Product Eval #1568 + MCP #1167 passed; Staging Deploy #1430 was gate-only and actual Staging Deploy #1431 passed with exact SHA match, public/auth + MCP smoke PASS, healthy Operations, 15/15 configured services running, and 27.72 GiB stabilized free disk. Current resume pointer: [ecx-execution-b5-safe-checkpoint-2026-09-27.md](ecx-execution-b5-safe-checkpoint-2026-09-27.md).

## Explicit non-scope

Do not add under Batch 5:

- new durable observability/time-series database;
- multi-recipient/fan-out/aggregation;
- external A2A;
- new ECX product UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- new paid hosted benchmark run;
- universal savings/quality/latency claims.

Batch 6+ remains separate.
