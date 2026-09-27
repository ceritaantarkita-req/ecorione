# ECX Execution — Batch 6 Safe Checkpoint

Date: **2026-09-27**

Status: **BATCH 6 CLOSED / PASS — SAFE RESUME FOR BATCH 7**

## Purpose

This is the canonical handoff after ECX Execution Batch 6. Future work should resume from this checkpoint instead of re-auditing Batches 1–6, Historical Ledger core, ECX planning/hydration, historical W17/W18 evidence, or branch hygiene.

## Exact repository identity

```text
Batch 6 base main = 874522e4322699c05d422209681b77ef0102a7a7
canonical PR      = #374
reviewed head     = 0ca40cd5f703b950997392967bd505e8271049be
merged main       = 32534adf140f66d3c97e47a0dd8162be2112800c
```

The earlier WIP checkpoint remains at [ecx-execution-b6-wip-checkpoint-2026-09-27.md](ecx-execution-b6-wip-checkpoint-2026-09-27.md) as historical evidence only.

## Exact-head gates

```text
CI            #2338 / run 36326951864 — PASS
Product Eval  #1577 / run 36326951912 — PASS
```

CI verify passed canonical formatting, lint, typecheck, tests, Phase 4 process acceptance, production-operations acceptance, secret scan, dependency/toolchain/image reviews, release-security acceptance, and production build. Secret-history and naming jobs also passed.

No MCP External HTTPS Acceptance or Desktop Installer workflow was required by the Batch 6 changed-path set.

## Merged-main gates

```text
CI            #2339 / run 36327235481 — PASS
Product Eval  #1578 / run 36327235478 — PASS
```

## Staging delivery

```text
Staging Deploy #1448 / run 36327340399 — gate PASS, deploy skipped
Staging Deploy #1449 / run 36327538055 — gate PASS, deploy job PASS
```

#1449 deployed exact merged-main SHA `32534adf140f66d3c97e47a0dd8162be2112800c` as `staging-32534adf140f`.

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
- post-deploy capacity stabilization: **29.89 GiB free**.

## What Batch 6 closed

Batch 6 closes the Historical Ledger physical data-lifecycle gap while preserving the logical append-only ledger contract.

### 1. Additive/restart-safe lifecycle migration

Hub DB now carries:

- session archive watermark: `archive_through_seq` + `archive_head_hash`;
- immutable `history_archive_segments`;
- immutable `history_archive_event_index`;
- transaction-local `history_compaction_guard`.

Legacy databases receive these through additive migration. Existing committed event rows are not rewritten, re-sequenced, or rehashed. Reopen-safety is covered by migration and persistence tests.

### 2. Hot retention + immutable archive compaction

`HistoryLedger.compactSession(...)` moves only the next verified contiguous old prefix out of the hot `history_events` table.

The compaction path:

1. verifies the complete logical session before mutation;
2. computes only the next unarchived prefix;
3. keeps the caller-selected recent suffix hot;
4. serializes exact canonical HistoryEvent records;
5. stores gzip-compressed immutable archive payload plus SHA-256 and boundary metadata;
6. indexes archived EventIds for retry/conflict semantics;
7. performs the physical move under one immediate SQLite transaction;
8. advances archive watermark only with the committed segment;
9. verifies the complete logical session again before commit.

Repeated compaction with no newly eligible prefix is a no-op. Restart/reopen tests prove archived history can be replayed and later compaction advances only the next eligible prefix.

### 3. Logical replay remains unchanged

`verifySession` and `readRange` transparently compose archive segments plus the hot suffix.

The caller-visible ledger remains:

- one contiguous sequence beginning at 0;
- original SessionId/EventId values;
- original payloads;
- original `prevHash` and event hashes;
- exact replay ordering;
- existing Workspace/Project/scope/sensitivity/sync-class authorization;
- existing idempotent same-EventId retry semantics;
- conflicting same-EventId retry rejection.

Archive corruption, missing segment/index data, or watermark mismatch fails closed as a Historical Ledger integrity error.

### 4. Retention claim boundary

Batch 6 uses **retention** to mean how many recent events remain in the hot table after an explicitly invoked owner-level compaction operation.

It does **not** implement destructive logical-history expiration, automatic time-based purge, a background retention scheduler, or user-facing history deletion.

## Tests and evidence proven

Coverage includes:

- exact replay across archive + hot rows;
- append after compaction;
- archived EventId idempotent retry;
- archived EventId conflict rejection;
- repeated compaction no-op semantics;
- next-prefix-only compaction advancement;
- immutable archive storage;
- archive corruption fail-closed behavior;
- additive legacy migration;
- migration reopen safety;
- real file-backed restart/reopen replay;
- compression evidence on repeatable payloads;
- full repository CI/Product Eval and exact-SHA staging delivery.

## Architectural boundary

Batch 6 does not change service ownership.

- Historical Ledger remains a durable Hub subsystem.
- Hub DB remains the serialization/storage owner.
- Archive segments are a physical representation detail of the same logical ledger.
- No new service, UI history backend, analytics database, or cross-service data owner is introduced.
- Batch 5 process-lifetime telemetry remains separate and is not moved into Historical Ledger.

## Explicit non-claims

Batch 6 does **not** implement or prove:

- multi-recipient/fan-out execution;
- parallel aggregation;
- external A2A interoperability;
- a new ECX/History UI;
- Flow/Temporal long-running agent execution;
- automatic retention scheduling;
- destructive time-based purging;
- GDPR/account-level erase semantics;
- paid-provider benchmark freshness;
- universal savings, quality, or latency claims.

Do not silently attribute these properties to Batch 6.

## Safe resume: Batch 7

The next bounded roadmap slice is:

**Batch 7 — Advanced execution/productization**

Status at this checkpoint: **NEXT / NOT STARTED**.

Batch 7 is separate from Historical Ledger compaction. Start from the exact current roadmap/current-state material and define its accepted productization boundary before implementation. Do not reopen Batches 1–6 or silently introduce unrelated production cutover, DR-2, paid-provider, or broad UI scope under the Batch 7 label.

## Resume instructions for another session/agent

Read this file first. Then inspect exact current `main` and only the Batch 7 roadmap/current-state surfaces needed to define the next bounded slice. Do not restart branch hygiene, W17/W18 evidence work, Historical Ledger core audits, or Batches 1–6.
