# OpenRouter Settings Model Picker — Session 4C Safe Checkpoint — 2026-09-29

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

Session 4C turns the Session 4B OpenRouter admission result into a governed **Settings model-selection surface** without granting new runtime execution authority.

The preserved boundary is:

```text
verified-selectable
  != verified-executable
```

A model may now be chosen as an OpenRouter preference in Settings while hosted execution remains fail-closed until a later separately authorized execution-validation scope proves that exact model.

## Exact reviewed implementation

```text
PR                              = #398
reviewed head                   = 2407d00f03f0f29422da9e78bc07aff675f846d2
merge SHA                       = c65926de418046494d2e961af10662d2eadca37c
exact-head CI                   = #2491 PASS
exact-head Product Eval         = #1730 PASS
exact-head browser acceptance   = #289 PASS
merged-main CI                  = #2492 PASS
merged-main Product Eval        = #1731 PASS
```

The final exact head passed formatting, lint, typecheck, the full test suite, Phase 4 real-process acceptance, production-operations acceptance, secret and git-history scans, dependency/toolchain/container/release-security gates, production build, Product Eval, and integrated rendered-browser acceptance.

Earlier PR attempts were not merged. One exposed canonical Prettier output and another exposed one incorrect regression-test expectation after the backward-compatibility rule was tightened. Both were corrected before the reviewed head above.

## Governed staging proof

```text
runtime / staging SHA    = c65926de418046494d2e961af10662d2eadca37c
staging image            = staging-c65926de4180
Staging Deploy gate      = #1744 PASS / deploy skipped
actual Staging Deploy    = #1745 PASS
public/auth smoke        = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host SHA match           = true
clean host worktree      = true
host evidence free disk  = 21.86 GiB
stabilized free disk     = 29.93 GiB
```

Staging Deploy #1745 deployed the exact reviewed merge SHA through the governed least-privilege path. The previous deployed revision was `4547f0d80deb4fb18d0cd6e6d7a1f2f25c506409`.

Public/auth smoke passed for the login bootstrap, protected Settings/Ops/project/history/Brain/Space and mutation surfaces, and the separate MCP protected-resource / unauthenticated-challenge boundary.

Sanitized host evidence proved:

- exact expected SHA match;
- detached clean worktree;
- Ubuntu 24.04.4 LTS / Linux 6.8.0-136-generic / x86_64;
- Docker 29.7.1 / Compose 5.3.1;
- all 15 configured services running;
- zero non-running services.

Operations reported `healthy: true` and no unhealthy services. BuildKit cache was pruned after the host-evidence snapshot because free disk was below the 25 GiB target; capacity stabilized at **29.93 GiB free**.

SumoPod remains **staging, not production**.

## Settings picker behavior

When the active hosted provider is OpenRouter, the Settings picker now combines:

1. `Governed / Recommended`;
2. existing static `verified-executable` OpenRouter models;
3. fresh Session 4B candidates where `selectable=true`.

Dynamic selectable entries remain visually distinguishable from executable entries.

The Session 4C browser acceptance proves that a valid Qwen candidate can appear in the picker while an unavailable mutable DeepSeek alias does not leak into the picker.

## Separate persisted preference

Session 4C adds a separate runtime-setting field:

```text
openRouterModelSelection
```

It is intentionally distinct from:

```text
hostedModel
```

The new field is optional for backward compatibility. Existing installations that already store a static OpenRouter `hostedModel` continue to display that legacy selection when `openRouterModelSelection` is absent.

This prevents a schema default from silently replacing a previously selected executable model with `governed`.

## Connect-owned selection authority

OpenRouter model selection must pass through the dedicated Connect-owned mutation:

```text
PUT /v1/settings/providers/openrouter/model-selection
```

A generic runtime mutation is not allowed to change `openRouterModelSelection` to a different value.

The dedicated endpoint re-evaluates the requested model against current OpenRouter admission state before persisting it.

This protects against:

- arbitrary model-id injection;
- stale discovery snapshots;
- previously selectable candidates that are no longer selectable;
- unavailable aliases or malformed candidates;
- accidental equivalence between picker eligibility and execution authority.

## Fail-closed selection semantics

### Governed / Recommended

Selecting `governed` preserves the existing governed executable path:

```text
hostedProvider           = openrouter
hostedModel              = governed
openRouterModelSelection = governed
hostedCallsEnabled       = true
defaultChatTarget        = hosted
```

### Static verified executable model

Selecting an existing static executable OpenRouter registry entry activates that exact governed model:

```text
openRouterModelSelection = <verified registry id>
hostedModel              = <same verified registry id>
hostedCallsEnabled       = true
defaultChatTarget        = hosted
```

This path does not require live discovery because executable authority comes from the governed registry.

### Dynamic verified-selectable model

Selecting a Session 4B candidate where:

```text
admission  = verified-selectable
selectable = true
executable = false
```

persists the preference but deliberately disables hosted execution:

```text
hostedProvider           = openrouter
openRouterModelSelection = <admitted runtime selection id>
hostedModel              = governed
hostedCallsEnabled       = false
defaultChatTarget        = local
```

This is the core Session 4C safety behavior.

There is **no silent fallback** where a newly selected dynamic model causes the previous OpenRouter model to continue executing while the UI implies otherwise.

## Re-validation on save

Discovery display state alone is not trusted as mutation authority.

When a dynamic OpenRouter preference is saved, Connect re-runs the current bounded discovery/admission lookup for that exact selection id.

If the candidate is no longer selectable, the mutation fails explicitly with:

```text
OPENROUTER_MODEL_NOT_SELECTABLE
```

and the runtime settings remain unchanged.

Stale catalog withdrawal from Session 4B therefore continues to protect the Session 4C mutation path.

## Execution authority remains unchanged

Session 4C changes the **selection surface**, not the executable registry.

The current OpenRouter executable authority remains the static verified pair:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

New GPT, Gemini, Qwen, DeepSeek, Kimi, or GLM candidates do not become executable merely because they appear in the picker.

Session 4C does not:

- create a dynamic `PinnedModelId`;
- create an admitted runtime pricing identity from remote catalog pricing;
- weaken pre-dispatch spend reservation;
- change provider-reported OpenRouter billed-cost authority;
- change RESTRICTED routing;
- change provider credential ownership;
- add silent fallback;
- implement the Ai chat quick-switch;
- claim real multi-family execution evidence;
- promote staging to production.

## Source-concentration boundary

During implementation the Settings page temporarily exceeded the previously audited 30,000-byte concentration ceiling.

The picker was extracted into:

```text
apps/ai/app/settings/HostedModelPicker.tsx
```

The reviewed head keeps the major Settings sources below that ceiling:

```text
apps/ai/app/settings/page.tsx                  = 27,908 bytes
apps/ai/app/settings/useSettingsController.ts  = 28,762 bytes
```

The threshold was not raised.

## Session ordering preserved

The remaining OpenRouter scopes stay separate:

```text
Session 4D = Ai chat quick-switch
Session 4E = real multi-family OpenRouter execution validation
Session 4F = final polish / closure
```

Session 4D may expose an already-governed selection affordance in the Ai chat surface, but it must not independently grant executable authority.

Session 4E remains the explicit place for real multi-family runtime compatibility, pricing/spend-boundary admission, provider-call evidence, and promotion from selectable preference to executable authority.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-29.md`;
6. use this checkpoint as the Session 4C picker boundary;
7. use Session 4B as the automatic-admission boundary;
8. use Session 4A as the family-classification boundary;
9. use Session 3 as the discovery/cache boundary;
10. use Session 2 as the static registry/execution compatibility boundary;
11. start Session 4D only after explicit operator authorization.

## Bottom line

ECORIONE Settings can now present and persist automatically admitted OpenRouter candidates without pretending they are executable.

Static verified models can still activate normally. Dynamic `verified-selectable` candidates can be chosen as a user preference, but saving one shuts hosted execution off and returns the default chat route to local until a later execution-validation scope separately proves and admits that exact model.

Session 4C is **CLOSED / PASS / STAGING VERIFIED**.
