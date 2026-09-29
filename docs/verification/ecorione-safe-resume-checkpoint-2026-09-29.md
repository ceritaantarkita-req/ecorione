# ECORIONE — Safe Resume Checkpoint — 2026-09-29

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff after OpenRouter Session 4D completed the governed Ai chat quick-switch on top of the already-closed registry, discovery, family, automatic-admission, and Settings-selection foundations.

Do not restart completed roadmaps from older planning notes.

## Repository / runtime boundary

```text
repository                         = ceritaantarkita-req/ecorione
latest runtime-changing merge      = 9bc4cfd1bbfb2b2aed7bef1ec4de24024bd491d7
runtime PR                         = #400
reviewed implementation head       = 005c1fc6f20c4aec0a8ef2b0f6ea984603032bf0
exact-head CI                      = #2508 PASS
exact-head Product Eval            = #1747 PASS
exact-head browser acceptance      = #303 PASS
merged-main CI                     = #2509 PASS
merged-main Product Eval           = #1748 PASS
actual Staging Deploy              = #1779 PASS
staging image                      = staging-9bc4cfd1bbfb
```

The preceding Staging Deploy #1778 was a successful prerequisite gate with the deploy job skipped. #1779 performed the actual deployment after both merged-main prerequisites were green.

## Staging truth

```text
public/auth smoke        = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host SHA match           = true
clean worktree           = true
host evidence free disk  = 24.02 GiB
stabilized free disk     = 25.36 GiB
```

SumoPod remains **staging, not production**.

## Closed OpenRouter sequence

The following scopes are closed at their documented boundaries:

- Session 2 — governed/extensible model registry;
- Session 3 — bounded live OpenRouter discovery/search/filter/cache;
- Session 4A — Connect-owned six-family classification;
- Session 4B — automatic fail-closed selection admission;
- Session 4C — governed Settings model picker;
- Session 4D — governed Ai chat quick-switch.

Canonical Session 4D evidence:

- [openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md)

Underlying evidence:

- [openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md)
- [openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)
- [openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)
- [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)
- [openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)

## Current OpenRouter model-state contract

The important distinction remains:

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

Session 4C may persist that candidate as:

```text
openRouterModelSelection = <selection id>
```

Session 4D may expose the same governed selection in the Ai chat composer, but it still does not promote the candidate into executable `hostedModel` authority.

For a dynamic non-executable selection, Sessions 4C/4D intentionally converge runtime state to:

```text
hostedProvider     = openrouter
hostedModel        = governed
hostedCallsEnabled = false
defaultChatTarget  = local
```

There is no silent fallback to a previously executable OpenRouter model.

## Current OpenRouter executable boundary

Executable authority remains the static governed registry.

Current OpenRouter executable entries remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Dynamic GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM candidates may be discovered, classified, automatically admitted as selectable, and chosen in Settings or Ai chat, but are not executable until a later explicit execution-validation boundary admits them.

## Shared selection authority

Settings and Ai chat use the same Connect-owned selection mutation:

```text
PUT /v1/settings/providers/openrouter/model-selection
```

A dynamic selection is revalidated against current admission state before persistence. Stale, unavailable, or non-admitted candidates fail closed.

The Ai chat quick-switch does not create a second model authority.

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

There is **no active product/runtime implementation scope** after the Session 4D runtime merge and staging proof.

The documentation-closure branch is bookkeeping only.

## Separately selectable future scopes

None of these is active implicitly:

- **Session 4E — real multi-family OpenRouter execution validation**;
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

Session 4E remains separate from the now-closed selection surfaces.

It must not infer executable authority from Session 4B selectability or Session 4C/4D user preference.

Any future multi-family execution work must preserve:

- `verified-selectable != verified-executable`;
- Connect ownership of model/runtime authority;
- no unproven dynamic `PinnedModelId`;
- admitted pricing identity before execution;
- pre-dispatch spend authority;
- RESTRICTED routing;
- provider credential ownership;
- explicit fail-closed behavior.

## Safe resume instructions

For a new session or agent:

1. inspect exact current `main`;
2. read [../current-state-and-next-steps.md](../current-state-and-next-steps.md);
3. read [../active-work-plan.md](../active-work-plan.md);
4. read [../../AGENTS.md](../../AGENTS.md);
5. read the Session 4D checkpoint linked above;
6. treat all older dated checkpoints as evidence, not as an active queue;
7. open Session 4E only after explicit operator authorization.

## Bottom line

The safe current state is:

```text
Sessions 2 / 3 / 4A / 4B / 4C / 4D = CLOSED / PASS
Session 4D staging                    = VERIFIED
Session 4E                            = next eligible, NOT active
dynamic selectable model             = preference-capable, NOT executable
production cutover                   = NOT authorized
```
