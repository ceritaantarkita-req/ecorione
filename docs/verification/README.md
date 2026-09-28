# Verification evidence

Current overall resume pointer: [ecorione-safe-resume-checkpoint-2026-09-28.md](ecorione-safe-resume-checkpoint-2026-09-28.md).

This directory contains **dated evidence**, not current planning.

Use current repository state from:

1. `../current-state-and-next-steps.md`
2. `../active-work-plan.md`
3. `../../AGENTS.md`

Historical evidence may contain statements that were correct at the time but are no longer current. Preserve those statements; do not reinterpret them as the active queue.

## Latest repository truth

- [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md) — latest FINAL / CLOSED / PASS runtime checkpoint: bounded OpenRouter live discovery/search/filter/cache deployed at `af2ef8f...` / `staging-af2ef8f61f26`; discovered-only models remain non-executable and the selectable set remains the two verified Claude models.
- [openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md) — underlying Session 2 registry checkpoint: extensible fail-closed hosted-model registry and admitted pricing/execution boundary.
- [nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md](nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md) — latest FINAL / CLOSED / PASS runtime checkpoint: NVIDIA credential/canary testing is bounded and failure-explicit; PR #387 is deployed at `59961422...` / `staging-59961422e11d`.
- [nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](nvidia-hosted-provider-safe-checkpoint-2026-09-28.md) — underlying provider rollout checkpoint: NVIDIA provider live, staging operator hosted gate bounded/open, Docker native-build defect closed, and the prior runtime baseline converged at `0f86a34c...`.
- [repository-truth-reconciliation-2026-09-27.md](repository-truth-reconciliation-2026-09-27.md) — prior audit/reconciliation of `main`, staging, docs drift and post-ECX branch delta.
- [post-ecx-branch-cleanup-execution-2026-09-28.md](post-ecx-branch-cleanup-execution-2026-09-28.md) — FINAL / CLOSED / PASS execution record for the post-ECX branch delta; 17 targeted branches were deleted, the helper self-deleted, and final remote inventory returned to 9 branches.
- [post-ecx-branch-cleanup-allowlist-2026-09-27.json](post-ecx-branch-cleanup-allowlist-2026-09-27.json) — exact-SHA classification/revalidation source for the 15 ECX branches, now paired with completed execution evidence.
- [branch-hygiene-safe-checkpoint-2026-09-27.md](branch-hygiene-safe-checkpoint-2026-09-27.md) — historical final checkpoint for the earlier 393-branch cleanup. Its 9-branch inventory is correct for that checkpoint but is not the current inventory after later ECX work.

## ECX Recipient Execution

Canonical final checkpoint:

- [ecx-execution-b7-safe-checkpoint-2026-09-27.md](ecx-execution-b7-safe-checkpoint-2026-09-27.md) — Batch 7 CLOSED / PASS; ECX Recipient Execution B1–B7 roadmap CLOSED / PASS; no implicit Batch 8.

Earlier final checkpoints:

- [ecx-execution-b6-safe-checkpoint-2026-09-27.md](ecx-execution-b6-safe-checkpoint-2026-09-27.md)
- [ecx-execution-b5-safe-checkpoint-2026-09-27.md](ecx-execution-b5-safe-checkpoint-2026-09-27.md)
- [ecx-execution-b4-safe-checkpoint-2026-09-27.md](ecx-execution-b4-safe-checkpoint-2026-09-27.md)
- [ecx-execution-b3-safe-checkpoint-2026-09-27.md](ecx-execution-b3-safe-checkpoint-2026-09-27.md)
- [ecx-execution-b2-safe-checkpoint-2026-09-27.md](ecx-execution-b2-safe-checkpoint-2026-09-27.md)
- [ecx-recipient-execution-b1-safe-checkpoint-2026-09-27.md](ecx-recipient-execution-b1-safe-checkpoint-2026-09-27.md)

Files named `*-wip-checkpoint-*` are preserved implementation evidence and are explicitly superseded by the corresponding final checkpoint. Do not use them as resume pointers.

## Repository / branch hygiene

- [repository-documentation-reconciliation-2026-09-26.md](repository-documentation-reconciliation-2026-09-26.md) — prior repository/docs reconciliation before the later branch-hygiene and ECX work.
- [branch-hygiene-audit-2026-09-27.md](branch-hygiene-audit-2026-09-27.md) — historical classification work.
- [branch-hygiene-execution-2026-09-27.md](branch-hygiene-execution-2026-09-27.md) — destructive cleanup execution evidence.
- [branch-hygiene-safe-checkpoint-2026-09-27.md](branch-hygiene-safe-checkpoint-2026-09-27.md) — historical closure of the 393-entry cleanup set.
- [repository-truth-reconciliation-2026-09-27.md](repository-truth-reconciliation-2026-09-27.md) — current post-ECX reconciliation and closure context.
- [post-ecx-branch-cleanup-execution-2026-09-28.md](post-ecx-branch-cleanup-execution-2026-09-28.md) — completed exact-SHA post-ECX cleanup.

Do not rerun the historical 393-branch classification from zero. New branch work must be handled as a delta against current Git state.

## Audit follow-up closure

Latest bounded A-series checkpoint:

- [session-10-a11-browser-workspace-context-closure-2026-09-26.md](session-10-a11-browser-workspace-context-closure-2026-09-26.md)

The earlier current-main/staging audit remains the source of historical findings:

- [current-main-staging-audit-2026-09-24.md](current-main-staging-audit-2026-09-24.md)

Selected follow-ups through A-11 are closed at their documented scopes. Do not reopen them for freshness alone.

## Staging / deployment

Use current operational runbooks in `docs/` for procedure.

Important dated proof includes:

- governed GitHub -> SumoPod staging deployment evidence;
- staging capacity recovery and auto-deploy restoration;
- deployment-pipeline hardening;
- A-series exact-SHA staging acceptance;
- ECX Batch 1–7 staging deliveries;
- NVIDIA provider implementation and rollout;
- failed Staging Deploy #1505 with successful rollback evidence;
- current exact staging proof at Staging Deploy #1675.

Current exact runtime/staging identity is recorded in [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md), not inferred from older deployment documents.

## Off-host DR

Canonical original runtime closure:

- [offhost-dr-runtime-closure-2026-09-23.md](offhost-dr-runtime-closure-2026-09-23.md)

DR-2 checkpoint material remains separate:

- [offhost-dr2-safe-checkpoint-2026-09-23.md](offhost-dr2-safe-checkpoint-2026-09-23.md)
- [offhost-dr2-checkpoint-2-selection-package-2026-09-23.md](offhost-dr2-checkpoint-2-selection-package-2026-09-23.md)
- [offhost-dr2-checkpoint-2-deferment-2026-09-23.md](offhost-dr2-checkpoint-2-deferment-2026-09-23.md)

Original DR is CLOSED / PASS at its documented boundary. DR-2 physical independence is not yet proven.

## Evidence rules

- preserve failed evidence;
- preserve superseded WIP evidence when it explains implementation history;
- do not edit old evidence just to make it read like current state;
- keep raw/private runtime data out of Git;
- commit sanitized summaries only;
- claims must stay within the exact tested boundary;
- staging evidence is not production proof;
- one-drill timing evidence is not an SLA;
- paid-provider evidence is not rerun merely for freshness.
