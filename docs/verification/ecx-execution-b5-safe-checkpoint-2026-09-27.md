# ECX Execution — Batch 5 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 5 CLOSED / PASS — SAFE RESUME FOR BATCH 6**

## Purpose

This is the canonical handoff after ECX Execution Batch 5. Future work should resume from this checkpoint instead of re-auditing Batches 1–5, Historical Ledger core, ECX planning/hydration, W17 selector evidence, W18 paid hosted economics, or branch hygiene.

## Exact repository identity

```text
Batch 5 base main = 0e3f0470cd8353791456ae85863c46a9bbbe6ddd
canonical PR      = #371
reviewed head     = 98fdf004e421778874a68be032fc69af9e48fad4
merged main       = 5b29c15b8878549ed47d6acf2349364f6ce4fc4a
duplicate PR      = #372 CLOSED / UNMERGED
```

The earlier WIP checkpoint remains at [ecx-execution-b5-wip-checkpoint-2026-09-27.md](ecx-execution-b5-wip-checkpoint-2026-09-27.md) as historical evidence only.

## Exact-head gates

```text
CI                              #2328 / run 36314511355 — PASS
Product Eval                    #1567 / run 36314511352 — PASS
MCP External HTTPS Acceptance   #1166 / run 36314511410 — PASS
Desktop Installer               #259  / run 36314511358 — PASS
```

The final exact head is later than the intermediate WIP fix SHAs. Earlier failed/cancelled runs are preserved as historical defect-resolution evidence in the WIP checkpoint; they are not the closure head.

## Merged-main gates

```text
CI                              #2329 / run 36314942949 — PASS
Product Eval                    #1568 / run 36314942967 — PASS
MCP External HTTPS Acceptance   #1167 / run 36314943067 — PASS
```

## Staging delivery

```text
Staging Deploy #1430 / run 36314993122 — gate PASS, deploy skipped
Staging Deploy #1431 / run 36315134564 — gate PASS, deploy job PASS
```

#1431 deployed exact merged-main SHA `5b29c15b8878549ed47d6acf2349364f6ce4fc4a` as `staging-5b29c15b8878`.

Runtime delivery evidence:

- deploy preflight PASS;
- protected public/auth bootstrap boundaries PASS;
- MCP protected-resource metadata PASS;
- MCP unauthenticated OAuth challenge PASS;
- authenticated Operations: `healthy: true`;
- unhealthy services: none;
- exact host SHA matched expected SHA;
- configured services: 15;
- running services: 15;
- non-running services: none;
- post-deploy capacity stabilization: **27.72 GiB free**.

## What Batch 5 closed

Batch 5 closes the observability/quality/economics gap specifically for the already-proven single-recipient ECX round-trip path.

### 1. Connect completion telemetry survives ECX execution

`EcxExecutionCompletionSchema` now preserves optional Connect-owned telemetry needed for end-to-end evidence:

- pricing model;
- model identity provenance;
- input/output/cache token usage;
- actual/naive cost record plus cost-accounting metadata;
- hosted spend-budget settlement evidence when present.

The fields remain optional for backward compatibility with older deterministic mocks and historical durable receipts. New real Connect completions can carry the evidence through the ECX path instead of losing it at the Hub schema boundary.

### 2. Hub process-lifetime round-trip metrics

For new successful non-replay single-recipient round trips, Hub records bounded ADR-32 process metrics for:

- round trips;
- actual model calls;
- input/output/cache tokens;
- actual USD cost;
- budget-settlement counts when Connect reports a receipt;
- child hydrated bytes;
- returned-result bytes;
- end-to-end round-trip duration.

Labels are bounded to response mode, child/parent leg, local/hosted target, provider, and parent-continuation boolean.

A successful replay records replay count/latency only and does **not** add model-call, token, or actual-cost counters a second time.

These remain process-lifetime observability projections. Batch 5 does not create a durable analytics owner, metrics database, or time-series store.

### 3. Deterministic quality/economics evidence

`scripts/ecx-round-trip-b5-evidence.mjs` provides an offline evidence path over previously captured round-trip response cases.

It:

- performs no provider/network call;
- reuses the established exact JSON `scoreReply` evaluator;
- requires non-replay success;
- requires pinned model identity for measured completions;
- requires usage + actual-cost telemetry;
- rejects a non-settled budget receipt when a budget receipt is present;
- reports actual model-call count, tokens, actual cost, transport bytes, optional duration, and exact quality pass rate;
- deliberately does not emit `savedUsd` or `savedPct`.

Root command:

```bash
pnpm run evidence:ecx-round-trip:b5 -- <evidence.json>
```

This is deterministic evaluation of captured evidence, not a new paid hosted benchmark.

### 4. Quality/economics claim boundary

Batch 5 supports claims about **observed captured cases** only.

It does not:

- infer dollar savings from packet/hydration byte reduction;
- rerun W18 merely to refresh dates;
- reinterpret historical W18 measurements as current production benchmarks;
- claim universal model quality;
- claim universal latency;
- claim universal savings;
- make a durable analytics store authoritative for product behavior.

### 5. Defect-resolution evidence preserved

The WIP phase exposed two test-harness assumptions, not runtime product defects:

1. an observability test queried a route that is registered only when an internal token is configured; the focused test was corrected to read the already-attached `OperationalMetrics.snapshot()` directly;
2. duration histogram assertions initially read only the first labeled series; the helper was corrected to aggregate all series sharing the metric name.

The final exact head `98fdf004...` passed the full closure gates above. Earlier failed/cancelled runs remain historical evidence and are not rewritten away.

## Architectural boundary

Batch 5 does not change service ownership.

- Connect remains owner of provider/model execution and raw usage/cost/budget evidence.
- Hub remains ECX orchestration and process-lifetime round-trip observability owner.
- ADR-32 remains the owner-local process telemetry model.
- The offline evaluator consumes captured evidence; it does not become a runtime service.
- No analytics database or time-series store is introduced.
- Historical Ledger remains separate from the Batch 5 metrics/evidence path.

## Tests and evidence proven

Coverage includes:

- full round-trip preservation of usage/cost fields;
- full actual model-call/token/cost counters;
- duration + returned-byte telemetry;
- successful replay without model-call/token/cost double counting;
- delta aggregation of child + parent economics exactly once;
- deterministic exact-quality pass;
- fail-closed quality mismatch;
- fail-closed unpinned model identity;
- fail-closed missing economics evidence;
- source contract forbidding savings-from-bytes metric names;
- source contract preserving no analytics DB/fan-out/A2A expansion.

Full repository CI, Product Eval, MCP acceptance, Desktop Installer exact-head gate, merged-main gates, and governed staging delivery all passed as recorded above.

## Explicit non-claims

Batch 5 does **not** implement or prove:

- durable metrics/history retention;
- multi-recipient/fan-out execution;
- parallel aggregation;
- external A2A interoperability;
- new ECX product UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- current paid-provider benchmark freshness;
- universal savings, quality, or latency advantage.

Do not silently attribute these properties to Batch 5.

## Safe resume: Batch 6

The next bounded roadmap slice is:

**Batch 6 — Historical Ledger retention/compaction/migration**

Status at this checkpoint: **NEXT / NOT STARTED**.

Batch 6 is a separate data-lifecycle scope. Start from the current Historical Ledger ownership/append-only guarantees and the exact Batch 6 roadmap/current-state material. Do not infer that Batch 5 process telemetry should be moved into Historical Ledger, and do not introduce fan-out/A2A/UI/paid-evidence work under the Batch 6 label unless separately authorized.

## Resume instructions for another session/agent

Read this file first. Then inspect exact current `main`, Batches 1–5 closure checkpoints, and only the Historical Ledger retention/compaction/migration surfaces needed for Batch 6. Do not restart branch hygiene, W17/W18 evidence work, ECX selector economics validation, or Batches 1–5.
