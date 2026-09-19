# ECORIONE — Active Work Plan

Last updated: **2026-09-19**

Status: **PE-02 ACTIVE / PROJECT SOURCES**

## Latest closed item

**PE-01 — Project foundation**

PE-01 now provides the accepted Project context boundary vertically:

```text
Project metadata          → Hub
Default Project           → prj_personal in ws_personal
All                       → virtual aggregate only
Chat / Ledger             → Project-aware
Context                   → global + current Project, no sibling leakage
Flow                      → immutable Project linkage
Ai                        → Projects surface + explicit active Project
```

Required contracts:

- [adr/0035-project-context-boundary.md](adr/0035-project-context-boundary.md)
- [product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)
- [product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md)

## PE-01 implementation evidence

```text
PR #169
reviewed implementation head e039df3ee57a5fdcc62e33a3a1a48d9f0d3a7944
CI #1189 PASS
Product Eval #428 PASS
MCP External HTTPS Acceptance #595 PASS
```

The closure-doc head is revalidated before merge; PR #169 remains the canonical exact-head evidence surface.

## Active item

**PE-02 — Project Sources**

PR #169 is merged and post-merge `main` passed CI #1193, Product Eval #432, and MCP External HTTPS Acceptance #599.

PE-02 implementation boundary:

- bind existing owners by reference, not copied content;
- support Artifact / Space / Flow / connector-backed source relationships;
- keep Workspace authority unchanged;
- do not introduce Trigger/Schedule (PE-03), Runs (PE-04), or Brain (PE-06).

## Non-negotiable boundaries

- Workspace remains the authority/security boundary.
- `prj_personal` is the real default Project; `All` is virtual.
- Project A must never retrieve Project B memory.
- Ledger events remain append-only and are not rewritten.
- Project stores/links metadata; no Project service or duplicate owner data.
- Trigger/Schedule remains PE-03.
- Run remains PE-04.
- Brain remains PE-06.
- VPS/Cloudflare, AutoClick, and paid W18 rerun remain out of scope.

## Prior closure

PE-00:

```text
PR #167
head b27ffb569f2035d9deb710a734ca2ff2c161ab23
CI #1120 PASS
Product Eval #359 PASS
merge b7ebf5492aca463e55f9f30bc259b9a6028c62d7
```
