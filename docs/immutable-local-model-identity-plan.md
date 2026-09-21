# Immutable Local Model Identity — Prepared Plan

> **HISTORICAL W13 PLAN:** retained because implementation/source comments cite this plan. W13 is already closed with documented limitations; this file is not a current work queue.


Status: **HISTORICAL W13 PLAN / IMPLEMENTED BOUNDARY CLOSED WITH DOCUMENTED LIMITATIONS**  
Plan date: **2026-09-12** · Reconciled: **2026-09-21**

The local rehearsal/benchmark/observability evidence reports `gemma4:latest`. That is valid historical runtime evidence but a mutable alias, not an immutable production identity.

## Current repository outcome

The current Connect implementation now models local identity separately from the requested tag, carries digest/provenance state, supports runtime-backed provenance checks, keeps declared-but-unverified identity unpinned, rejects mutable model aliases on runtime-setting mutation unless an immutable digest accompanies them, and bypasses exact local cache identity when the model is not verified. See `services/connect/src/local-model-identity.ts`, `services/connect/src/providers/local-model-provenance.ts`, `services/connect/src/runtime-settings.ts`, and ADR-14. Historical evidence containing `gemma4:latest` remains unchanged because it records the runtime identity observed at that time.

The numbered section below is the original prepared plan retained for provenance; it is not an active work queue.

## Goal

Make durable model identity claims depend on a pinned immutable identity while preserving historical evidence exactly as recorded.

## Historical planned implementation

1. Define a Connect-owned local model identity record containing runtime, requested alias, immutable resolved identity/digest, resolution timestamp, and source.
2. Resolve the local runtime identity at startup/preflight through the existing local provider boundary; never infer a digest from the alias string.
3. Refuse production-identity claims when only a mutable alias is known. Local R&D may continue but must expose the limitation.
4. Persist/report both requested model tag and resolved immutable identity in Connect observability/provider responses without leaking credentials.
5. Propagate immutable identity into Hub model-called Ledger metadata and comparative/evidence harnesses while keeping historical Ledger entries immutable.
6. Update Settings/Ops to show `requested alias` separately from `resolved identity`.
7. Add deterministic tests for alias detection, resolution mismatch, unavailable identity, restart stability, and fail-closed production claim behavior.
8. Run a new local evidence checkpoint on synchronized merged code; confirm the identity is stable across controlled owner restart and at least one local model call.

## Migration boundary

Do not rewrite existing evidence documents or historical Ledger rows containing `gemma4:latest`; they describe what was actually reported at the time. New immutable evidence begins only after this checkpoint is implemented and measured.

## Not part of this prepared plan

- model quality comparison;
- changing the chosen local model;
- Hosted-provider activation;
- VPS/Cloudflare work;
- automatic semantic reference selection.
