# ECX Execution — Batch 2 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 2 CLOSED / PASS — SAFE RESUME FOR BATCH 3**

## Purpose

This is the canonical handoff after ECX Execution Batch 2. Future work should resume from this checkpoint instead of re-auditing Batch 1, Batch 2, Historical Ledger core, ECX planning/hydration, selector evidence, or hosted-economics evidence.

## Exact repository identity

```text
Batch 2 base main = 41ddfb37a9359b3541332f7911e90eadc62f11b9
implementation PR = #365
reviewed head     = 890030465570826eaca9c21f27aa13b0eb821e76
merged main       = 851d58788075e1f11735b4c23e947edf3304eabe
```

The earlier WIP checkpoint is preserved at [ecx-execution-b2-wip-checkpoint-2026-09-27.md](ecx-execution-b2-wip-checkpoint-2026-09-27.md) as historical evidence only.

A later duplicate draft PR #366 was opened after #365 had already merged. It was closed unmerged and introduced no additional code or product state.

## Exact-head gates

```text
CI                              #2294 / run 36300957801 — PASS
Product Eval                    #1533 / run 36300957808 — PASS
MCP External HTTPS Acceptance   #1137 / run 36300957751 — PASS
```

## Merged-main gates

```text
CI                              #2295 / run 36301207265 — PASS
Product Eval                    #1534 / run 36301207293 — PASS
MCP External HTTPS Acceptance   #1138 / run 36301207284 — PASS
```

## Staging delivery

```text
Staging Deploy #1361 / run 36301260994 — gate PASS, deploy skipped
Staging Deploy #1362 / run 36301408172 — gate PASS, deploy job PASS
```

#1362 executed the exact reviewed merged-main SHA and is the runtime delivery evidence for Batch 2.

## What Batch 2 closed

Batch 2 adds a bounded execution identity/idempotency/provenance layer around the single-recipient ECX execution path created in Batch 1.

1. ECX packet/history linkage
   - packets preserve optional `historySessionId` when planning was history-bound;
   - deterministic packet identity remains intact.

2. Durable execution contract
   - states: `STARTED | SUCCEEDED | FAILED | UNCERTAIN`;
   - Workspace-scoped bounded execution status lookup;
   - completion/result contract is persisted only as needed for successful replay.

3. Dispatch guard / idempotency receipt
   - `ecx_execution_receipts` is keyed by packet identity;
   - same packet + changed accepted request fingerprint conflicts;
   - policy + hydration complete before the provider-side-effect receipt is claimed;
   - compare-and-set `STARTED -> UNCERTAIN` grants only one dispatch claimant;
   - concurrent/retry callers cannot silently issue a second provider call.

4. Replay semantics
   - `SUCCEEDED` retry returns the durable successful response;
   - replay does not call Connect/provider again;
   - `FAILED` and `UNCERTAIN` do not auto-dispatch again;
   - deliberate retry after those states requires a new packet/operation identity.

5. Failure semantics
   - definitive Connect 4xx rejection becomes `FAILED`;
   - transport failure, Connect 5xx, or invalid successful response is conservatively `UNCERTAIN`;
   - UNCERTAIN means provider execution may already have occurred, so duplicate side effects are blocked.

6. Historical Ledger provenance
   - added `agent.execution.started`;
   - added `agent.execution.succeeded`;
   - added `agent.execution.failed`;
   - added `agent.execution.uncertain`;
   - lifecycle event IDs are deterministic by packet + stage;
   - retries can repair missing provenance without duplicating events;
   - successful Ledger events contain bounded route/model/status metadata, not the full model reply.

7. Read surface
   - `GET /v1/exchange/executions/:packetId?workspaceId=...` returns the bounded receipt status;
   - cross-Workspace lookup fails closed as not found.

## Architectural boundary

The receipt table is **not** a second Historical Ledger and is **not** a second provider/runtime authority.

- Hub owns execution coordination, capability authorization, receipt/idempotency semantics, and ECX orchestration.
- Connect remains provider/runtime owner.
- Historical Ledger remains append-only chronological/replay provenance.
- Context/Artifact authorization boundaries remain unchanged.
- Batch 2 remains single-recipient only.

## Tests and evidence proven

Focused tests cover:

- one dispatch claimant only;
- changed request fingerprint conflict;
- successful replay without a second Connect call;
- Workspace-scoped execution status;
- `agent.handoff -> agent.execution.started -> agent.execution.succeeded` chronology;
- deterministic lifecycle IDs without duplicate retry events;
- Connect 4xx -> FAILED and no automatic retry;
- Connect 5xx/ambiguous failure -> UNCERTAIN and no automatic retry;
- source-contract preservation of the Batch 2 scope boundary.

Full repository CI, Product Eval, MCP acceptance, merged-main gates, and governed staging deployment all passed as recorded above.

## Explicit non-claims

Batch 2 does **not** implement or prove:

- multi-recipient/fan-out execution;
- parallel recipient dispatch or aggregation;
- runtime meaning/merge behavior for parent-facing `delta` versus `full`;
- Agent A receiving and continuing from Agent B result;
- full Agent A -> Agent B -> Agent A product round trip;
- Flow/Temporal long-running recipient execution;
- A2A external interoperability;
- new ECX operations UI;
- Historical Ledger retention/compaction/migration;
- universal latency, quality, or cost advantage for the complete agent-to-agent execution path.

Do not silently attribute these properties to Batch 2.

## Safe resume: Batch 3

The next bounded roadmap slice is:

**Batch 3 — Real Agent A -> Agent B round trip**

Status at this checkpoint: **NEXT / NOT STARTED**.

Batch 3 should stay single-recipient and prove the first real round trip:

1. define the caller/parent result-return contract;
2. give `responseMode: delta | full` explicit runtime semantics;
3. execute Agent A -> ECX -> Agent B using the Batch 1/2 governed path;
4. return Agent B result to Agent A/parent without bypassing existing owner boundaries;
5. record/replay bounded result provenance;
6. prove a real local end-to-end round trip;
7. preserve Batch 2 duplicate-dispatch guarantees;
8. close with focused tests, exact-head gates, merged-main gates, staging evidence, and a new checkpoint.

Do **not** open multi-recipient fan-out, A2A, UI expansion, or Ledger retention under Batch 3 unless separately authorized.

## Resume instructions for another session/agent

Read this file first. Then inspect only the current exact `main`, Batch 1 checkpoint, Batch 2 merged implementation paths, and tests needed for Batch 3. Do not restart branch hygiene, Historical Ledger core audits, ECX selector/economics validation, Batch 1, or Batch 2.
