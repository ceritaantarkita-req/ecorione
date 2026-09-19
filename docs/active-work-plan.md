# ECORIONE — Active Work Plan

Last updated: **2026-09-20**

Status: **PRODUCT EVOLUTION CLOSED / REPOSITORY HARDENING ONLY / NO ACTIVE PE BATCH**

## Latest repository-hardening closure

**Native Windows portability — PR #182**

```text
head                 108781b5d53034462393f06d5e9cb36e9c5d5cf5
CI                   #1477 PASS
Product Eval         #716 PASS
merge main           3461951414f72c8f183527e3d28eec20dd383d45
Windows suite        191 files PASS + 1 skipped
Windows tests        990 PASS + 3 skipped
```

This is maintenance hardening, not PE-09 or Batch 13.

Windows command-script EOL normalization is also CLOSED / PASS on PR #185. Exact head `600f459fbe2671e7e4297e60da725b005b6f9533` passed CI #1486, Product Eval #725, and Desktop Installer #76 and merged as `4194e89a2b0611897969eaca2cb9c2b4b360c774`. This was line-ending hygiene only; semantic diff was zero. The clean-checkout follow-up is CLOSED / PASS on PR #183: implementation/evidence head `8b4bdc3793557dccf329a4aee19bec43ab8fb9bb` passed CI #1479 + Product Eval #718; final closure head `451c3b45366ca42004d6c5af53f59c475e911e6f` passed CI #1482 + Product Eval #721 and merged as `4980b3ceb149be58788467d2e11769de12977d5a`.

## Latest Product Evolution closure

**PE-08 — Product closure**

```text
PR #180
reviewed implementation head    33f9e891c3152a82304d5f1e31693604c855d94c
implementation CI               35449548713 / #1469 PASS
implementation Product Eval     35449548657 / #708 PASS
closure evidence head           5d1b1c80168a26ae38af33d862a6fa26b019802c
closure-head CI                 35450417735 / #1473 PASS
closure-head Product Eval       35450417734 / #712 PASS
merge main                      b32d57022344ad08a59b6b7d163507c5530a7ca6
Product Eval matrix             36 files / 148 tests PASS
normal CI                       191 files PASS + 1 skipped
normal tests                    991 PASS + 2 skipped
```

Acceptance: [product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md).  
Closure evidence: [verification/pe-08-product-closure-2026-09-19.md](verification/pe-08-product-closure-2026-09-19.md).

## Active item

There is **no active Product Evolution batch**. PE-00 through PE-08 are CLOSED / PASS at their documented boundaries. New product work requires an explicit new roadmap/decision; do not create Batch 13 implicitly.

## Closed PE-08 boundary

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
- no provider/model call, hosted spend, production deployment, L4 autonomy, AutoClick, or new feature domain is part of this closure work;
- reviewed implementation head `33f9e891c3152a82304d5f1e31693604c855d94c` passed CI #1469 and Product Eval #708;
- Product Eval closure matrix: 36 files / 148 tests PASS;
- normal CI suite: 191 files PASS + 1 skipped; 991 tests PASS + 2 skipped; Phase 4 3/3 PASS; production-ops, security/toolchain/container/build gates PASS;
- closure-candidate documentation head is now required before merge.

Dependency gate:

```text
PE-00..PE-07  CLOSED / PASS
PE-08          CLOSED / PASS
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
