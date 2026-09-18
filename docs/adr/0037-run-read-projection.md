# ADR-37 — Run adalah unified read projection dengan operationId sebagai key v1

**Status:** Diterima · 2026-09-19 · PE-00

## Konteks

Eksekusi Flow saat ini sudah meninggalkan truth di beberapa owner: Temporal/Flow, Hub audit/approval, RnD trace, Historical Ledger, serta `operationId`. Product membutuhkan halaman Runs, tetapi database execution kedua akan menciptakan drift dan source-of-truth conflict.

## Keputusan

1. **Run v1 adalah read projection, bukan execution owner.**
2. Stable product Run key v1 = existing `operationId`.
3. `WorkflowRunId` yang sudah ada di shared ID tetap reserved; jangan mulai identity kedua tanpa kebutuhan konkret.
4. Run projection menggabungkan hanya data dari owner APIs:
   - Flow/Temporal: workflow identity, graph + exact version, lifecycle;
   - Hub: policy, approval, action audit;
   - RnD: trace/cost/eval detail;
   - Ledger: chronology;
   - Trigger definition: why/when started.
5. Missing optional owner data menghasilkan partial Run dengan explicit availability state; jangan fabricate.
6. Cache/materialized read model boleh ditambah nanti hanya jika rebuildable dan bukan authority.
7. Run status tidak boleh ditulis manual untuk “memperbaiki” Temporal/owner state.

## Minimum Run view

```text
operationId
workspaceId
projectId
triggerId?
flowId
flowVersion
temporalWorkflowId
startedAt
finishedAt?
status
cost?
approvals[]
actions[]
outputs[]
errors[]
```

## Konsekuensi

- PE-04 membangun aggregator/read model.
- Correlation melalui operationId harus dipertahankan di semua Trigger-started Flow.
- Deleting any future Run cache tidak boleh menghilangkan canonical execution evidence.
