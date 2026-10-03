# ECORIONE documentation map

Last updated: **2026-10-02**

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
2. **[active-work-plan.md](active-work-plan.md)** — current queue and explicit Session 12/local-first acceptance boundary.
3. **[ai-provider-model-ux-contract.md](ai-provider-model-ux-contract.md)** — accepted and fulfilled Session 4E/4F provider-model product contract.
4. **[../AGENTS.md](../AGENTS.md)** — repository invariants and working rules.
5. **[verification/sumopod-retirement-local-first-transition-2026-10-03.md](verification/sumopod-retirement-local-first-transition-2026-10-03.md)** — current operating transition: SumoPod retired as active staging, Session 12 Native Google Drive active, local-first runtime acceptance.
6. **[EXECUTION-PROGRESS.md](EXECUTION-PROGRESS.md)** — compact milestone matrix.
7. **[verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md)** — prior Ai quick-switch boundary.
8. **[verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md)** — underlying Settings picker closure.
9. **[verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)** — underlying automatic-admission closure.
10. **[verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)** — underlying six-family foundation.
11. **[verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)** — underlying live-discovery closure.
12. **[verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)** — underlying governed registry closure.
13. **[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)** — NVIDIA hosted-provider rollout closure.

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

There is currently **no active remote staging target**. The operator retired SumoPod from current staging operations on 2026-10-03 because the VPS will not be renewed.

Historical evidence remains valid. The last proven actual SumoPod runtime is Session 12A merge `084d669d8631a2590e7a9e88b62e161691bf4fc9` / image `staging-084d669d8631` via Staging Deploy #2183. Later Session 12B/12C remote deploy attempts failed before mutation on the host active-image guard and must not be represented as staging success.

Current GitHub `main` is Session 12C merge `4326e77b2f77aa48a4be075c5fab2ff8b9983655`. Session 12D PR #444 at reviewed head `a6d7073c63d9d0f6581af67c2bef3a599629303e` has CI #2748, Product Eval #1987, MCP #1278, and Browser #446 PASS; local Docker/Compose acceptance is the next gate before merge.

Current pointer:
[verification/sumopod-retirement-local-first-transition-2026-10-03.md](verification/sumopod-retirement-local-first-transition-2026-10-03.md).

DR-2 checkpoint 2 and production promotion remain deferred; local acceptance does not prove either.

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

- current overall safe-resume checkpoint: [verification/session6-external-source-lifecycle-closure-2026-10-01.md](verification/session6-external-source-lifecycle-closure-2026-10-01.md)
- current OpenRouter Session 4C checkpoint: [verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md)
- underlying OpenRouter Session 4B checkpoint: [verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)
- underlying OpenRouter Session 4A checkpoint: [verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)
- underlying OpenRouter Session 3 checkpoint: [verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)
- underlying OpenRouter Session 2 checkpoint: [verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)
- current NVIDIA/runtime safe checkpoint: [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)
- repository truth reconciliation: [verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md)
- post-ECX branch cleanup: [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- ECX B7 final checkpoint: [verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md)
- original branch-hygiene closure: [verification/branch-hygiene-safe-checkpoint-2026-09-27.md](verification/branch-hygiene-safe-checkpoint-2026-09-27.md)
- A-11 closure: [verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md](verification/session-10-a11-browser-workspace-context-closure-2026-09-26.md)
- original Off-host DR closure: [verification/offhost-dr-runtime-closure-2026-09-23.md](verification/offhost-dr-runtime-closure-2026-09-23.md)

## Archive

Superseded analysis and old execution summaries belong under [archive/](archive/). Archive content is provenance, not current instruction.
