# ECX Execution — Batch 2 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **HISTORICAL WIP / SUPERSEDED BY FINAL BATCH 2 CLOSURE**

## Resume identity

```text
base main  = 41ddfb37a9359b3541332f7911e90eadc62f11b9
branch     = agent/ecx-execution-idempotency-b2-20260927
contracts  = 9777053c168223778a9dc83cb04996bc8b4d51d9
execution  = 21a7897978c931095e6a999c2f5ba47a7253d950
hardening  = dec7aa310fd67dce997d718679238e4fec785754
tests      = 2f8c63353a35eb5c22ab99459d1684b52effea30
```

This checkpoint was intentionally written before PR gates. It remains historical WIP evidence and is superseded by [ecx-execution-b2-safe-checkpoint-2026-09-27.md](ecx-execution-b2-safe-checkpoint-2026-09-27.md). Do not use this file as the current resume pointer.

## Implemented so far

1. ECX packets now carry optional `historySessionId` when the planner was given one.
2. Shared contracts now define:
   - `STARTED | SUCCEEDED | FAILED | UNCERTAIN`;
   - execution status;
   - execution completion/result fields;
   - Workspace-scoped status lookup.
3. Hub durable state contains `ecx_execution_receipts`.
   - This is a bounded dispatch guard/replay receipt, **not** a second historical event store.
   - It stores minimal request fingerprint, route/status, selected refs, error, and successful result needed for replay.
4. Dispatch semantics:
   - policy + hydration happen before receipt/side-effect dispatch;
   - receipt begins in `STARTED`;
   - compare-and-set `STARTED -> UNCERTAIN` claims the one allowed provider dispatch;
   - only one caller can claim dispatch;
   - `SUCCEEDED` retries replay the durable result without another Connect call;
   - `FAILED` and `UNCERTAIN` retries do not automatically redispatch;
   - same packet with a different accepted request fingerprint conflicts.
5. Failure classification:
   - Connect 4xx -> `FAILED` (definitive reject);
   - transport/5xx/invalid successful response -> `UNCERTAIN` because provider execution may have happened.
6. Historical Ledger lifecycle event types were added:
   - `agent.execution.started`;
   - `agent.execution.succeeded`;
   - `agent.execution.failed`;
   - `agent.execution.uncertain`.
7. Lifecycle event IDs are deterministic by packet + stage, so retry can repair missing provenance without duplicating events.
8. Successful Ledger provenance stores bounded route/model/status metadata, not the full model reply.
9. `GET /v1/exchange/executions/:packetId?workspaceId=...` exposes bounded receipt status.

## Tests added

Focused coverage now targets:

- exactly one dispatch claim;
- changed fingerprint conflict;
- successful result replay without second provider call;
- Workspace-scoped status lookup;
- `handoff -> started -> succeeded` Ledger chain without duplicate events;
- definitive Connect 4xx -> FAILED + no automatic retry;
- ambiguous Connect 5xx -> UNCERTAIN + no automatic retry;
- bounded source-contract checks preserving Batch 2 scope.

## Historical closure follow-up

All closure requirements listed in the original WIP checkpoint were subsequently completed through PR #365 / merge `851d58788075e1f11735b4c23e947edf3304eabe`. Exact-head and merged-main CI/Product Eval/MCP gates passed, and actual Staging Deploy #1362 passed. Current resume pointer: [ecx-execution-b2-safe-checkpoint-2026-09-27.md](ecx-execution-b2-safe-checkpoint-2026-09-27.md).

## Explicit non-scope

Do not add in this batch:

- multi-recipient/fan-out execution;
- result/delta merge into parent agent;
- Agent A -> Agent B -> Agent A product round trip;
- Flow/Temporal long-running execution;
- A2A;
- new UI;
- Historical Ledger retention/compaction/migration.

Those remain Batch 3+ / later work.
