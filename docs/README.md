# ECORIONE documentation map

Last updated: **2026-09-20**

This file is the single navigation entry point for repository documentation. If two documents appear to disagree, use the precedence below.

## Read these first

1. **[current-state-and-next-steps.md](current-state-and-next-steps.md)** — current state and next scope.
2. **[post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md)** — operator-approved product/UX + SumoPod staging roadmap.
4. **[active-work-plan.md](active-work-plan.md)** — only work that is actually active.
4. **[product-evolution-architecture.md](product-evolution-architecture.md)** — next product model and ownership rules.
5. **[product-evolution-roadmap.md](product-evolution-roadmap.md)** — PE-00 through PE-08 batch plan.
6. **[product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)** — PE-01 ownership + migration contract.
7. **[product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)** — required PE-01 closure behavior.
8. **[product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md)** — required PE-02 source-binding closure behavior.
9. **[product-evolution-pe03-acceptance.md](product-evolution-pe03-acceptance.md)** — closed PE-03 Trigger contract.
10. **[product-evolution-pe04-acceptance.md](product-evolution-pe04-acceptance.md)** — closed PE-04 Work/Schedule/Runs contract.
11. **[product-evolution-pe05-acceptance.md](product-evolution-pe05-acceptance.md)** — closed PE-05 Event/Webhook contract.
12. **[product-evolution-pe06-acceptance.md](product-evolution-pe06-acceptance.md)** — closed PE-06 Brain V1 contract.
13. **[product-evolution-pe07-acceptance.md](product-evolution-pe07-acceptance.md)** — closed PE-07 Brain + Context + ECX contract.
14. **[product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md)** — closed PE-08 Product closure contract.
15. **[product-evolution-agent-guide.md](product-evolution-agent-guide.md)** — exact procedure for humans/agents implementing PE work.
16. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone status.
17. **[../AGENTS.md](../AGENTS.md)** — repository invariants.

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
- PE-00: **CLOSED / PASS**;
- PE-01: **CLOSED / PASS**;
- PE-02: **CLOSED / PASS**;
- PE-03: **CLOSED / PASS**;
- PE-04: **CLOSED / PASS**;
- PE-05: **CLOSED / PASS**;
- PE-06: **CLOSED / PASS**;
- PE-07: **CLOSED / PASS**;
- PE-08: **CLOSED / PASS**.

PE-08 Product closure is CLOSED / PASS. Product Evolution PE-00 through PE-08 is closed; there is no active Product Evolution implementation queue.

### Post-closure Product + Remote Staging

The operator has approved the next separate roadmap, **PCS-00..PCS-10**, covering Ai conversation continuity, provider/model onboarding, local-runtime resilience, visual/IA cleanup, Flow defect closure, integrated browser acceptance, SumoPod remote staging, GitHub-to-staging delivery, and staging hardening. See [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md). This does not reopen PE and does not imply production is live. Post-closure native-Windows portability hardening is merged via PR #182. Clean-checkout/CI reproducibility is CLOSED / PASS via PR #183. Fresh-clone Windows EOL reproducibility is CLOSED / PASS via PR #185 (CI #1486, Product Eval #725, Desktop Installer #76; post-merge CI #1487 + Product Eval #726). These are repository hardening, not a new PE batch.

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
- [webhook-operations.md](webhook-operations.md)
- [node-registry-flow-canvas-operations.md](node-registry-flow-canvas-operations.md)
- [space-block-runtime-operations.md](space-block-runtime-operations.md)

## Evidence

[verification/](verification/) contains dated closure records, failed attempts, runtime measurements, and exact-head evidence. It is not a work queue.

## Archive

[archive/](archive/) contains superseded audits/plans/snapshots. Do not use it to choose current work.

## Current next/deferred scopes

- SumoPod remote development/staging — **approved next scope** under PCS-07..PCS-09.
- public production cutover — deferred until staging evidence and explicit operator promotion decision.
- Cloudflare named Tunnel/public edge — optional/pending operator hostname/edge decision.
- AutoClick — deferred by design.
- paid W18 rerun — closed/not authorized for freshness.
