# Verification evidence

- [session12d-repository-green-local-acceptance-pending-2026-10-04.md](session12d-repository-green-local-acceptance-pending-2026-10-04.md) — CURRENT repository truth: main `bd8d251...`, PR #444 exact head `1e4f58c7...`, all five exact-head gates PASS, automated/mock acceptance CLOSED / PASS, real local Google OAuth + Picker acceptance still pending.
- [sumopod-retirement-local-first-transition-2026-10-03.md](sumopod-retirement-local-first-transition-2026-10-03.md) — HISTORICAL operating transition that retired SumoPod from active staging.

Current overall resume pointer: [session12d-repository-green-local-acceptance-pending-2026-10-04.md](session12d-repository-green-local-acceptance-pending-2026-10-04.md).

This directory contains **dated evidence**, not current planning.

Use current repository state from:

1. `../current-state-and-next-steps.md`
2. `../active-work-plan.md`
3. `../../AGENTS.md`

Historical evidence may contain statements that were correct at the time but are no longer current. Preserve those statements; do not reinterpret them as the active queue.

## Latest repository truth

- [ecorione-safe-resume-checkpoint-2026-10-02.md](ecorione-safe-resume-checkpoint-2026-10-02.md) — current SAFE RESUME pointer: Git main `81fce027...` is docs-only; staging runtime/control remains `7130dba720cf...` / `staging-7130dba720cf`; Sessions 4E–11 and post-Session-11 CD hardening are closed; no implementation session is active; local laptop sync was not claimed because Desktop Commander was offline.
- [session11-mcp-action-product-convergence-closure-2026-10-02.md](session11-mcp-action-product-convergence-closure-2026-10-02.md) — current product/runtime closure for Session 11 MCP Action convergence and post-closure CD hardening evidence.
- [session6-external-source-lifecycle-closure-2026-10-01.md](session6-external-source-lifecycle-closure-2026-10-01.md) — prior FINAL / CLOSED / PASS / STAGING VERIFIED runtime checkpoint: PR #421 merged as `15f007c5d248...`, merged-main CI #2610, Product Eval #1849, and MCP External HTTPS #1204 passed, Staging Deploy #1968 deployed `staging-15f007c5d248`, public/auth + MCP smoke passed, Operations was healthy, 15/15 services were running, and free disk stabilized at 27.39 GiB.
- [session6-external-source-lifecycle-local-acceptance-checkpoint-2026-10-01.md](session6-external-source-lifecycle-local-acceptance-checkpoint-2026-10-01.md) — pre-merge local acceptance evidence for URL/MCP snapshot lifecycle, refresh/index semantics, direct text indexing, re-index, detach provenance, and reversible temporary-Project cleanup.
- [session5-project-source-picker-closure-2026-10-01.md](session5-project-source-picker-closure-2026-10-01.md) — prior FINAL / CLOSED / PASS / STAGING VERIFIED runtime checkpoint: PR #419 merged as `12d62cd436ce...`, merged-main CI #2605 and Product Eval #1844 passed, Staging Deploy #1958 deployed `staging-12d62cd436ce`, public/auth + MCP smoke passed, Operations was healthy, 15/15 services were running, and free disk stabilized at 25.27 GiB.
- [session5-project-source-picker-local-acceptance-checkpoint-2026-10-01.md](session5-project-source-picker-local-acceptance-checkpoint-2026-10-01.md) — pre-merge local acceptance evidence for the searchable Project Source Picker, owner catalogs, reversible Artifact/Space/Flow binding, and healthy-empty MCP registry.
- [session4ef-closure-2026-10-01.md](session4ef-closure-2026-10-01.md) — prior FINAL / CLOSED / PASS / STAGING VERIFIED closure for Session 4E custom-provider/Local↔Hosted integration and Session 4F provider-model UX.
- [openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md) — prior FINAL / CLOSED / PASS / STAGING VERIFIED runtime checkpoint: governed Ai chat quick-switch deployed at `9bc4cfd1...` / `staging-9bc4cfd1bbfb`; dynamic `verified-selectable` preferences remain non-executable and force chat back to Local.
- [openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md) — underlying governed Settings picker checkpoint; dynamic `verified-selectable` preferences remain non-executable and fail closed on save.
- [openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md) — underlying automatic fail-closed target-family admission checkpoint.
- [openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md) — underlying Session 4A family checkpoint: version-agnostic GPT/Gemini/Qwen/DeepSeek/Kimi/GLM classification foundation.
- [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md) — underlying Session 3 discovery checkpoint: bounded OpenRouter live discovery/search/filter/cache deployed at `af2ef8f...` / `staging-af2ef8f61f26`; discovered-only models remain non-executable and the selectable set remains the two verified Claude models.
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
- current exact runtime/control staging proof at Staging Deploy #2146;
- later docs-only main commits are expected to gate-pass and skip deploy.

Current safe-resume identity and the distinction between Git main and staging runtime are recorded in [ecorione-safe-resume-checkpoint-2026-10-02.md](ecorione-safe-resume-checkpoint-2026-10-02.md), not inferred from older deployment documents.

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
