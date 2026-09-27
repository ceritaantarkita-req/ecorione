# ECX Execution — Batch 7 WIP Checkpoint

Date: **2026-09-27**

Status: **BATCH 7 ACTIVE — BOUNDED IMPLEMENTATION IN PROGRESS**

## Purpose

Batch 7 productizes the already-proven ECX recipient-execution primitives into one bounded multi-recipient execution path. It does not reopen Batches 1–6.

Canonical base:

```text
main/base = bc95793406eee901714137aa286cc9adcfcc799e
branch    = agent/ecx-execution-b7-20260927
```

## Accepted Batch 7 boundary

**Batch 7 — Advanced execution/productization** means, for this slice:

1. accept one coherent deterministic ECX plan containing **2–8 distinct recipient packets**;
2. support **`delta` mode only** for fan-out aggregation;
3. execute child recipients through the existing Batch 2 execution primitive, preserving each packet's durable receipt, one-claim dispatch, replay, authority, hydration, and failure semantics;
4. allow bounded concurrent child dispatch, while keeping all recipient identities/results deterministic in request order;
5. validate every returned child result through the existing Batch 4 size/hash/trust/sensitivity boundary;
6. re-run owner-backed hosted-eligibility isolation for every contributing child before any local-derived result reaches a hosted parent;
7. require explicit sender `agent.result.receive` authority and normal parent model-execution authority;
8. aggregate all successful child deltas into **one** escaped untrusted return context and invoke the sender/parent **exactly once**;
9. add a durable fan-out receipt keyed by a deterministic fan-out identity so completed fan-out requests replay without child or parent redispatch;
10. expose Workspace-scoped fan-out status;
11. append bounded Historical Ledger provenance for the aggregate return and one parent-continuation lifecycle, without storing full child replies in Ledger payloads;
12. add deterministic focused tests and source-contract coverage before full repository gates.

## Coherence rules

All packets in one fan-out request must share:

- version;
- operationId;
- sender;
- intent;
- task;
- need;
- refs;
- budget;
- `responseMode = delta`;
- optional historySessionId.

Each packet must have a unique packetId and unique recipient. Request order is canonical result order.

## Failure and retry semantics

- Child execution remains owned by the existing per-packet receipt.
- A successful child can replay during fan-out recovery without a second Connect dispatch.
- A FAILED/UNCERTAIN child remains fail-closed under the existing Batch 2 rules.
- Parent aggregation is not attempted until every child has a validated successful result.
- The fan-out parent continuation has its own one-claim durable dispatch guard.
- A completed fan-out receipt replays the durable aggregate response without redispatch.
- A claimed-but-unsettled parent continuation is UNCERTAIN and cannot be automatically redispatched.

## Result-size boundary

Each child keeps the existing `ECX_RETURNED_RESULT_MAX_BYTES` limit. Batch 7 additionally caps the combined child reply bytes admitted into the parent aggregation prompt. The implementation must reject an oversized aggregate before parent dispatch.

## Historical Ledger boundary

Batch 7 reuses existing event types:

- child execution lifecycle stays per packet;
- one aggregate `agent.result.returned` event records fan-out identity, contributing packet IDs/recipients, bounded reply evidence, and aggregate byte/hash evidence;
- one `agent.continuation.started` + terminal continuation event records the single parent aggregation lifecycle.

No new Ledger owner, event store, or analytics store is introduced.

## Explicit non-goals

Batch 7 does **not** implement or prove:

- external A2A interoperability;
- arbitrary recursive agent graphs;
- Flow/Temporal long-running fan-out orchestration;
- `full` multi-recipient merge semantics;
- broadcast/default fan-out;
- a new ECX/History product UI;
- automatic Historical Ledger purge scheduling;
- Batch 5 telemetry retention redesign;
- paid-provider/W18 reruns;
- DR-2, production cutover, or unrelated staging/infra scope;
- universal quality, latency, or savings claims.

## Closure requirements

Batch 7 is not CLOSED until:

1. focused fan-out success/replay/failure/security tests pass;
2. exact-head repository gates pass;
3. implementation PR merges from the reviewed exact head;
4. merged-main gates pass;
5. governed staging deploy proves the exact merged SHA with existing public/auth/MCP/Ops/service-health checks;
6. final closure docs replace this WIP checkpoint as the canonical resume pointer.
