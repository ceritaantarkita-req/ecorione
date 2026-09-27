# ECX Execution — Batch 3 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **ACTIVE / SAFE WIP — NOT CLOSED**

## Resume identity

```text
base main   = f6da77e77724cbb7b4dd6904d3f4dee3d69332d2
branch      = agent/ecx-round-trip-b3-20260927
contracts   = 560208e2b7d3c96d6186367473c723a5c4c24e8b
runtime     = 2ac2c131d7aa6bc9080e40e56733176711cfe659
hardening   = c555742e7ef2504bac1f97bc931c88c69d7c8fe1
tests       = 669cd507a2f35b644fe22a3e4c78b57ec0849320
pending-fix = d2d91fd96c01de026c5e496d6a0f4b9fc82814ff
format      = 2f778ba1215d75367d9ba7246896c3024ad19c3f
```

This checkpoint is a safe resume pointer before CI/PR closure. It is **not** a PASS claim.

The latest hardening also suppresses a premature `agent.continuation.uncertain` Ledger outcome while the one claimed parent continuation is still in-flight; only a real ambiguous failure records the immutable UNCERTAIN outcome.

## Batch 3 contract

Batch 3 stays single-recipient and composes above the closed Batch 1/2 primitive.

### `responseMode: delta`

1. Agent B executes through the existing Batch 2 `executeRecipient` path.
2. Agent B is instructed to return only the delegated contribution, not impersonate the sender's final answer.
3. Hub records a durable round-trip receipt.
4. Hub returns the child result to the sender boundary as untrusted delegated data.
5. Hub performs exactly one governed parent Agent A continuation through Connect.
6. The final reply comes from Agent A.
7. Retry after success replays the durable round-trip result without a second child or parent provider dispatch.
8. FAILED/UNCERTAIN parent continuation never auto-redispatches.

### `responseMode: full`

1. Agent B executes through the same Batch 2 path.
2. Agent B is instructed to produce a standalone complete answer.
3. Hub records the same bounded round-trip receipt.
4. The standalone child result is returned directly to the sender/parent boundary.
5. No second Agent A provider call is made.
6. Retry after success replays the durable result.

## Durable state

`ecx_round_trip_receipts` stores only bounded round-trip coordination/idempotency state:

- packet/operation/continuation identity;
- Workspace + sender + recipient;
- response mode and parent route;
- request fingerprint;
- `STARTED | SUCCEEDED | FAILED | UNCERTAIN`;
- error;
- successful result needed for replay;
- timestamps.

It is **not** a second Historical Ledger or agent message store.

## Provenance

New typed Historical Ledger events:

- `agent.result.returned`;
- `agent.continuation.started`;
- `agent.continuation.succeeded`;
- `agent.continuation.failed`;
- `agent.continuation.uncertain`.

Ledger payloads store bounded route/state metadata plus reply byte length + SHA-256 only. Full child/final reply text is not copied into these operational provenance events.

## Routes

- existing `POST /v1/exchange/execute` remains the Batch 2 primitive;
- new `POST /v1/exchange/round-trip`;
- new `GET /v1/exchange/round-trips/:packetId?workspaceId=...`.

## Tests added

Focused tests cover:

- delta child -> parent continuation -> replay with no redispatch;
- full one-provider-call direct handback;
- Workspace-scoped round-trip status;
- bounded Ledger chronology without duplicate retry events;
- ambiguous parent continuation -> UNCERTAIN + no auto-redispatch;
- one continuation dispatch claim;
- changed receipt fingerprint conflict;
- source-contract preservation of Batch 2 while Batch 3 composes above it;
- no fan-out/aggregation/A2A/UI/retention expansion.

## Still required before closure

1. open PR from this branch;
2. run format/lint/typecheck/full tests;
3. fix any compile/test defects on this same branch;
4. pass Product Eval and any other triggered exact-head gates;
5. merge only after exact-head green;
6. verify merged-main gates;
7. verify governed staging delivery;
8. replace ACTIVE/WIP current docs with CLOSED/PASS;
9. write final Batch 3 checkpoint.

## Explicit non-scope

Do not add in Batch 3:

- multi-recipient/fan-out execution;
- parallel aggregation;
- external A2A interoperability;
- new ECX UI;
- Flow/Temporal long-running execution;
- Historical Ledger retention/compaction/migration;
- universal quality/latency/cost claims.

Future Batch 4+ remains separate.
