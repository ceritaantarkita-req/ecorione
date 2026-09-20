# ECORIONE — Active Work Plan

Last updated: **2026-09-20**

Status: **PRODUCT EVOLUTION CLOSED / PCS-05 CLOSED / PCS-06 NEXT**

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

This is maintenance hardening, not PE-09 or Batch 13. The clean-checkout follow-up is CLOSED / PASS on PR #183: implementation/evidence head `8b4bdc3793557dccf329a4aee19bec43ab8fb9bb` passed CI #1479 + Product Eval #718; final closure head `451c3b45366ca42004d6c5af53f59c475e911e6f` passed CI #1482 + Product Eval #721 and merged as `4980b3ceb149be58788467d2e11769de12977d5a`.

The final fresh-clone Windows EOL follow-up is also CLOSED / PASS on PR #185. It normalized only the three `.cmd` Git blobs (semantic diff = 0), preserved CRLF checkout via `.gitattributes`, passed CI #1486 + Product Eval #725 + Desktop Installer #76, merged as `4194e89a2b0611897969eaca2cb9c2b4b360c774`, and post-merge main passed CI #1487 + Product Eval #726. No PE or repository-hardening implementation batch remains; the separately approved PCS roadmap is the next scope.

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

## Active next scope

There is **no active Product Evolution batch**. PE-00 through PE-08 remain CLOSED / PASS. The operator has explicitly approved the separate post-closure roadmap [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md); it must not be renamed PE-09 or Batch 13.

**PCS-00 Baseline lock is CLOSED / PASS.** PR #189 exact head `f58311ae30beef877f0c38962bcf4b1aefe91917` passed CI #1492 + Product Eval #731 and merged as `12fae37e901e4cbfbb7e4cb6cf9b8e9a2ec4e764`. Evidence: [verification/pcs-00-baseline-lock-2026-09-20.md](verification/pcs-00-baseline-lock-2026-09-20.md).

**PCS-01 Chat continuity/history is CLOSED / PASS.** PR #191 exact head `9445b30c659628e1d551191219d0b7cd5ccf2f7c` passed CI #1505 + Product Eval #744 and merged as `ee363c055944b27b549a2f061105eea35fa25f9e`. Historical Ledger remains canonical history; no parallel chat-history store was introduced. Evidence: [verification/pcs-01-chat-continuity-2026-09-20.md](verification/pcs-01-chat-continuity-2026-09-20.md).

**PCS-02 AI provider onboarding + hosted model choice is CLOSED / PASS.** PR #193 exact head `45dbe9365b23dfa3398a4726a26f9a245bd09e9d` passed CI #1516 + Product Eval #755 and merged as `0fba6842f4c39f2742eb6d518e63c90d1a4883db`. Connect remains the provider credential/runtime/model authority. Evidence: [verification/pcs-02-provider-onboarding-2026-09-20.md](verification/pcs-02-provider-onboarding-2026-09-20.md).

**PCS-03 Local AI resilience/runtime discovery is CLOSED / PASS.** PR #195 exact head `5be1c68f7b345d5e7d433a9eed302000ffe552a1` passed CI #1525 + Product Eval #764 and merged as `4e2407af7240c9ca3b94ffbfb0a1c239c6a4ddae`. Connect remains the local-runtime owner; OpenAI-compatible remains the abstraction; no local runtime is a supported explicit state; no silent Local/Hosted fallback was introduced. Evidence: [verification/pcs-03-local-ai-resilience-2026-09-20.md](verification/pcs-03-local-ai-resilience-2026-09-20.md).

**PCS-04 Product visual + information-architecture cleanup is CLOSED / PASS.** PR #197 exact head `ec4ed1508cb7ab72fb9d86f15ec3541c2caf80f5` passed CI #1529 + Product Eval #768 and merged as `8a328ae0c0abeb039866ac40068a9053c4796659`. Core/Workspace/Advanced navigation, shared control readability, primary page hierarchy, and explicit Ai route labels were updated without backend ownership changes. Evidence: [verification/pcs-04-visual-ia-closure-2026-09-20.md](verification/pcs-04-visual-ia-closure-2026-09-20.md).

**PCS-05 Flow runtime defect closure is CLOSED / PASS.** PR #199 exact head `d7eb37e8b5e97da07895fcd050621e563a47359b` passed CI #1537 + Product Eval #776 and merged as `f58923b8261104c8aec331f506a68f8cf5fe5e7e`. Graph-state query handlers are registered before the first awaited workflow activity; exact `node.execute` authority is preflighted before Temporal start; the UI exposes explicit governed authority preparation through Hub approval; and runtime node authorization remains fail-closed. Evidence: [verification/pcs-05-flow-runtime-closure-2026-09-20.md](verification/pcs-05-flow-runtime-closure-2026-09-20.md).

**PCS-06 Integrated browser/regression acceptance is NEXT.** Verify the changed product through rendered/browser-level user flows and normal regression gates before any remote staging work.

Current execution order:

```text
PCS-00 baseline lock
 -> PCS-01 chat continuity/history
 -> PCS-02 provider onboarding + hosted model choice
 -> PCS-03 local AI resilience/runtime discovery
 -> PCS-04 visual + information-architecture cleanup
 -> PCS-05 Flow runtime defect closure
 -> PCS-06 integrated browser/regression acceptance
 -> PCS-07 SumoPod remote staging
 -> PCS-08 GitHub -> staging continuous deployment
 -> PCS-09 staging persistence/security/backup/observability
 -> PCS-10 closure/docs
```

The SumoPod target is a **remote development/staging runtime**, not production. GitHub remains source of truth; do not turn the live VPS working tree into an unmanaged development source.

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
- public production cutover remains deferred; operator-owned SumoPod remote staging is approved under PCS-07..PCS-09;
- AutoClick remains deferred by design.
