# ECORIONE documentation map

Last updated: **2026-09-22**

This file is the single navigation entry point for repository documentation. If two documents appear to disagree, use the precedence below.

## Read these first

1. **[current-state-and-next-steps.md](current-state-and-next-steps.md)** — canonical current state and explicit deferred boundaries.
2. **[active-work-plan.md](active-work-plan.md)** — canonical active-work queue; Off-host Backup & DR is the only active operational scope.
3. **[post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md)** — CLOSED PCS-00..PCS-10 product/UX + SumoPod staging roadmap.
4. **[product-evolution-architecture.md](product-evolution-architecture.md)** — closed PE product model and ownership rules.
5. **[product-evolution-roadmap.md](product-evolution-roadmap.md)** — closed PE-00 through PE-08 batch plan.
6. **[product-evolution-migration-matrix.md](product-evolution-migration-matrix.md)** — PE-01 ownership + migration contract.
7. **[product-evolution-pe01-acceptance.md](product-evolution-pe01-acceptance.md)** — closed PE-01 acceptance.
8. **[product-evolution-pe02-acceptance.md](product-evolution-pe02-acceptance.md)** — closed PE-02 acceptance.
9. **[product-evolution-pe03-acceptance.md](product-evolution-pe03-acceptance.md)** — closed PE-03 acceptance.
10. **[product-evolution-pe04-acceptance.md](product-evolution-pe04-acceptance.md)** — closed PE-04 acceptance.
11. **[product-evolution-pe05-acceptance.md](product-evolution-pe05-acceptance.md)** — closed PE-05 acceptance.
12. **[product-evolution-pe06-acceptance.md](product-evolution-pe06-acceptance.md)** — closed PE-06 acceptance.
13. **[product-evolution-pe07-acceptance.md](product-evolution-pe07-acceptance.md)** — closed PE-07 acceptance.
14. **[product-evolution-pe08-acceptance.md](product-evolution-pe08-acceptance.md)** — closed PE-08 acceptance.
15. **[product-evolution-agent-guide.md](product-evolution-agent-guide.md)** — procedure/reference for historical PE work.
16. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone status.
17. **[../AGENTS.md](../AGENTS.md)** — repository invariants.

## Source-of-truth precedence

When wording conflicts:

```text
current code + tests
  > current-state-and-next-steps.md
  > active-work-plan.md
  > accepted ADRs
  > owner runbooks
  > closed post-closure-product-staging-roadmap.md
  > product-evolution-architecture.md
  > product-evolution-roadmap.md
  > EXECUTION-PROGRESS.md
  > dated verification/evidence
  > archive
```

Accepted ADRs override roadmap prose when they address the same architectural decision.

## Product Evolution

The old Batch 1–12 / W / F6 baseline is closed. The completed Product Evolution roadmap used **PE** identifiers so it could not be confused with Batch 13.

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

The operator-approved separate roadmap, **PCS-00..PCS-10**, covers Ai conversation continuity, provider/model onboarding, local-runtime resilience, visual/IA cleanup, Flow defect closure, integrated browser acceptance, SumoPod remote staging, GitHub-to-staging delivery, staging hardening, and documentation convergence. PCS-00 through PCS-10 are now closed at their documented boundaries. See [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md). This does not reopen PE and does not imply production is live. Post-closure native-Windows portability hardening is merged via PR #182. Clean-checkout/CI reproducibility is CLOSED / PASS via PR #183. Fresh-clone Windows EOL reproducibility is CLOSED / PASS via PR #185 (CI #1486, Product Eval #725, Desktop Installer #76; post-merge CI #1487 + Product Eval #726). These are repository hardening, not a new PE batch. PCS-10 documentation convergence evidence: [verification/pcs-10-documentation-convergence-2026-09-21.md](verification/pcs-10-documentation-convergence-2026-09-21.md).

PCS-10 closure PR #219 passed CI #1684 + Product Eval #923 and merged as `6058aa0ff294218147a91ee0fc7b77f32d1be80d`. Post-merge documentation bookkeeping PR #220 then passed CI #1686 + Product Eval #925 and merged as `fa55e530615e9eb3a35d646e39bbbb3bf34d8a07`.

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
- [offhost-dr-recovery.md](offhost-dr-recovery.md) — active off-host backup and total-host-loss recovery workstream; checkpoints 1–4 are closed at repository boundaries; checkpoint 5 adds retained-generation audit plus RPO/RTO closure evidence; real runtime execution is pending.
- [multimodal-operations.md](multimodal-operations.md)
- [voice-operations.md](voice-operations.md)
- [webhook-operations.md](webhook-operations.md)
- [node-registry-flow-canvas-operations.md](node-registry-flow-canvas-operations.md)
- [space-block-runtime-operations.md](space-block-runtime-operations.md)

## Evidence

[verification/](verification/) contains dated closure records, failed attempts, runtime measurements, and exact-head evidence. It is not a work queue.

## Archive

[archive/](archive/) contains superseded audits/plans/snapshots. Do not use it to choose current work.

## Current operating/deferred boundaries

- active operational scope — **Off-host Backup & DR / RUNTIME EXECUTION PENDING**; checkpoints 1–4 are CLOSED / PASS at repository boundaries, checkpoint 5 evidence tooling is under repository review, while real independent copy and total-host-loss application recovery remain pending runtime evidence.
- SumoPod remote development/staging — **VERIFIED** at application revision `52046db35e403babdda934881773c46bf2c57b68` / image `staging-52046db35e40` through governed Staging Deploy #293.
- public production cutover — **deferred pending a separate explicit operator promotion decision**; staging evidence is complete but is not production evidence.
- Cloudflare named Tunnel/public edge — optional/pending operator hostname/edge decision.
- AutoClick — deferred by design.
- paid W18 rerun — closed/not authorized for freshness.

## Post-closure maintenance checkpoint — 2026-09-21

A bounded maintenance pass after PE/PCS closure fixed concrete correctness/security/privacy defects through PR #232 without opening a new roadmap. It covers W18 cleanup state preservation, fail-closed redirect boundaries, JWKS trust/rotation/error semantics, and Local multimodal endpoint privacy.

The repository boundary and the remote staging runtime boundary remain distinct: maintenance merges do not by themselves prove a newer SumoPod deployment. See [verification/post-closure-maintenance-checkpoint-2026-09-21.md](verification/post-closure-maintenance-checkpoint-2026-09-21.md).

## Follow-up post-closure maintenance checkpoint — 2026-09-21

A second bounded maintenance slice is closed through PR #237. It covers Sync public-MCP failure bounding/sanitization, serialized Connect credential-vault mutations, serialized Sandbox idempotency races, and timeout-bounded default JWKS retrieval.

This is still maintenance rather than a new roadmap. Repository source advancement is not evidence that SumoPod staging was redeployed. See [verification/post-closure-maintenance-checkpoint-2-2026-09-21.md](verification/post-closure-maintenance-checkpoint-2-2026-09-21.md).

## Third post-closure maintenance checkpoint — 2026-09-21

A third bounded maintenance slice is closed through PR #240. It covers timeout-bounded Sandbox control-plane owner calls and timeout-bounded verified Connect webhook forwarding to Flow with sanitized upstream failure semantics and stable-delivery retry compatibility.

This remains repository maintenance, not a new roadmap or staging deployment claim. See [verification/post-closure-maintenance-checkpoint-3-2026-09-21.md](verification/post-closure-maintenance-checkpoint-3-2026-09-21.md).

## Fourth post-closure maintenance checkpoint — 2026-09-21

A fourth bounded maintenance slice is closed through PR #242. It bounds the Ai server-side Flow owner proxy to 10 seconds by default while preserving redirect fail-closed behavior and sanitized `502 UPSTREAM_UNAVAILABLE` transport semantics.

PR #242 exact implementation head `db8a8f6068a40e47187a2142e6801e975e749276` passed CI #1743, Product Eval #982, and PCS-06 Integrated Browser Acceptance #18 before merge as `47cbeaa8760debbfde87cff7cb7a828037a2829b`.

This remains repository maintenance, not a new roadmap or staging deployment claim. See [verification/post-closure-maintenance-checkpoint-4-2026-09-21.md](verification/post-closure-maintenance-checkpoint-4-2026-09-21.md).

## Fifth post-closure maintenance checkpoint — 2026-09-21

A fifth bounded maintenance slice is closed through PR #244. It repairs Sandbox receipt-lock acquisition cleanup so a metadata-write failure after exclusive lock creation cannot leave a stale lock that permanently blocks the same idempotency key.

PR #244 exact implementation head `462c9418078baefc7cd00eed79dd85dac4ee1bf9` passed CI #1747 and Product Eval #986 before merge as `3114354ab44894ef80e75b9983fceac64babc2e0`.

This remains repository maintenance, not a new roadmap or staging deployment claim. See [verification/post-closure-maintenance-checkpoint-5-2026-09-21.md](verification/post-closure-maintenance-checkpoint-5-2026-09-21.md).

## Latest-main staging convergence — CLOSED / PASS

The bounded latest-main staging-convergence scope is CLOSED / PASS at the runtime boundary. Governed Staging Deploy #293 / run `35627920447` deployed exact reviewed `main` `52046db35e403babdda934881773c46bf2c57b68` as `staging-52046db35e40`. Public smoke, authenticated Ops health, MCP protection checks, exact-host SHA evidence, and final PCS-08 deploy validation all passed. Earlier checkpoint files remain preserved as historical evidence.

Closure evidence: [verification/latest-main-staging-convergence-closure-2026-09-22.md](verification/latest-main-staging-convergence-closure-2026-09-22.md).

## Repository-wide documentation reconciliation — 2026-09-21

The repository contains 192 Markdown/MDX documents. Current/canonical documents are reconciled to the closed PE/PCS state and verified staging boundary. Accepted ADRs remain architectural records; `verification/` and `archive/` intentionally preserve dated status, failed attempts, and historical next-step wording. A historical file saying `ACTIVE`, `PENDING`, or `next scope` is not current authority unless the current-state documents above explicitly reopen that scope.

Audit record: [verification/repository-documentation-reconciliation-2026-09-21.md](verification/repository-documentation-reconciliation-2026-09-21.md).
