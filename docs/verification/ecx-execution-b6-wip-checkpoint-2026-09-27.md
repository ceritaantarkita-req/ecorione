# ECX Execution — Batch 6 WIP Safe Checkpoint

Date: **2026-09-27**

Status: **HISTORICAL WIP / SUPERSEDED BY FINAL BATCH 6 CLOSURE**

## Resume identity

```text
base main = 874522e4322699c05d422209681b77ef0102a7a7
branch    = agent/ecx-ledger-retention-b6-20260927
batch     = 6 — Historical Ledger retention/compaction/migration
```

Batch 1 through Batch 5 were already **CLOSED / PASS** when this WIP checkpoint was created. This file is now preserved as historical defect-resolution/work-in-progress evidence and is superseded by [ecx-execution-b6-safe-checkpoint-2026-09-27.md](ecx-execution-b6-safe-checkpoint-2026-09-27.md).

## Accepted design

Batch 6 uses **hot retention + immutable archive segments**.

The logical Historical Ledger remains one append-only contiguous event stream. Compaction may move a verified old prefix out of the hot `history_events` table into immutable compressed archive segments, but it must preserve:

- original SessionId and EventId;
- original sequence numbers;
- original `prevHash` / event hash chain;
- exact replay ordering;
- existing idempotent retry/conflict semantics;
- existing Workspace/Project/scope/sensitivity/sync-class authorization;
- fail-closed integrity verification.

“Retention” in this batch means retaining a configurable recent suffix in the hot table. It does **not** mean silently deleting logical history.

## Current implementation

### Storage migration

Hub DB now has restart-safe migration support for:

- session archive watermark (`archive_through_seq`, `archive_head_hash`);
- immutable `history_archive_segments`;
- immutable `history_archive_event_index`;
- transaction-local `history_compaction_guard`.

Legacy databases receive the new lifecycle schema through additive migration. Existing event rows are not rewritten.

### Compaction

`HistoryLedger.compactSession(...)` currently:

1. verifies the complete logical session first;
2. computes only the next unarchived hot prefix;
3. keeps the requested recent event count hot;
4. serializes exact HistoryEvent records canonically;
5. stores gzip-compressed immutable archive payload plus SHA-256 and boundary hashes;
6. indexes archived EventIds for retry/conflict semantics;
7. moves the eligible hot prefix under one immediate SQLite transaction;
8. advances the archive watermark;
9. verifies the full logical session again before commit.

A repeated call with no newly eligible prefix is a no-op.

### Read/replay

`verifySession` and `readRange` transparently compose immutable archive segments plus the hot suffix. Callers keep the existing HistoryRange contract and do not need to know the physical storage tier.

## Tests added so far

Coverage proves:

- exact replay across archive + hot rows;
- append continues after compaction;
- archived EventId retries remain idempotent;
- conflicting archived EventId retries fail;
- repeated compaction is restart-safe/no-op until a new prefix is eligible;
- later compaction advances only the next prefix;
- archive tables reject direct mutation;
- corrupted archive payload fails closed;
- legacy DB migration adds archive lifecycle schema;
- migration is reopen-safe.

## Explicit non-scope

Batch 6 does **not** reopen or add:

- Batch 1–5 ECX execution behavior;
- multi-recipient/fan-out aggregation;
- external A2A interoperability;
- a new ECX or History UI;
- paid-provider/W18 reruns;
- Batch 5 process telemetry retention;
- cross-service analytics ownership;
- destructive time-based purging;
- rewriting committed sequence numbers or hashes.

## Historical closure follow-up

All closure requirements from this WIP checkpoint were subsequently completed through canonical PR #374 exact head `0ca40cd5f703b950997392967bd505e8271049be` / merge `32534adf140f66d3c97e47a0dd8162be2112800c`.

Exact-head CI #2338 + Product Eval #1577 passed. Merged-main CI #2339 + Product Eval #1578 passed. Staging Deploy #1448 was gate-only; actual Staging Deploy #1449 passed with exact SHA match, public/auth + MCP smoke PASS, healthy Operations, 15/15 configured services running, and 29.89 GiB stabilized free disk.

Current resume pointer: [ecx-execution-b6-safe-checkpoint-2026-09-27.md](ecx-execution-b6-safe-checkpoint-2026-09-27.md).
