# ECORIONE — Current State & Next Steps

Last updated: **2026-09-19**

Status: **CURRENT / PE-01 ACTIVE**

## Current verdict

The original Batch/W/F6 baseline remains closed. Product Evolution has started.

**PE-00 is CLOSED / PASS. PE-01 Project foundation is ACTIVE.**

## Product Evolution status

| Batch | State |
|---|---:|
| PE-00 Architecture lock | **CLOSED / PASS** |
| PE-01 Project foundation | **ACTIVE** |
| PE-02 Project Sources | **BLOCKED BY PE-01** |
| PE-03 Trigger control plane | **BLOCKED BY PE-02** |
| PE-04 Work + Schedule + Runs | **BLOCKED BY PE-03** |
| PE-05 Event/Webhook automation | **BLOCKED BY PE-04** |
| PE-06 Brain V1 | **BLOCKED BY PE-05** |
| PE-07 Brain + Context + ECX | **BLOCKED BY PE-06** |
| PE-08 Product closure | **BLOCKED BY PE-07** |

## PE-01 target

Deliver a first-class Project context layer without creating a second security/data plane:

- Hub owns Project metadata;
- `prj_personal` is seeded idempotently in `ws_personal`;
- `All` remains virtual;
- Ledger sessions become Workspace/Project-aware without rewriting events;
- Chat resolves and validates effective Workspace + Project;
- Context retrieval uses authorized global + current Project only;
- Flow graphs carry Project linkage;
- Ai exposes Projects and sends explicit Project context;
- old personal flows/chat remain backward compatible through deterministic migration.

The acceptance contract is [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md).

## Closed PE-00 evidence

PR #167 exact head `b27ffb569f2035d9deb710a734ca2ff2c161ab23` passed CI #1120 and Product Eval #359 before merge `b7ebf5492aca463e55f9f30bc259b9a6028c62d7`.

## Deferred

- VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized.

## Read order

Start from [README.md](README.md), [active-work-plan.md](active-work-plan.md), ADR-35, the migration matrix, and PE-01 acceptance contract.
