# ECX Recipient Execution — Batch 1 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 1 CLOSED / PASS — SAFE RESUME FOR BATCH 2**

## Purpose

This document is the canonical handoff after ECX Recipient Execution Batch 1. Resume future work from this checkpoint instead of re-auditing Historical Ledger, ECX planning/hydration, W17 selector evidence, W18 hosted economics, or the already merged Batch 1 implementation.

## Exact repository identity

```text
baseline before Batch 1 = 7f046cc2e04672073c829ae115d1aa51fdba0851
PR                      = #363
reviewed head           = b82214a4487b4ed9e7c82ff7dadb507c0a08ae37
merged main             = 82e9b4b887157b08abfdf04bc2793550e86d1b3e
```

The temporary formatter-diff commit used while repairing style did not survive as a net `package.json` change. The merged diff contains only the intended ECX/shared-schema/Hub/test changes.

## Exact-head gates

```text
CI                              #2286 / run 36297796782 — PASS
Product Eval                    #1525 / run 36297796764 — PASS
MCP External HTTPS Acceptance   #1131 / run 36297796778 — PASS
```

## Merged-main gates

```text
CI                              #2287 / run 36298026136 — PASS
Product Eval                    #1526 / run 36298026018 — PASS
MCP External HTTPS Acceptance   #1132 / run 36298026103 — PASS
```

Staging delivery:

```text
Staging Deploy #1345 / run 36298074944 — gate PASS, deploy skipped
Staging Deploy #1346 / run 36298278228 — gate PASS, deploy job PASS
```

## What Batch 1 added

Batch 1 established the first real recipient-execution foundation without creating a new service or parallel execution authority:

1. `agent` is now a first-class capability-authority subject kind.
2. Shared ECX contracts now define:
   - runtime target: `local | hosted`;
   - durable agent-binding request/view schemas;
   - execution request/response schemas.
3. Hub durable state now contains `ecx_agent_bindings`, keyed by Workspace + agent ID.
4. `EcxAgentRegistry` owns binding persistence and lookup in Hub.
5. Binding synchronization creates exact agent authority declarations for:
   - `model.invoke.local`; or
   - `model.invoke.hosted`.
6. Existing authority grants remain explicit. Registering/binding an agent does not itself grant execution.
7. Hub now exposes:
   - `GET /v1/exchange/agents?workspaceId=...`;
   - `PUT /v1/exchange/agents/:agentId`;
   - `POST /v1/exchange/execute`.
8. `/v1/exchange/execute`:
   - resolves the exact Workspace-scoped recipient binding;
   - requires the binding to be enabled;
   - checks capability overlap between packet `need` and binding capabilities;
   - requests exact Hub capability authorization;
   - derives `hostedEligible` from the binding target, never from caller preference;
   - reuses ECX hydration and owner authorization boundaries;
   - wraps hydrated material as untrusted ECX reference data;
   - dispatches through existing Connect `/v1/complete`.
9. Connect remains provider/runtime owner. Hub remains ECX/policy/authority owner.

## Security and privacy boundary proven in Batch 1

Focused coverage proves:

- execution fails closed before the recipient has explicit agent authority grant;
- a granted local recipient can execute through Connect;
- a hosted recipient cannot use ECX execution to hydrate `LOCAL_ONLY` Historical Ledger content;
- hosted/local eligibility is binding-derived rather than caller-controlled;
- no provider/runtime engine was duplicated inside Hub.

## Files changed by merged Batch 1

```text
packages/shared-schema/src/capabilities.ts
packages/shared-schema/src/ecx.ts
services/hub/src/capability-registry.ts
services/hub/src/db.ts
services/hub/src/ecx-agent-registry.ts
services/hub/src/exchange-http.ts
services/hub/src/exchange-http.test.ts
services/hub/src/http.ts
test/ecx-recipient-execution-foundation-source-contract.test.ts
```

## Explicit non-claims / not implemented yet

Batch 1 does **not** implement or prove:

- durable execution idempotency receipts;
- duplicate provider-call prevention across retries;
- `started / succeeded / failed / uncertain` execution lifecycle;
- Historical Ledger execution lifecycle/result provenance;
- result replay contract;
- `delta` versus `full` result semantics beyond existing packet metadata;
- Agent A -> Agent B -> Agent A end-to-end round trip;
- multi-recipient execution, fan-out, parallel dispatch, or aggregation;
- Flow/Temporal long-running recipient execution;
- A2A external interoperability;
- Historical Ledger retention/compaction/migration;
- universal cost, latency, or quality savings for full recipient execution.

Do not silently attribute any of those properties to Batch 1.

## Safe resume: Batch 2

The next bounded scope is:

**Batch 2 — Execution Contract + Idempotency + Provenance**

Start only from synchronized `main` at or after the merged Batch 1 commit above.

Batch 2 should address, in order:

1. define durable execution identity/status/result contract around `packetId` + `operationId`;
2. prevent duplicate model/provider dispatch for identical accepted execution;
3. distinguish safe retry from uncertain/provider-already-dispatched state;
4. record execution lifecycle/result provenance without creating a parallel execution-truth database;
5. integrate Historical Ledger only for chronological/replay evidence;
6. add focused crash/retry/duplicate/failure tests;
7. close with exact-head gates, merged-main gates, and a new safe checkpoint.

Do **not** open multi-recipient execution, A2A, UI, or Ledger retention in Batch 2.

## Resume command for a future agent/session

Read this file first, then inspect only the Batch 1 merged implementation paths listed above plus the current exact `main`. Do not restart branch-hygiene work and do not rerun Historical Ledger/ECX selector/economics audits unless new evidence specifically requires it.
