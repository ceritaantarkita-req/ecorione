# ECORIONE documentation map

Last updated: **2026-09-28**

This is the single navigation entry point for repository documentation.

## Source-of-truth precedence

When wording conflicts, use:

```text
current code + tests
  > current-state-and-next-steps.md
  > active-work-plan.md
  > AGENTS.md
  > accepted ADRs
  > owner runbooks
  > EXECUTION-PROGRESS.md
  > dated verification/evidence
  > archive
```

Accepted ADRs override roadmap prose when they address the same architectural decision.

Historical verification is intentionally preserved even when it contains an older state that was true at the time. Do not treat a dated “NEXT / NOT STARTED” statement as current unless the current-state layer agrees.

## Read these first

1. **[current-state-and-next-steps.md](current-state-and-next-steps.md)** — canonical current repository/runtime truth and deferred boundaries.
2. **[active-work-plan.md](active-work-plan.md)** — current queue; currently no active product/runtime implementation scope.
3. **[../AGENTS.md](../AGENTS.md)** — repository invariants and working rules.
4. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone matrix.
5. **[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)** — latest safe checkpoint for current runtime/staging identity and NVIDIA hosted-provider trial closure.

## Current ECX baseline

ECX Recipient Execution **Batch 1–7 is CLOSED / PASS**.

Canonical final ECX checkpoint:

- [verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md)

Earlier Batch 1–6 final checkpoints and WIP records remain under [verification/](verification/) as historical evidence. WIP files marked superseded are not resume pointers.

No Batch 8 is implicitly opened.

## Closed roadmap references

These are historical completed roadmaps, not current queues:

- [product-evolution-architecture.md](product-evolution-architecture.md)
- [product-evolution-roadmap.md](product-evolution-roadmap.md)
- [product-evolution-agent-guide.md](product-evolution-agent-guide.md)
- [post-closure-product-staging-roadmap.md](post-closure-product-staging-roadmap.md)
- [prd.md](prd.md)
- [blueprint.md](blueprint.md)

Current closure state:

- original Batch 1–12 / W / F6 — CLOSED at documented boundaries;
- PE-00..PE-08 — CLOSED / PASS;
- PCS-00..PCS-10 — CLOSED / PASS;
- audit follow-ups through A-11 — CLOSED / PASS;
- ECX Recipient Execution B1–B7 — CLOSED / PASS.

## Architecture / decisions

- [adr/README.md](adr/README.md) — accepted architecture decisions.
- [DECISIONS.md](DECISIONS.md) — chronological decision log.
- [design.md](design.md) — visual/product design system.
- [LICENSING.md](LICENSING.md) — licensing boundary.
- [developer-sdk.md](developer-sdk.md) — developer integration reference.

## Operating runbooks

Use the owner-specific runbook when touching its subsystem:

- [production-activation.md](production-activation.md)
- [production-operations.md](production-operations.md)
- [release-operations.md](release-operations.md)
- [staging-continuous-deployment.md](staging-continuous-deployment.md)
- [sumopod-staging.md](sumopod-staging.md)
- [staging-hardening-backup-observability.md](staging-hardening-backup-observability.md)
- [security-review.md](security-review.md)
- [capability-permission-operations.md](capability-permission-operations.md)
- [spend-budget-operations.md](spend-budget-operations.md)
- [outbound-mcp-operations.md](outbound-mcp-operations.md)
- [extension-operations.md](extension-operations.md)
- [data-rebuild-operations.md](data-rebuild-operations.md)
- [data-governance-dr-operations.md](data-governance-dr-operations.md)
- [offhost-dr-recovery.md](offhost-dr-recovery.md)
- [offhost-dr-physical-independence.md](offhost-dr-physical-independence.md)
- [multimodal-operations.md](multimodal-operations.md)
- [voice-operations.md](voice-operations.md)
- [webhook-operations.md](webhook-operations.md)
- [node-registry-flow-canvas-operations.md](node-registry-flow-canvas-operations.md)
- [space-block-runtime-operations.md](space-block-runtime-operations.md)

## Current staging / DR truth

Latest audited runtime/staging identity:

```text
SHA   = 0f86a34cde66dd541dae9a830ae8cc155e1efe6b
image = staging-0f86a34cde66
```

CI #2380, Product Eval #1619, and actual Staging Deploy #1525 passed. Staging reported healthy Operations, 15/15 services running, exact-SHA match, and 29.89 GiB stabilized free disk.

NVIDIA / NIM is live as a first-class hosted provider with pinned `z-ai/glm-5.3`. The staging hosted gate is enabled under bounded spend controls, but the user's actual NVIDIA secret has not been stored or tested by repository work.

Canonical evidence:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

SumoPod remains **staging, not production**.

Original Off-host DR is CLOSED / PASS at its documented total-SumoPod-host-loss boundary. DR-2 physical independence remains a separate deferred follow-up at checkpoint 2.

## Repository hygiene

The historical branch-hygiene work completed its 393-entry exact-SHA safe-delete set. A later ECX/reconciliation delta was then handled separately and is now **CLOSED / PASS**.

Post-ECX cleanup execution:

- exact-SHA dry-run: 15/15 allowlisted branches eligible, zero hold/fail/skip;
- exact reconciliation refs: 2/2 validated and deleted;
- one-time helper self-deleted;
- final remote inventory: **9 branches**;
- unexpected branches: **0**.

The later NVIDIA trial work also closed its branch delta: cleanup run `36368987090` exact-SHA deleted 3 merged work branches, self-deleted its helper, and again proved a final **9-branch** retained inventory.

Evidence:

- [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- [verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json](verification/post-ecx-branch-cleanup-allowlist-2026-09-27.json)

## Verification / evidence

[verification/](verification/) contains dated audits, WIP checkpoints, closure records, runtime measurements, failed attempts, branch evidence, and safe-resume records.

Use [verification/README.md](verification/README.md) for the evidence index.

Important current pointers:

- current NVIDIA/runtime safe checkpoint: [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)
- repository truth reconciliation: [verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md)
- post-ECX branch cleanup: [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- ECX B7 final checkpoint: [verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md)
- original branch-hygiene closure: [verification/branch-hygiene-safe-checkpoint-2026-09-27.md](verification/branch-hygiene-safe-checkpoint-2026-09-27.md)
- A-11 closure: [verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md](verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md)
- original Off-host DR closure: [verification/offhost-dr-runtime-closure-2026-09-23.md](verification/offhost-dr-runtime-closure-2026-09-23.md)

## Archive

Superseded analysis and old execution summaries belong under [archive/](archive/). Archive content is provenance, not current instruction.
