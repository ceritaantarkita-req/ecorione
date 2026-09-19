# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-02 ACTIVE**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution is active.

**PE-00 and PE-01 are CLOSED / PASS. PE-02 Project Sources is ACTIVE.**

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **CLOSED / PASS** |
| PE-02 Project Sources | **ACTIVE** |
| PE-03 Trigger control plane | **BLOCKED BY PE-02** |
| PE-04 Work + Schedule + Runs | **BLOCKED BY PE-03** |
| PE-05 Event/Webhook automation | **BLOCKED BY PE-04** |
| PE-06 Brain V1 | **BLOCKED BY PE-05** |
| PE-07 Brain + Context + ECX | **BLOCKED BY PE-06** |
| PE-08 Product closure | **BLOCKED BY PE-07** |

## PE-01 delivered boundary

- Hub owns Project metadata.
- `prj_personal` is seeded idempotently in `ws_personal`.
- `All` remains virtual.
- Ledger sessions carry Workspace/Project metadata without rewriting historical events.
- Chat resolves and validates effective Workspace + Project.
- Context retrieval is global + current Project only; sibling Project memory is excluded.
- Core-memory supports global and per-Project labels with current-Project precedence.
- Flow graphs carry immutable Project linkage and validate Project/Workspace through Hub.
- Ai exposes Projects, persists the selected Project, and sends explicit Project context.
- deterministic legacy personal data is migrated; ambiguous data remains unassigned.

Acceptance details: [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md).

## PE-01 reviewed evidence

```text
PR #169
implementation head e039df3ee57a5fdcc62e33a3a1a48d9f0d3a7944
CI #1189 PASS
Product Eval #428 PASS
MCP External HTTPS Acceptance #595 PASS
```

The closure-doc head is revalidated before merge.

## Active: PE-02 Project Sources

PE-02 should bind existing owner data into Project context by reference, not copy it. It must not pull Trigger/Schedule, Run, or Brain work forward.

## Deferred

- VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized.

## Read order

Start from [README.md](README.md), [active-work-plan.md](active-work-plan.md), ADR-35, the migration matrix, and PE-01 acceptance contract.
