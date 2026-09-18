# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-00 ACTIVE / ARCHITECTURE LOCK**

## Active item

**PE-00 — Architecture lock and migration contract**

This batch is docs/contracts only. No Project feature code, Trigger runtime, migration execution, new service, or new database is allowed in PE-00.

## PE-00 deliverables

- ADR-35 Project/Workspace + linkage/memory;
- ADR-36 Trigger/Temporal + version/overlap/misfire policy;
- ADR-37 Run read projection;
- ADR-38 Brain projection/privacy;
- [product-evolution-migration-matrix.md](product-evolution-migration-matrix.md);
- [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md);
- current-state/roadmap/agent docs synchronized.

## Locked PE-01 direction

```text
Hub      -> Project metadata
Ledger   -> project-aware sessions, no event rewrite
Context  -> global + current-Project memory only
Flow     -> project-aware graph metadata
Ai       -> explicit Project selection/switch
All      -> virtual
Personal -> prj_personal
```

## External/runtime decision verified

Temporal Schedule API semantics support Schedule creation, explicit catch-up/overlap policies, and IANA timezone. PE-03 will still compile/runtime-test against the pinned SDK `1.23.0`.

## Closure gate

PE-00 closes only after exact-head:

- normal CI PASS;
- Product Eval PASS;
- canonical docs synchronized.

After closure, PE-01 may be activated. Do not start PE-01 in this branch.

## Existing deferred decisions

- VPS/Cloudflare activation — deferred;
- AutoClick — deferred;
- paid W18 rerun — not authorized.
