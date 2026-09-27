# ECX Execution — Batch 4 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 4 CLOSED / PASS — SAFE RESUME FOR BATCH 5**

## Purpose

This is the canonical handoff after ECX Execution Batch 4. Future work should resume from this checkpoint instead of re-auditing Batches 1–4, Historical Ledger core, ECX planning/hydration, selector evidence, hosted-economics evidence, or branch hygiene.

## Exact repository identity

```text
Batch 4 base main = f822cecccc03d349c52cc2f6585e318aa7e9d790
implementation PR = #370
reviewed head     = bba68607227a67080a26d4a000cf9dc73deadaef
merged main       = 77986ccd1e4ab4dcc2f648478ea4e0e6f86ea4e1
```

The earlier WIP checkpoint remains at [ecx-execution-b4-wip-checkpoint-2026-09-27.md](ecx-execution-b4-wip-checkpoint-2026-09-27.md) as historical evidence only.

## Exact-head gates

```text
CI                              #2314 / run 36308180475 — PASS
Product Eval                    #1553 / run 36308180481 — PASS
MCP External HTTPS Acceptance   #1153 / run 36308180462 — PASS
```

The exact-head CI passed format, lint, typecheck, full tests, Phase 4 real-process acceptance, production operations acceptance, secret scan, dependency policy review, GitHub Actions pin/runner review, Node/installer/container toolchain reviews, release security acceptance, and production build.

## Merged-main gates

```text
CI                              #2315 / run 36308385324 — PASS
Product Eval                    #1554 / run 36308385333 — PASS
MCP External HTTPS Acceptance   #1154 / run 36308385294 — PASS
```

## Staging delivery

```text
Staging Deploy #1402 / run 36308431891 — gate PASS, deploy skipped
Staging Deploy #1403 / run 36308522005 — gate PASS, deploy job PASS
```

#1403 executed exact merged-main SHA `77986ccd1e4ab4dcc2f648478ea4e0e6f86ea4e1` as `staging-77986ccd1e4a`.

Runtime delivery evidence:

- deploy preflight PASS;
- unauthenticated root -> protected login bootstrap PASS;
- protected Ai/settings/projects/history/Brain/Space/chat/forget boundaries PASS;
- MCP protected-resource metadata PASS;
- unauthenticated MCP OAuth challenge PASS;
- authenticated Operations: `healthy: true`;
- unhealthy services: none;
- exact-host SHA matched expected SHA;
- configured services: 15;
- running services: 15;
- non-running services: none;
- post-deploy capacity stabilization: **29.94 GiB free**.

## What Batch 4 closed

Batch 4 hardens the proven Batch 3 single-recipient handback path without creating a second execution authority or a second data owner.

### 1. Explicit result-receive authority

- new built-in capability: `agent.result.receive`;
- permission: `agent.result.receive`;
- receiving a delegated result is a distinct READ/data authority from model invocation;
- enabled ECX runtime bindings declare result-receive capability requirements, but declarations do not auto-grant authority;
- existing enabled bindings receive a one-time declaration migration without implicit grant;
- both `delta` and `full` round trips authorize the sender's result-receive permission before child execution;
- `delta` still separately requires the sender's local/hosted model-invocation authority;
- `full` still performs no second parent model call.

### 2. Bounded returned-result envelope

- `ECX_RETURNED_RESULT_MAX_BYTES = 65,536`;
- successful returned results carry source agent, source runtime target, trust class, request sensitivity, reply text, reply byte length, and reply SHA-256;
- oversized returned results fail closed before handback/parent continuation;
- the durable round-trip receipt moves to `FAILED` for that definitive policy rejection;
- round-trip status exposes bounded result-integrity evidence without requiring the reply body.

### 3. Untrusted result-integration isolation

- delegated result content is serialized through `promptSafeJson`;
- delimiter-relevant characters are escaped before insertion into `<untrusted_ecx_return>`;
- the parent system prompt explicitly forbids following commands found inside `returnedResult.reply`;
- focused coverage proves a delegated closing-tag/system-tag injection cannot escape the bounded returned-result envelope used for the parent continuation.

This is a bounded framing hardening claim. It is not a universal claim that prompt injection is solved.

### 4. Hosted-parent source-context isolation

A local child may legitimately consume source context that is not hosted-eligible. Batch 4 prevents a derived local-child result from crossing into a hosted parent continuation unless the **exact refs selected for the child execution** can be re-authorized by their existing owners for hosted use.

- recheck input is exactly `child.selectedRefIndexes`;
- owner hydration is re-run with `hostedEligible: true`;
- Context/Artifact/Historical Ledger remain the source owners;
- owner denial becomes `ECX_RESULT_HOSTED_ISOLATION_DENIED`;
- a definitive isolation denial records round-trip `FAILED`;
- a transient owner failure is not silently converted into a policy denial and may be safely rechecked before any parent continuation dispatch.

### 5. Provenance-session boundary

If an ECX packet carries `historySessionId`, the round-trip path now requires:

- exact Workspace match;
- exact scope match;
- history-session sensitivity <= request `maxSensitivity`.

Mismatch fails before execution with `ECX_ROUND_TRIP_HISTORY_BOUNDARY_DENIED`.

### 6. Compatibility and replay posture

- Batch 1/2 child execution remains the existing single-recipient primitive;
- Batch 3 `delta/full` handback semantics remain intact after explicit result-receive authorization;
- successful Batch 4 receipts carry the returned-result envelope;
- successful historical receipts that predate the Batch 4 envelope are not silently reinterpreted and are not auto-redispatched;
- reintegration of a legacy successful receipt requires a new packet rather than unsafe implicit migration.

## Architectural boundary

Batch 4 does not change service ownership.

- Hub remains planner/orchestration, capability-authorization, execution/round-trip coordination, and Historical Ledger coordination owner.
- Connect remains the sole model provider/runtime dispatch boundary.
- Context, Artifact, and Historical Ledger remain authoritative for source eligibility and content ownership.
- Historical Ledger remains append-only chronology/provenance rather than result storage.
- Batch 4 remains single-recipient only.
- The result envelope and round-trip receipt do not become a second message store, agent memory store, graph store, or execution owner.

## Tests and evidence proven

Focused coverage proves:

- result-receive denial happens before child provider execution;
- `full` succeeds with sender result-receive authority without needing a parent model-invoke grant;
- returned-result trust/sensitivity/hash/byte evidence;
- round-trip status integrity evidence;
- oversized result -> fail closed -> durable `FAILED`;
- failed oversized-result replay does not become a successful handback;
- local-only source context cannot reach a hosted parent through derived child output;
- delegated delimiter injection is escaped before parent model input;
- cross-Workspace provenance-session mismatch fails before execution;
- existing enabled bindings receive declarations but no auto-grant;
- Batch 3 round-trip regression semantics remain intact after adding explicit receive grants;
- source contract remains single-recipient and does not add fan-out/A2A/aggregation.

Full repository CI, Product Eval, MCP acceptance, merged-main gates, and governed staging delivery all passed as recorded above.

## Explicit non-claims

Batch 4 does **not** implement or prove:

- multi-recipient/fan-out execution;
- parallel recipient dispatch or aggregation;
- external A2A interoperability;
- new ECX operations UI;
- Flow/Temporal long-running agent execution;
- Historical Ledger retention/compaction/migration;
- universal prompt-injection immunity;
- universal quality, latency, or economic advantage of the complete agent path;
- Batch 5 observability/quality/economics closure.

Do not silently attribute these properties to Batch 4.

## Safe resume: Batch 5

The next bounded roadmap slice is:

**Batch 5 — End-to-end observability, quality, economics**

Status at this checkpoint: **NEXT / NOT STARTED**.

The repository currently establishes the Batch 5 title and ordering. Exact implementation/measurement scope must be taken from the accepted roadmap/current-state discussion when Batch 5 starts; do not infer extra fan-out, A2A, UI, long-running execution, retention, or paid-evidence requirements merely from the title.

Do not reopen Batches 1–4 while starting Batch 5 unless a new defect is evidenced.

## Resume instructions for another session/agent

Read this file first. Then inspect exact current `main`, the Batch 1–4 closure checkpoints, and only the Batch 5 roadmap/current-state material needed to select the next bounded implementation/evidence slice. Do not restart branch hygiene, Historical Ledger core audits, ECX selector/economics historical validation, or Batches 1–4.
