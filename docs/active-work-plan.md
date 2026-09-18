# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-01 ACTIVE / PROJECT FOUNDATION**

## Active item

**PE-01 — Project foundation**

PE-00 is CLOSED / PASS through PR #167. PE-01 now implements the accepted Project boundary vertically.

## PE-01 build order

```text
1. shared Project schemas/contracts
2. Hub Project metadata + default Personal
3. project-aware Historical Ledger
4. project-aware Chat normalization
5. Context migration + retrieval isolation
6. Flow graph project linkage
7. Ai Projects + explicit Project Chat context
8. migration/isolation/runtime tests
9. exact-head CI + Product Eval + relevant product/runtime acceptance
10. closure docs
```

Required contracts:

- [adr/0035-project-context-boundary.md](adr/0035-project-context-boundary.md)
- [product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)
- [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md)

## Non-negotiable boundaries

- Workspace remains the authority/security boundary.
- `prj_personal` is the real default Project; `All` is virtual.
- Project A must never retrieve Project B memory.
- Ledger events remain append-only and are not rewritten.
- Project stores/links metadata; no Project service or duplicate owner data.
- PE-02 Sources work is not pulled into PE-01.
- Trigger/Schedule remains PE-03.
- Run remains PE-04.
- Brain remains PE-06.
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.

## PE-00 closure evidence

```text
PR #167
head b27ffb569f2035d9deb710a734ca2ff2c161ab23
CI #1120 PASS
Product Eval #359 PASS
merge b7ebf5492aca463e55f9f30bc259b9a6028c62d7
```

PE-01 closes only when the full acceptance contract is green on the reviewed head.
