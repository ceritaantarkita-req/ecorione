# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-00 ACTIVE**

## Current verdict

The original Batch 1–12 / W / F6 baseline remains closed. Product Evolution execution has started with **PE-00 architecture lock**. PE-00 changes contracts/docs only; feature code begins in PE-01 after PE-00 closes.

## Current status

| Area | State |
|---|---|
| Old Batch/W/F6 baseline | **CLOSED** |
| Product Evolution roadmap | **ACTIVE** |
| PE-00 Architecture lock | **ACTIVE / IN REVIEW** |
| PE-01 Project foundation | **BLOCKED BY PE-00** |
| PE-02 … PE-08 | **BLOCKED BY PRIOR PE BATCH** |
| VPS/Cloudflare activation | **DEFERRED BY OPERATOR** |
| AutoClick | **DEFERRED BY DESIGN** |

## PE-00 decisions

- Workspace remains authority/security boundary.
- Hub owns Project metadata; no Project service.
- `prj_personal` is the real default Project; `All` is virtual.
- Project retrieval = authorized global + current Project only.
- Historical Ledger gains Project at session level; existing events are never rewritten.
- Flow owns TriggerDefinition; Temporal remains time schedule/durability owner.
- Time triggers v1 pin exact Flow version.
- Trigger overlap v1 is SKIP or QUEUE_ONE only.
- Run v1 is a read projection keyed by `operationId`.
- Brain v1 is rebuildable authorized projection; no graph DB.
- Context stays retrieval owner; ECX stays context-pack optimizer.

## PE-01 contract

PE-01 implementation is defined by:

- [adr/0035-project-context-boundary.md](adr/0035-project-context-boundary.md)
- [product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)
- [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)

Do not implement PE-01 until PE-00 exact-head gates pass and PE-00 is marked CLOSED.

## Documentation

Start from [README.md](README.md), [active-work-plan.md](active-work-plan.md), and [product-evolution-roadmap.md](product-evolution-roadmap.md).
