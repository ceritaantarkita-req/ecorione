# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **NEXT ROADMAP DOCUMENTED / IMPLEMENTATION NOT ACTIVATED**

The previous Batch 1–12 / W / F6 baseline remains closed. The next Product Evolution roadmap is now documented, but no feature batch is active yet.

## Current state

```text
old baseline          CLOSED
Product Evolution     DOCUMENTED
PE-00                  PLANNED / NOT ACTIVATED
PE-01..PE-08           BLOCKED BY PREVIOUS PE BATCH
```

Canonical next-scope docs:

- [product-evolution-architecture.md](product-evolution-architecture.md)
- [product-evolution-roadmap.md](product-evolution-roadmap.md)
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md)

## First executable batch

**PE-00 — Architecture lock and migration contract**

PE-00 starts only after explicit operator instruction to begin implementation.

PE-00 must settle ADRs/contracts for:

- Workspace vs Project;
- direct projectId vs optional Project bindings;
- Project/global memory precedence;
- Trigger + Temporal schedule ownership;
- Flow version, concurrency, misfire and idempotency policy;
- Run projection source mapping;
- Brain projection/privacy boundary;
- legacy-data migration.

No PE-01 feature code starts before PE-00 closes.

## Deferred by existing decision

- compute-host/VPS + Cloudflare activation — **DEFERRED BY OPERATOR**;
- AutoClick — **DEFERRED BY DESIGN**;
- paid W18 rerun — **CLOSED / NOT AUTHORIZED FOR FRESHNESS**.

These are not blockers to Product Evolution.

## Activation rule

When the operator says to start the new roadmap:

1. mark PE-00 **ACTIVE** here;
2. create a bounded PE-00 branch from synchronized `main`;
3. follow [product-evolution-agent-guide.md](product-evolution-agent-guide.md);
4. merge only after exact-head gates;
5. close PE-00 here before activating PE-01.
