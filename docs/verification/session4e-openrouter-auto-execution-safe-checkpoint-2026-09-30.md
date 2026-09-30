# Session 4E OpenRouter Auto-Execution Safe Checkpoint — 2026-09-30

**Status:** CLOSED / PASS / STAGING VERIFIED FOR THIS SLICE · SESSION 4E REMAINS ACTIVE / PARTIAL

## Scope closed by this checkpoint

This checkpoint closes only the first Session 4E runtime slice:

- fresh compatible OpenRouter catalog models are available to the normal Ai model picker without model-by-model user `Test & Enable`;
- selecting a compatible dynamic model creates trusted Connect-owned execution authority;
- input/output catalog pricing is visible before use;
- Connect re-checks fresh exact catalog identity, compatibility, and pricing before paid dynamic dispatch;
- unavailable/stale/incompatible models, mutable aliases, invalid pricing, generic-settings authority bypass, missing credential, spend budget, and kill-switch failures remain fail-closed.

This checkpoint does **not** close all of Session 4E.

## Reviewed PR head

```text
PR                  = #407
reviewed head       = 5b9a29085287db035c2c52dd6ea783c2d93ceac4
merged main         = bb2983d59dbe292c510fbc28aae297bcb23487c4
staging image       = staging-bb2983d59dbe
```

Exact PR-head proof:

- CI #2555 — PASS;
- Product Eval #1794 — PASS;
- PCS-06 Integrated Browser Acceptance #341 — PASS.

Merged-main proof:

- CI #2556 — PASS;
- Product Eval #1795 — PASS.

## Actual staging proof

Staging Deploy #1862 was gate-only and skipped its deploy job. It is not deployment proof.

Staging Deploy #1863 performed the real exact-SHA deployment and passed:

- target SHA `bb2983d59dbe292c510fbc28aae297bcb23487c4`;
- host HEAD matched expected SHA exactly;
- clean detached staging worktree;
- image `staging-bb2983d59dbe`;
- public boundary smoke PASS;
- Operations `healthy: true`;
- configured services: 15;
- running services: 15;
- non-running services: 0;
- host evidence free disk before post-deploy cleanup: 21.81 GiB;
- bounded BuildKit cache pruning ran because free disk was below the 25 GiB target;
- stabilized free disk: 29.89 GiB.

SumoPod remains staging, not production.

## Product behavior now proven

For OpenRouter in the normal Ai flow:

1. catalog discovery/admission remains bounded and Connect-owned;
2. fresh compatible target-family models can appear directly in the model picker;
3. the user does not need to run a separate per-model certification step;
4. selecting a compatible dynamic model activates hosted routing through a trusted Connect mutation, not through generic runtime PATCH;
5. before each paid dynamic completion, Connect re-resolves the selected id against a fresh selectable catalog match and requires valid input/output pricing;
6. catalog price per 1M input/output tokens is visible in the Ai picker;
7. provider-reported billed cost remains authoritative when supplied;
8. stale/incompatible/unavailable models remain blocked.

The persisted field name `openRouterCertifiedModelId` remains for compatibility, but at this Session 4E boundary it is a Connect-owned trusted activation marker for the selected dynamic model; normal users do not need to operate certification vocabulary.

## Session 4E remains open

The accepted product contract is:
[../ai-provider-model-ux-contract.md](../ai-provider-model-ux-contract.md).

Still open:

- canonical adjacent `[Provider / Source ▼] [Model ▼]` controls instead of the technical Local/Hosted route selector;
- direct `+ Tambah AI` onboarding from the Ai page;
- normal per-message provider switching across Local / Anthropic / OpenAI / NVIDIA / OpenRouter;
- bounded Local↔Cloud context handoff without silently uploading all local-only history;
- multi-credential AI Connections with priority/failover under one logical provider.

## Next bounded implementation slice

Implement the canonical Ai provider/model selector surface only:

1. provider/source selector replaces the Local/Hosted technical selector;
2. model selector sits beside it and is provider-specific;
3. switching applies to the next message within the same conversation;
4. Local and configured first-class hosted providers are represented without exposing governance vocabulary;
5. existing credential, spend, sensitivity, Project/history, and Connect authority boundaries remain unchanged;
6. multi-credential persistence and broader context-handoff redesign remain separate unless required by a failing invariant.

## Safe resume order

1. `docs/current-state-and-next-steps.md`;
2. `docs/active-work-plan.md`;
3. `docs/ai-provider-model-ux-contract.md`;
4. this checkpoint;
5. `AGENTS.md`;
6. inspect exact current `main` and current CI/deploy state before coding.

Do not redo the auto-execution slice merely for freshness.
