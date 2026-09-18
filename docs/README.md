# ECORIONE documentation map

Last updated: **2026-09-19**

This file is the single navigation entry point for repository documentation. If two documents appear to disagree, use the precedence below.

## Read these first

1. **[current-state-and-next-steps.md](current-state-and-next-steps.md)** — current state and next scope.
2. **[active-work-plan.md](active-work-plan.md)** — only work that is actually active.
3. **[product-evolution-architecture.md](product-evolution-architecture.md)** — next product model and ownership rules.
4. **[product-evolution-roadmap.md](product-evolution-roadmap.md)** — PE-00 through PE-08 batch plan.
5. **[product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)** — PE-01 ownership + migration contract.
6. **[product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)** — required PE-01 closure behavior.
7. **[product-evolution-agent-guide.md](product-evolution-agent-guide.md)** — exact procedure for humans/agents implementing PE work.
8. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone status.
9. **[../AGENTS.md](../AGENTS.md)** — repository invariants.

## Source-of-truth precedence

When wording conflicts:

```text
current code + tests
  > current-state-and-next-steps.md
  > active-work-plan.md
  > accepted ADRs
  > product-evolution-architecture.md
  > product-evolution-roadmap.md
  > owner runbooks
  > EXECUTION-PROGRESS.md
  > dated verification/evidence
  > archive
```

Accepted ADRs override roadmap prose when they address the same architectural decision.

## Product Evolution

The old Batch 1–12 / W / F6 baseline is closed. The next roadmap uses **PE** identifiers so it cannot be confused with Batch 13.

As of 2026-09-19:

- Product Evolution architecture: **DOCUMENTED**;
- PE-00: **ACTIVE / IN REVIEW**;
- PE-01 through PE-08: **blocked by prior batch**.

PE-00 is now active as a docs/contracts batch. PE-01 feature implementation remains blocked until PE-00 closes.

## Architecture and product reference

- [prd.md](prd.md) — original product/design baseline; not a current work queue.
- [blueprint.md](blueprint.md) — original phase blueprint; not a current work queue.
- [research.md](research.md) — technical research/source rationale.
- [adr/README.md](adr/README.md) — accepted architecture decisions.
- [DECISIONS.md](DECISIONS.md) — chronological decision log.
- [design.md](design.md) — visual/product design system.
- [LICENSING.md](LICENSING.md) — licensing boundary.
- [developer-sdk.md](developer-sdk.md) — developer integration reference.

## Implemented phase contracts

Historical implemented contracts:

- [api-fase1.md](api-fase1.md)
- [api-fase2.md](api-fase2.md)
- [api-fase3.md](api-fase3.md)
- [api-fase4.md](api-fase4.md)

## Operating runbooks

Use the owner-specific runbook when touching its subsystem:

- [production-activation.md](production-activation.md)
- [production-operations.md](production-operations.md)
- [release-operations.md](release-operations.md)
- [cloudflare-free-deployment.md](cloudflare-free-deployment.md)
- [security-review.md](security-review.md)
- [capability-permission-operations.md](capability-permission-operations.md)
- [spend-budget-operations.md](spend-budget-operations.md)
- [outbound-mcp-operations.md](outbound-mcp-operations.md)
- [extension-operations.md](extension-operations.md)
- [data-rebuild-operations.md](data-rebuild-operations.md)
- [data-governance-dr-operations.md](data-governance-dr-operations.md)
- [multimodal-operations.md](multimodal-operations.md)
- [voice-operations.md](voice-operations.md)
- [node-registry-flow-canvas-operations.md](node-registry-flow-canvas-operations.md)
- [space-block-runtime-operations.md](space-block-runtime-operations.md)

## Evidence

[verification/](verification/) contains dated closure records, failed attempts, runtime measurements, and exact-head evidence. It is not a work queue.

## Archive

[archive/](archive/) contains superseded audits/plans/snapshots. Do not use it to choose current work.

## Deferred scopes

- production VPS/Cloudflare activation — deferred by operator;
- AutoClick — deferred by design;
- paid W18 rerun — closed/not authorized for freshness.
