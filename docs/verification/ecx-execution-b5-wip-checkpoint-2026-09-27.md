# ECX Execution — Batch 5 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **ACTIVE / SAFE WIP — 5.1 CODE + TESTS COMMITTED / GATES NOT YET RUN**

## Resume identity

```text
base main        = 0e3f0470cd8353791456ae85863c46a9bbbe6ddd
branch           = agent/ecx-observability-economics-b5-20260927
telemetry        = d202688cbdb9dc2eb266e61fcaef0024760c628b
compat hardening = 016b5e4423d4b75c9540acecae85f6d0a63f9997
focused tests    = 9e33c63e72593d676f8dda151c071b134dc1ff3d
```

This is a safe resume pointer, **not** a PASS claim. Repository gates have not yet validated Batch 5.1 at this checkpoint.

## Accepted Batch 5 boundary

Batch 5 measures the real closed single-recipient execution path rather than reopening historical selector/economics work.

### Required evidence

- plan / selection / hydration / recipient execution / complete round-trip latency;
- Connect-reported input/output/cache token usage and accounting cost;
- selected/omitted reference counts plus owner-denial **event** evidence;
- replay/retry and failure outcome evidence;
- deterministic final-answer quality;
- comparative baseline:
  - full-context single-agent;
  - actual single-recipient ECX Agent A -> Agent B -> Agent A;
- enough evidence to state whether the full handoff path improves efficiency after its complete orchestration overhead, with limitations explicit.

### Explicitly not a W17/W18 rerun

- W17 selector closure remains historical and closed;
- W18 paid hosted economics remains historical and closed;
- do not spend hosted-provider money merely to refresh the date;
- Batch 5 may reuse deterministic fixtures/scoring utilities, but its measurement target is the actual recipient execution/round-trip path.

## Batch 5.1 committed implementation

### Completion accounting contract

`EcxExecutionCompletionSchema` can now retain a bounded subset of Connect accounting:

- pricing model / model identity provenance when present;
- input/output/cache token usage;
- actual/naive USD;
- saved USD / saved percent;
- optimizer overhead;
- baseline token usage when present.

Unknown Connect cost fields are stripped by the ECX schema rather than causing a parse failure. Existing historical completion/round-trip payloads without Batch 5 telemetry remain valid.

### Round-trip telemetry

Fresh round-trip responses can carry:

- total E2E latency;
- child execution latency;
- parent continuation latency where applicable;
- accounted model-call components;
- aggregate input/output/cache tokens;
- aggregate actual/naive USD;
- candidate/selected/omitted ref counts.

For `delta`, token/cost totals aggregate child + parent continuation. For `full`, they contain the child call only.

### Hub process-lifetime telemetry

Batch 5.1 adds owner-local metrics for:

- plan duration;
- hydration duration + outcome/mode;
- recipient execution duration + outcome;
- round-trip duration + outcome;
- child and parent-continuation duration;
- execution and round-trip replay outcomes;
- selected/omitted ref counts;
- reference-denial **events**.

These metrics remain process-lifetime observability under ADR-32. **No durable telemetry table/database was added.**

### Denial semantics

The current owner APIs expose whole-operation denial, not a trustworthy exact individual-denied-ref count. Batch 5 therefore records `reference_denial_events_total` and does not fabricate an exact denied-ref quantity.

## Focused tests committed

Coverage added for:

- full Connect accounting shape -> bounded ECX subset;
- historical Batch 4 round-trip compatibility without telemetry;
- `delta` child+parent token/cost aggregation;
- `full` one-child-call aggregation without parent model authority;
- replay without provider redispatch;
- round-trip duration/outcome/replay metrics;
- owner-reference denial event + hydration failure latency;
- source-level preservation of ADR-32 (no ECX telemetry DB);
- preservation of single-recipient scope.

## Still required

### 5.1 validation

1. run format/lint/typecheck/focused+full tests;
2. repair any defect on this same branch;
3. retain Batch 1–4 regression behavior.

### 5.2 comparative harness

Build a new Batch 5 harness above the actual round-trip route. Reuse deterministic fixtures/scoring from `scripts/comparative-evidence.mjs` where useful, but do not relabel old evidence as Batch 5.

The harness must distinguish:

- baseline single-agent full-context call;
- real ECX plan + automatic selection/hydration + recipient execution + handback;
- final-answer quality;
- E2E latency;
- complete token/cost accounting;
- selected/omitted refs;
- replay/failure evidence.

### 5.3 measured evidence + closure

Batch 5 closes only after accepted measurement evidence exists and exact-head/merged-main/staging gates pass. If only deterministic provider-compatible evidence is available, document that boundary explicitly and do not claim real-model or production economics.

## Explicit non-scope

Do not add:

- multi-recipient/fan-out execution;
- aggregation;
- external A2A;
- learned/model-driven routing;
- large/new ECX UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- a new observability database;
- fresh paid W18 spend merely for recency.

## Resume instructions

Read this checkpoint first. Resume from the exact Batch 5 branch/head, validate 5.1, then continue to 5.2. Do not restart Batches 1–4, branch hygiene, Historical Ledger core, W17, or W18.
