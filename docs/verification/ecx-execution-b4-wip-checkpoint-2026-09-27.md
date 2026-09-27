# ECX Execution — Batch 4 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **ACTIVE / SAFE WIP — NOT CLOSED**

## Resume identity

```text
base main   = f822cecccc03d349c52cc2f6585e318aa7e9d790
branch      = agent/ecx-security-integration-b4-20260927
contracts   = 6322190f02a80a03c6881c2daea9580c93903a71
runtime     = b21c192c29150807508c6bd362947ba609809ae4
hardening   = c62defb5df2ef4579634af7cbecaeef2f6dd164f
tests       = ee8b798c95bb40894274df0013e0fe221a6280eb
```

This checkpoint is a safe resume pointer before CI/PR closure. It is **not** a PASS claim.

## Batch 4 bounded contract

Batch 4 hardens the closed Batch 3 single-recipient round-trip path only.

### 1. Explicit result-receive authority

- new built-in capability: `agent.result.receive`;
- permission: `agent.result.receive`;
- result receipt is a READ/data authority, separate from model invocation;
- enabled ECX agent bindings declare this capability, but declaration does **not** auto-grant it;
- existing enabled bindings receive a one-time declaration migration only;
- both `delta` and `full` round trips require sender result-receive authorization **before** child execution;
- `delta` still additionally requires the sender's local/hosted model invocation authority;
- `full` does not require a parent model invocation grant because no second parent provider call occurs.

### 2. Bounded returned-result envelope

- `ECX_RETURNED_RESULT_MAX_BYTES = 65,536`;
- returned result records:
  - source agent;
  - source target;
  - trust = `LOCAL_AGENT | HOSTED_AGENT`;
  - request sensitivity;
  - reply;
  - reply byte length;
  - SHA-256 of the reply;
- oversized results fail closed before handback/continuation and the round-trip receipt becomes `FAILED`;
- round-trip status exposes bounded integrity evidence without requiring result content.

### 3. Untrusted result isolation

- delegated result content is serialized through `promptSafeJson`;
- XML-like delimiter characters are escaped before insertion into `<untrusted_ecx_return>`;
- the parent system prompt explicitly forbids following commands inside `returnedResult.reply`;
- Batch 4 does not claim that prompt injection is universally solved; it proves a stronger bounded framing boundary for this path.

### 4. Hosted-parent source-context isolation

A local child may hydrate `LOCAL_ONLY` context. Batch 4 prevents a derived child result from being forwarded into a hosted parent continuation unless the **exact selected child refs** can be re-hydrated through existing owner boundaries with `hostedEligible: true`.

- exact `child.selectedRefIndexes` are rechecked;
- no new source owner or cross-service database read is introduced;
- owner denial becomes `ECX_RESULT_HOSTED_ISOLATION_DENIED` and the round-trip receipt becomes `FAILED`;
- transient upstream-owner failure remains safe to recheck because no parent continuation has been dispatched.

### 5. Provenance-session isolation

If the packet carries `historySessionId`, the round-trip path requires:

- exact Workspace match;
- exact scope match;
- session sensitivity <= request `maxSensitivity`.

Mismatch fails before execution with `ECX_ROUND_TRIP_HISTORY_BOUNDARY_DENIED`.

## Compatibility / replay posture

- Batch 1/2 child execution remains the same single-recipient primitive;
- Batch 3 `delta/full` semantics remain unchanged after required receive authorization;
- successful Batch 4 receipts carry the new returned-result envelope;
- legacy successful round-trip receipts without the Batch 4 envelope are not silently reinterpreted or re-dispatched; they fail with `ECX_ROUND_TRIP_LEGACY_RESULT_POLICY` and require a new packet if reintegration is needed.

## Tests added/updated

Focused tests cover:

- receive-authority denial before child provider execution;
- `full` success with result-receive grant but no parent model grant;
- returned-result trust/sensitivity/hash/byte evidence;
- status-level integrity evidence;
- oversized result -> FAILED and no successful replay;
- local-only source -> hosted parent denial before parent dispatch;
- delegated delimiter injection escaping before parent model input;
- cross-Workspace provenance-session rejection;
- declaration migration for existing enabled agent bindings without auto-grant;
- Batch 3 regression tests updated only to add explicit parent result-receive grants;
- source-contract preservation of single-recipient scope.

## Still required before closure

1. open PR from this branch;
2. run format/lint/typecheck/full tests;
3. fix compile/test defects on this same branch;
4. pass Product Eval and other exact-head gates;
5. merge only after exact-head green;
6. verify merged-main gates;
7. verify governed staging delivery;
8. replace ACTIVE/WIP docs with CLOSED/PASS;
9. write final Batch 4 safe checkpoint;
10. advance roadmap to Batch 5 only after Batch 4 closure.

## Explicit non-scope

Do not add in Batch 4:

- multi-recipient/fan-out execution;
- parallel aggregation;
- external A2A interoperability;
- new ECX UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- universal quality/latency/cost claims.

Future Batch 5+ remains separate.
