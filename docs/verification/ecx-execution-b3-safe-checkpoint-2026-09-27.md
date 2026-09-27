# ECX Execution — Batch 3 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 3 CLOSED / PASS — SAFE RESUME FOR BATCH 4**

## Purpose

This is the canonical handoff after ECX Execution Batch 3. Future work should resume from this checkpoint instead of re-auditing Batch 1, Batch 2, Batch 3, Historical Ledger core, ECX planning/hydration, selector evidence, or hosted-economics evidence.

## Exact repository identity

```text
Batch 3 base main = f6da77e77724cbb7b4dd6904d3f4dee3d69332d2
implementation PR = #368
reviewed head     = 92f76e547c45c89f01f19159e7e373e101a592a0
merged main       = e784dde4ed891020e3c88712d4e660548a0e04c7
```

The earlier WIP checkpoint remains at [ecx-execution-b3-wip-checkpoint-2026-09-27.md](ecx-execution-b3-wip-checkpoint-2026-09-27.md) as historical evidence only.

## Exact-head gates

```text
CI                              #2304 / run 36305373822 — PASS
Product Eval                    #1543 / run 36305373843 — PASS
MCP External HTTPS Acceptance   #1145 / run 36305373831 — PASS
```

## Merged-main gates

```text
CI                              #2305 / run 36305556854 — PASS
Product Eval                    #1544 / run 36305556853 — PASS
MCP External HTTPS Acceptance   #1146 / run 36305556867 — PASS
```

## Staging delivery

```text
Staging Deploy #1382 / run 36305603057 — gate PASS, deploy skipped
Staging Deploy #1383 / run 36305733935 — gate PASS, deploy job PASS
```

#1383 executed the exact reviewed merged-main SHA and is the runtime delivery evidence for Batch 3.

## What Batch 3 closed

Batch 3 composes a real single-recipient return path above the closed Batch 1/2 execution primitive without creating a second execution authority.

1. Real Agent A -> Agent B -> Agent A handback
   - new `POST /v1/exchange/round-trip`;
   - existing `POST /v1/exchange/execute` remains the child execution primitive;
   - Hub owns orchestration/idempotency/provenance;
   - Connect remains provider/runtime owner.

2. Explicit `responseMode` runtime semantics
   - `delta`: Agent B returns a delegated contribution; Hub treats it as untrusted returned data and performs exactly one governed Agent A continuation through Connect; final reply source is the sender/Agent A;
   - `full`: Agent B is asked for a standalone complete answer and that result is handed directly back to the sender boundary; no second Agent A provider call occurs.

3. Durable round-trip coordination
   - `ecx_round_trip_receipts` stores bounded coordination/idempotency state;
   - state lifecycle remains `STARTED | SUCCEEDED | FAILED | UNCERTAIN`;
   - successful retry replays the durable result;
   - parent continuation uses a one-claim dispatch guard;
   - FAILED/UNCERTAIN parent continuation never auto-redispatches;
   - request identity/fingerprint changes conflict instead of silently reusing the packet.

4. Parent authority and isolation
   - `delta` parent continuation requires the sender/parent runtime binding;
   - parent continuation is authorized against the sender Agent identity and exact local/hosted capability boundary;
   - `full` requires no parent provider dispatch and therefore no second model invocation grant.

5. Bounded result provenance
   - new Historical Ledger vocabulary:
     - `agent.result.returned`;
     - `agent.continuation.started`;
     - `agent.continuation.succeeded`;
     - `agent.continuation.failed`;
     - `agent.continuation.uncertain`;
   - operational result events store bounded route/state metadata plus reply byte length and SHA-256 evidence;
   - full child/final reply text is not copied into those operational provenance events;
   - deterministic event IDs make retry repair/deduplication possible.

6. Workspace-scoped read surface
   - `GET /v1/exchange/round-trips/:packetId?workspaceId=...`;
   - cross-Workspace lookup fails closed as not found.

7. Pending-continuation provenance hardening
   - the one claimed continuation temporarily uses UNCERTAIN as the safe dispatch state;
   - while that continuation is still in-flight, retry does not append a premature immutable `agent.continuation.uncertain` event;
   - only a real ambiguous continuation failure records the UNCERTAIN outcome.

## Architectural boundary

Batch 3 does not change service ownership.

- Hub owns planner/orchestration, runtime binding lookup, capability authorization, execution/round-trip receipts, and Historical Ledger coordination.
- Connect remains the sole provider/runtime dispatch boundary.
- Historical Ledger remains append-only chronology/replay provenance.
- Context and Artifact remain their existing data owners.
- Batch 3 remains single-recipient only.
- The round-trip receipt is not a second event store, message store, or agent memory store.

## Tests and evidence proven

Focused coverage proves:

- `delta` performs child execution then one parent continuation;
- successful `delta` retry replays without re-dispatching either provider call;
- `full` performs only the child provider call and returns its standalone result;
- Workspace-scoped round-trip status lookup;
- one parent continuation dispatch claimant;
- changed round-trip identity/fingerprint conflict;
- child execution still uses the closed Batch 2 primitive;
- bounded Ledger chronology for handback and continuation;
- full reply text is excluded from operational provenance;
- definitive continuation rejection becomes FAILED;
- ambiguous continuation failure becomes UNCERTAIN;
- FAILED/UNCERTAIN continuation never automatically redispatches;
- no fan-out, aggregation, A2A, UI, or retention scope is opened.

Full repository CI, Product Eval, MCP acceptance, merged-main gates, and governed staging deployment all passed as recorded above.

## Explicit non-claims

Batch 3 does **not** implement or prove:

- multi-recipient/fan-out execution;
- parallel recipient dispatch or aggregation;
- external A2A interoperability;
- new ECX operations UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- universal quality, latency, or cost advantage of the complete multi-agent path;
- Batch 4 security/isolation/result-integration closure.

Do not silently attribute these properties to Batch 3.

## Safe resume: Batch 4

The next bounded roadmap slice is:

**Batch 4 — Security, isolation, result integration**

Status at this checkpoint: **NEXT / NOT STARTED**.

Batch 4 should begin from the proven single-recipient Batch 3 handback path and harden how returned results are authorized, isolated, validated, and integrated without weakening existing owner boundaries. Exact implementation scope must be taken from the roadmap/current-state documents at Batch 4 start rather than inferred beyond the accepted title.

Do not open fan-out, external A2A, new UI, long-running Flow/Temporal agent execution, or Historical Ledger retention under Batch 4 unless the Batch 4 scope explicitly authorizes them.

## Resume instructions for another session/agent

Read this file first. Then inspect exact current `main`, Batch 1/2/3 checkpoints, the merged Batch 3 implementation, and the Batch 4 roadmap section needed for the next bounded slice. Do not restart branch hygiene, Historical Ledger core audits, ECX selector/economics validation, or Batches 1–3.
