# OpenRouter Ai Chat Quick-Switch — Session 4D Safe Checkpoint — 2026-09-29

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

Session 4D exposes the governed OpenRouter model-selection semantics from Session 4C directly in the **Ai chat composer** without granting any new runtime execution authority.

The preserved boundary remains:

```text
verified-selectable
  != verified-executable
```

A dynamic model can be visible and selectable in the chat quick-switch, but choosing it does not make it executable.

## Exact reviewed implementation

```text
PR                              = #400
reviewed head                   = 005c1fc6f20c4aec0a8ef2b0f6ea984603032bf0
merge SHA                       = 9bc4cfd1bbfb2b2aed7bef1ec4de24024bd491d7
exact-head CI                   = #2508 PASS
exact-head Product Eval         = #1747 PASS
exact-head browser acceptance   = #303 PASS
merged-main CI                  = #2509 PASS
merged-main Product Eval        = #1748 PASS
```

The final exact head passed formatting, lint, typecheck, the full test suite, Phase 4 real-process acceptance, production-operations acceptance, secret and git-history scans, dependency/toolchain/container/release-security gates, production build, Product Eval, and integrated rendered-browser acceptance.

Earlier implementation heads exposed bounded integration issues only: canonical formatting, source-contract assertions that still expected extracted labels in `page.tsx`, and a browser journey that needed to restore the historical session after exercising a new chat. Those were corrected before the reviewed head above.

## Governed staging proof

```text
runtime / staging SHA    = 9bc4cfd1bbfb2b2aed7bef1ec4de24024bd491d7
staging image            = staging-9bc4cfd1bbfb
previous staging SHA     = e0409afd37bd1f72d9d00a457c27ce6c2de17bda
previous staging image   = staging-e0409afd37bd
Staging Deploy gate      = #1778 PASS / deploy skipped
actual Staging Deploy    = #1779 PASS
public/auth smoke        = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host SHA match           = true
clean host worktree      = true
host evidence free disk  = 24.02 GiB
stabilized free disk     = 25.36 GiB
```

Staging Deploy #1779 deployed the exact runtime merge through the governed least-privilege path.

Public/auth smoke passed for:

- root auth bootstrap redirect;
- protected login, Ops, Settings, Project/history, Brain, Space and Ai mutation surfaces;
- MCP protected-resource metadata;
- MCP unauthenticated challenge.

Sanitized host evidence proved:

- exact expected SHA match;
- detached clean worktree;
- Ubuntu 24.04.4 LTS / Linux 6.8.0-136-generic;
- Docker 29.7.1 / Compose 5.3.1;
- all 15 configured services running;
- zero non-running services.

Operations reported `healthy: true` and no unhealthy services.

SumoPod remains **staging, not production**.

## Ai chat quick-switch behavior

The Ai composer keeps the existing **Local / Hosted route selector**.

When the active hosted provider is OpenRouter, Session 4D additionally exposes an OpenRouter model quick-switch containing:

1. `Governed / Recommended`;
2. existing static `verified-executable` OpenRouter models;
3. Session 4B discovery candidates where `selectable=true`.

Unavailable or non-selectable discovery candidates do not appear.

The presentation component remains free of owner API calls. Settings-backed routing/model orchestration is isolated in the chat routing hook/helper rather than expanding the already-audited chat page.

## One selection authority

The Ai quick-switch does not introduce a second mutation authority.

It reuses the same Connect-owned endpoint established by Session 4C:

```text
PUT /v1/settings/providers/openrouter/model-selection
```

Therefore chat and Settings share the same revalidation and fail-closed behavior.

## Dynamic selectable model behavior

For a candidate where:

```text
admission  = verified-selectable
selectable = true
executable = false
```

the quick-switch may persist:

```text
openRouterModelSelection = <selection id>
```

but Connect keeps execution fail-closed:

```text
hostedProvider           = openrouter
hostedModel              = governed
hostedCallsEnabled       = false
defaultChatTarget        = local
```

The chat UI then converges to **Local** and explicitly reports that the selected model is a preference only and is not yet executable.

There is no silent hosted fallback.

## Governed / executable behavior

Selecting `Governed / Recommended`, or an already governed static executable OpenRouter model, may restore Hosted chat only when the resulting runtime state and credential readiness permit it.

The quick-switch does not bypass:

- hosted credential readiness;
- operator/runtime hosted-call gates;
- Connect model-selection validation;
- existing session route locks.

## Conversation-lock behavior

Model controls are locked once the conversation route is already committed, including after replaying an existing conversation.

The controls are also locked while attachments are active for the session.

This preserves the existing chat-route consistency rule rather than allowing a model switch to reinterpret an already-started conversation.

## Browser acceptance

The exact-head browser acceptance proved that:

- a fresh Ai chat exposes the OpenRouter quick-switch;
- admitted Qwen appears as a selectable-only choice;
- the unavailable mutable DeepSeek alias does not appear;
- selecting Qwen persists the preference and forces the chat route to Local;
- Hosted is disabled while that dynamic choice is non-executable;
- selecting Governed restores Hosted when runtime + credential readiness permit it;
- the historical session can be restored after the quick-switch journey;
- desktop and narrow viewport overflow checks continue to pass.

## Source-concentration boundary

Session 4D does not grow the Ai orchestration page past the A-09 concentration ceiling.

The Settings-backed model logic is extracted into:

```text
apps/ai/app/useChatModelRouting.ts
apps/ai/lib/chat-model-routing.ts
```

The reviewed Ai page remains below the existing **40,000-character** A-09 ceiling rather than raising that limit.

`ChatPageSections.tsx` remains presentation-only and fetch-free.

## Execution authority remains unchanged

Session 4D changes the **chat selection surface**, not the executable registry.

Current OpenRouter executable authority remains the static governed pair:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Session 4D does **not**:

- create a dynamic `PinnedModelId`;
- create runtime pricing identity from remote catalog pricing;
- promote GPT, Gemini, Qwen, DeepSeek, Kimi, or GLM candidates to executable;
- weaken pre-dispatch spend reservation;
- change provider-reported OpenRouter billed-cost authority;
- change RESTRICTED routing;
- change credential ownership;
- add silent fallback;
- claim real multi-family execution evidence;
- promote staging to production.

## Session ordering preserved

The remaining OpenRouter scopes stay separate:

```text
Session 4E = real multi-family OpenRouter execution validation
Session 4F = final OpenRouter polish / closure
```

Session 4E is the next eligible OpenRouter runtime scope, but it is **not active implicitly**.

Real multi-family compatibility, pricing/spend-boundary admission, provider-call evidence, and promotion from selectable preference to executable authority remain Session 4E work.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-29.md`;
6. use this checkpoint as the Session 4D chat quick-switch boundary;
7. use Session 4C as the governed Settings selection/mutation boundary;
8. use Session 4B as the automatic-admission boundary;
9. use Session 4A as the family-classification boundary;
10. use Session 3 as the discovery/cache boundary;
11. use Session 2 as the static registry/execution compatibility boundary;
12. start Session 4E only after explicit operator authorization.

## Bottom line

ECORIONE can now switch governed OpenRouter preferences directly from the Ai chat composer while preserving the exact same fail-closed authority used by Settings.

A dynamic `verified-selectable` model may be chosen as a preference, but chat returns to Local and hosted execution stays disabled until a later separately authorized execution-validation scope proves that exact model.

Session 4D is **CLOSED / PASS / STAGING VERIFIED**.
