# ECX Execution — Batch 7 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 7 CLOSED / PASS — ECX RECIPIENT EXECUTION ROADMAP CLOSED**

## Purpose

This is the canonical handoff after ECX Execution Batch 7. Future work should resume from this checkpoint instead of re-auditing Batches 1–7, Historical Ledger compaction, ECX single-recipient execution, round-trip security, observability/economics, or branch hygiene.

## Exact repository identity

```text
Batch 7 base main = bc95793406eee901714137aa286cc9adcfcc799e
canonical PR      = #376
reviewed head     = 198b46fa0eeb679dc7bfee78492f4c8739a7ed99
merged main       = e49af9225194d36e2ed8cbefeb7b4cf5c09dc485
```

The earlier WIP checkpoint remains at [ecx-execution-b7-wip-checkpoint-2026-09-27.md](ecx-execution-b7-wip-checkpoint-2026-09-27.md) as historical evidence only.

## Exact-head gates

```text
CI            #2349 / run 36331494582 — PASS
Product Eval  #1588 / run 36331494591 — PASS
MCP           #1175 / run 36331494599 — PASS
```

## Merged-main gates

```text
CI            #2350 / run 36331780408 — PASS
Product Eval  #1589 / run 36331780378 — PASS
MCP           #1176 / run 36331780377 — PASS
```

## Staging delivery

```text
Staging Deploy #1470 / run 36331845042 — gate PASS, deploy skipped
Staging Deploy #1471 / run 36332010531 — gate PASS, deploy job PASS
```

#1471 deployed exact merged-main SHA `e49af9225194d36e2ed8cbefeb7b4cf5c09dc485` as `staging-e49af9225194`.

Runtime delivery evidence:

- deploy preflight PASS;
- public auth bootstrap redirect PASS;
- protected login/ops/settings/projects/history/Brain/Space/chat/forget boundaries PASS;
- MCP protected-resource metadata PASS;
- MCP unauthenticated OAuth challenge PASS;
- authenticated Operations: `healthy: true`;
- unhealthy services: none;
- exact host SHA matched expected SHA;
- configured services: 15;
- running services: 15;
- non-running services: none;
- post-deploy capacity stabilization: **27.68 GiB free**.

## What Batch 7 closed

Batch 7 productizes the previously proven single-recipient ECX execution path into one bounded multi-recipient aggregation primitive without changing service ownership.

### 1. Coherent bounded fan-out

The fan-out route accepts one coherent deterministic plan containing **2–8 distinct recipient packets** and deliberately supports **`delta` mode only**.

All packets must share the same operation, sender, intent, task, need, refs, budget, response mode, and optional Historical Ledger session. Packet IDs and recipients must be unique. Request order remains canonical result order.

There is still no default broadcast: the pre-existing planner's deterministic recipient selection and `maxRecipients` boundary remain authoritative.

### 2. Existing child execution semantics are reused

Each child executes through the existing Batch 2 recipient-execution primitive.

That preserves, per child:

- durable execution receipt;
- request-fingerprint conflict detection;
- one-claim Connect dispatch;
- success replay without redispatch;
- FAILED/UNCERTAIN fail-closed retry semantics;
- explicit agent execution authority;
- bounded hydration and selection;
- deterministic execution lifecycle provenance.

Child dispatch may run concurrently, but its durable ownership remains per packet.

### 3. Batch 4 result/security boundary applies to every child

Every child reply is converted into the existing returned-result envelope with:

- source agent/target;
- trust classification;
- sensitivity;
- reply byte count;
- SHA-256 evidence;
- the existing **65,536-byte per-child limit**.

If the parent is hosted, every local child's exact selected source references are re-checked through the owner-backed hosted-eligibility path before the result may contribute to the parent prompt.

The sender still requires explicit `agent.result.receive` authority, and the parent continuation still requires normal model-execution authority.

### 4. One bounded parent aggregation

Batch 7 does not create N parent continuations.

After all child results succeed and pass result/isolation validation, the runtime:

1. deterministically orders returned results;
2. computes aggregate evidence;
3. rejects aggregate reply material above **131,072 bytes**;
4. escapes the aggregate into one untrusted result-set frame;
5. invokes the sender/parent exactly once;
6. records one durable fan-out result.

The parent is instructed to treat delegated content as untrusted evidence, not instructions.

### 5. Durable fan-out receipt and replay

Hub owns a dedicated bounded fan-out receipt keyed by deterministic fan-out identity.

It preserves:

- Workspace-scoped lookup;
- request fingerprint conflict protection;
- one-claim parent-continuation dispatch;
- successful aggregate replay without child or parent redispatch;
- FAILED/UNCERTAIN fail-closed behavior;
- durable final response for completed fan-out.

This receipt is a dispatch/idempotency guard, not a second Historical Ledger or analytics store.

### 6. Historical Ledger provenance stays bounded

Existing event types are reused.

Child execution lifecycle remains per packet. Fan-out adds only bounded aggregate-return and one parent-continuation lifecycle, including packet/recipient identity and byte/hash evidence rather than full child reply payloads.

Historical Ledger remains the chronological/replay evidence owner and keeps the Batch 6 archive/compaction guarantees unchanged.

## Tests and evidence proven

Coverage includes:

- bounded 2-recipient fan-out success;
- deterministic child result ordering;
- one parent aggregation continuation;
- success replay without child or parent redispatch;
- Workspace-scoped fan-out status;
- fan-out receipt conflict protection;
- child failure/uncertain fail-closed composition;
- explicit result-receive and parent execution authority;
- hosted-parent isolation per contributing local child;
- per-child returned-result size/hash evidence;
- aggregate **131,072-byte** rejection before parent dispatch;
- aggregate result-set hash evidence;
- bounded Ledger aggregate-return/continuation provenance;
- regression/source-contract checks preserving Batch 1–6 ownership boundaries;
- full repository CI/Product Eval/MCP gates and exact-SHA staging delivery.

## Architectural boundary

Batch 7 does not change service ownership.

- Hub remains ECX planner/execution coordination and receipt owner.
- Connect remains provider/runtime invocation owner.
- Historical Ledger remains durable chronological/replay evidence.
- Context/Artifact remain source authorization/content owners.
- No new service or external agent protocol is introduced.

## Explicit non-claims

Batch 7 does **not** implement or prove:

- external A2A interoperability;
- arbitrary recursive agent graphs;
- Flow/Temporal long-running fan-out orchestration;
- `full` multi-recipient merge semantics;
- default broadcast;
- a broad new ECX/History product UI;
- automatic Historical Ledger purge scheduling;
- Batch 5 telemetry retention redesign;
- paid-provider/W18 freshness;
- universal quality, latency, or savings advantages;
- DR-2 physical independence;
- production promotion/cutover.

Do not silently attribute these properties to Batch 7.

## Roadmap closure

The bounded **ECX Recipient Execution Batch 1–7 roadmap is CLOSED / PASS** at its documented boundaries.

There is **no implicit Batch 8**.

A future implementation slice must be explicitly authorized and named. Do not reopen Batches 1–7 merely to pursue external A2A, recursive orchestration, Flow/Temporal execution, UI expansion, paid-provider work, DR-2, or production cutover.

## Resume instructions for another session/agent

Read this file first. Then inspect exact current `main` and only the new explicitly authorized scope.

Do not restart:

- ECX Batches 1–7;
- Historical Ledger core/compaction audits;
- W17/W18 historical evidence work;
- branch hygiene;
- closed A-series/PCS work.

Treat the closed Batch 1–7 contracts as the compatibility baseline unless a future explicit decision changes them.
