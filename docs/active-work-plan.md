# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-08 ACTIVE / PRODUCT CLOSURE**

## Latest closed item

**PE-07 — Brain + Context + ECX**

```text
PR #178
reviewed implementation head    892726c20ac95dded26fdc3fd2000ad4bb56363d
implementation CI               35447877629 / #1457 PASS
implementation Product Eval     35447877612 / #696 PASS
implementation MCP HTTPS        35447877592 / #855 PASS
closure evidence head           e443a6e9d10b24b7c1de7bcb315b038cf6425a45
closure-head CI                 35448099910 / #1462 PASS
closure-head Product Eval       35448099971 / #701 PASS
closure-head MCP HTTPS          35448099995 / #860 PASS
merge main                      15e31ed4b03f5be5bc6a7104fc14bb1dd0917743
median candidate reduction      66.67%
required-reference retention    100%
provenance retention            100%
unauthorized refs               0
```

Acceptance: [product-evolution-pe07-acceptance.md](product-evolution-pe07-acceptance.md).  
Closure evidence: [verification/pe-07-brain-context-ecx-closure-2026-09-19.md](verification/pe-07-brain-context-ecx-closure-2026-09-19.md).

## Active item

**PE-08 — Product closure**

Implementation/audit branch: `pe/pe-08-product-closure-20260919`, created from synchronized `main` `82026c8a1948336b2da4e00ee4832180f68452f7` after PR #179 merged.

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).

Current closure scope:

- audit PE-00..PE-07 migration/compatibility as one product baseline;
- rerun Project isolation/security checks across Context, Sources, Flow/Trigger/Run, Brain, and ECX;
- verify durable owner state across local restart/persistence boundaries;
- verify backup/restore/rebuild semantics for new durable metadata and derived Brain;
- run relevant Windows/runtime/installer regression when the final diff requires it;
- run deterministic Product Evolution UX/navigation/responsive regressions and existing UX inventory;
- repair only reproducible closure blockers, not add unrelated features;
- converge current docs to one final state;
- archive superseded planning snapshots only after current docs replace them;
- close only on exact-head CI + Product Eval + every relevant acceptance gate.

Implementation/audit checkpoint:

- Product Eval now carries an explicit PE-08 closure matrix for Project migration/isolation, Project Source persistence, Context Project rules, Flow/Trigger isolation and restart-safe state, owner backup/restore, Brain rebuild, Product Evolution UX/navigation/responsive guards, and Windows installer specification;
- `test/pe08-product-closure.test.ts` exercises real Hub + Context + Flow SQLite backup -> post-backup mutation -> restore -> reopen and then rebuilds Brain from restored canonical owner state;
- Brain remains non-persistent; the test proves reconstruction rather than adding Brain backup state;
- existing local runtime/browser inventory remains a separate runtime evidence boundary and must not be mislabeled from source-only tests;
- no provider/model call, hosted spend, production deployment, L4 autonomy, AutoClick, or new feature domain is part of this closure work.

Dependency gate:

```text
PE-00..PE-07  CLOSED / PASS
PE-08          ACTIVE — PRODUCT CLOSURE
```

## Non-negotiable boundaries

- no Batch 13;
- no feature expansion hidden inside closure;
- no second scheduler/retry database;
- Temporal remains durability/timer/retry owner;
- Workspace remains the authority boundary;
- Context remains retrieval owner;
- ECX remains context-pack optimizer;
- Brain remains rebuildable/derived, not canonical persistence;
- MAX_AUTONOMY_V1 stays L3;
- no paid hosted evidence without explicit authorization;
- production VPS/Cloudflare remains deferred by operator;
- AutoClick remains deferred by design.
