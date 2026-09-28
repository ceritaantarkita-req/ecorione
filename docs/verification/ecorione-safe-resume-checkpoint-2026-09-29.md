# ECORIONE — Safe Resume Checkpoint — 2026-09-29

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff after OpenRouter Session 4C completed the governed Settings model picker on top of the already-closed registry, discovery, family, and automatic-admission foundations.

Do not restart completed roadmaps from older planning notes.

## Repository / runtime boundary

```text
repository                         = ceritaantarkita-req/ecorione
latest runtime-changing merge      = c65926de418046494d2e961af10662d2eadca37c
runtime PR                         = #398
reviewed implementation head       = 2407d00f03f0f29422da9e78bc07aff675f846d2
exact-head CI                      = #2491 PASS
exact-head Product Eval            = #1730 PASS
exact-head browser acceptance      = #289 PASS
merged-main CI                     = #2492 PASS
merged-main Product Eval           = #1731 PASS
actual Staging Deploy              = #1745 PASS
staging image                      = staging-c65926de4180
```

The preceding Staging Deploy #1744 was a successful prerequisite gate with the deploy job skipped. #1745 performed the actual deployment after both merged-main prerequisites were green.

## Staging truth

```text
public/auth smoke        = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host SHA match           = true
clean worktree           = true
host evidence free disk  = 21.86 GiB
stabilized free disk     = 29.93 GiB
```

SumoPod remains **staging, not production**.

## Closed OpenRouter sequence

The following scopes are closed at their documented boundaries:

- Session 2 — governed/extensible model registry;
- Session 3 — bounded live OpenRouter discovery/search/filter/cache;
- Session 4A — Connect-owned six-family classification;
- Session 4B — automatic fail-closed selection admission;
- Session 4C — governed Settings model picker.

Canonical Session 4C evidence:

- [openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md)

Underlying evidence:

- [openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)
- [openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)
- [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)
- [openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)

## Current OpenRouter model-state contract

The important distinction is:

```text
discovered
  != selectable

selectable
  != executable
```

Session 4B may grant:

```text
admission  = verified-selectable
selectable = true
executable = false
```

Session 4C may then persist that candidate as:

```text
openRouterModelSelection = <selection id>
```

but it does not promote the candidate into executable `hostedModel` authority.

For a dynamic non-executable selection, Session 4C intentionally converges runtime state to:

```text
hostedProvider     = openrouter
hostedModel        = governed
hostedCallsEnabled = false
defaultChatTarget  = local
```

There is no silent fallback to the previously executable OpenRouter model.

## Current OpenRouter executable boundary

Executable authority remains the static governed registry.

Current OpenRouter executable entries remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Dynamic GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM candidates may be discovered, classified, automatically admitted as selectable, and chosen in Settings, but are not executable until a later explicit execution-validation boundary admits them.

## Session 4C mutation boundary

OpenRouter picker changes are Connect-owned.

The dedicated path is:

```text
PUT /v1/settings/providers/openrouter/model-selection
```

The generic runtime endpoint cannot be used to change `openRouterModelSelection` to a different value.

A dynamic selection is revalidated against the current admission snapshot on save. Stale/unavailable/non-admitted candidates fail closed.

The field is optional in persisted runtime settings so older installations that already store an executable OpenRouter `hostedModel` remain backward compatible.

## Other closed work

Do not restart the following merely for freshness:

- original Batch 1–12 / W / F6;
- Product Evolution PE-00..PE-08;
- PCS-00..PCS-10;
- selected audit follow-ups through A-11;
- original Off-host DR drill;
- repository/documentation reconciliation;
- historical/post-ECX branch cleanup programs;
- ECX Recipient Execution Batch 1–7;
- NVIDIA / NIM hosted-provider rollout and connection-test hardening.

Open Issue #277 remains the deferred DR-2 physical-independence tracker; it is not active runtime work.

## Current active work

There is **no active product/runtime implementation scope** after the Session 4C runtime merge and staging proof.

The documentation-closure branch is bookkeeping only.

## Separately selectable future scopes

None of these is active implicitly:

- **Session 4D — Ai chat quick-switch**;
- Session 4E — real multi-family OpenRouter execution validation;
- Session 4F — final OpenRouter polish / closure;
- DR-2 checkpoint 2 / physical-independence runtime proof;
- public production promotion/cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- external A2A interoperability;
- recursive agent graphs;
- broader ECX/History UI;
- AutoClick / L4 autonomy.

## Session ordering rule

Session 4D must not smuggle Session 4E into scope.

A quick-switch may only surface the governed selection semantics already established by Session 4C. It must preserve:

- `verified-selectable != verified-executable`;
- Connect ownership of admission/selection validation;
- no dynamic `PinnedModelId` creation;
- pre-dispatch spend authority;
- RESTRICTED routing;
- provider credential ownership;
- explicit fail-closed behavior.

Real multi-family OpenRouter execution remains Session 4E.

## Safe resume instructions

For a new session or agent:

1. inspect exact current `main`;
2. read [../current-state-and-next-steps.md](../current-state-and-next-steps.md);
3. read [../active-work-plan.md](../active-work-plan.md);
4. read [../../AGENTS.md](../../AGENTS.md);
5. read the Session 4C checkpoint linked above;
6. treat all older dated checkpoints as evidence, not as an active queue;
7. open Session 4D only after explicit operator authorization.

## Bottom line

The safe current state is:

```text
Sessions 2 / 3 / 4A / 4B / 4C = CLOSED / PASS
Session 4C staging              = VERIFIED
Session 4D                     = next eligible, NOT active
dynamic selectable model       = preference-capable, NOT executable
production cutover             = NOT authorized
```
