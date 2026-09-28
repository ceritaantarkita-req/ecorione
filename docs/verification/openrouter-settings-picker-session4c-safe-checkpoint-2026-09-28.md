# OpenRouter Settings Model Picker — Session 4C Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

Session 4C turns the selection eligibility produced by Session 4B into a governed Settings model picker without collapsing selection preference into runtime execution authority.

The key invariant remains:

```text
verified-selectable != verified-executable
```

A dynamic OpenRouter candidate may be selected as a Settings preference after fresh admission succeeds, while runtime execution remains fail-closed until separately proven and admitted.

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

A temporary Prettier diagnostic commit was used only to obtain the exact formatter output after CI identified three formatting-only files. The diagnostic `package.json` change was removed before reviewed head `2407d00f...`; `package.json` is not part of the final Session 4C runtime diff.

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
host evidence free disk  = 21.86 GiB
stabilized free disk     = 29.93 GiB
```

Staging Deploy #1745 used the governed least-privilege path and executed `deploy c65926de418046494d2e961af10662d2eadca37c`. The resulting image is `staging-c65926de4180`.

Public/auth smoke passed for the root/login, Operations, Settings, Projects/history, Brain, Space, chat/forget mutation, and MCP protected-resource/challenge boundaries. Operations was healthy on the first readiness attempt. Host evidence matched the exact expected SHA and showed zero non-running services.

SumoPod remains **staging, not production**.

## Settings picker contract

Session 4C adds a separate OpenRouter picker preference:

```text
openRouterModelSelection
```

It is intentionally distinct from the existing executable runtime field:

```text
hostedModel
```

This prevents a discovery-admitted string from becoming runtime execution authority merely because the user selected it in Settings.

The Settings picker now composes:

- Governed / Recommended;
- existing static OpenRouter models that are already `verified-executable`;
- fresh Session 4B candidates with `selectable=true` and a non-null `selectionId`.

Unavailable or discovery-only candidates do not enter the picker.

Legacy runtime settings remain compatible: if the new picker field is absent, an existing OpenRouter `hostedModel` remains the effective displayed selection rather than being overwritten by a synthetic default.

## Connect-owned save boundary

OpenRouter picker changes are saved through the dedicated mutation:

```text
PUT /v1/settings/providers/openrouter/model-selection
{ "selectionId": "..." }
```

Generic runtime mutation cannot change the picker preference to a different value. This prevents API/UI bypass of the admission boundary.

For a static already-executable OpenRouter registry entry:

- Connect resolves it from the governed executable registry;
- live discovery is not required;
- the selected model may become the active hosted model, subject to the existing operator/spend controls.

For a dynamic Session 4B candidate:

- Connect re-runs discovery/admission lookup for the requested exact `selectionId`;
- the candidate must still be `selectable`;
- stale, unavailable, malformed, or non-admitted candidates are rejected with `OPENROUTER_MODEL_NOT_SELECTABLE`;
- successful preference save does **not** grant execution.

## Fail-closed dynamic selection

When a dynamic `verified-selectable` model is saved, runtime state is deliberately forced to:

```text
hostedProvider            = openrouter
openRouterModelSelection  = <selected dynamic id>
hostedModel               = governed
hostedCallsEnabled        = false
defaultChatTarget         = local
```

The response reports:

```text
executable = false
active     = false
```

This is deliberate. There is no silent fallback to a previously executable OpenRouter model.

The user can therefore express a governed preference for a newly admitted GPT, Gemini, Qwen, DeepSeek, Kimi, or GLM candidate without accidentally authorizing dispatch.

## Regression and browser evidence

Deterministic coverage includes:

- separate persistence of OpenRouter picker preference from executable `hostedModel`;
- legacy settings compatibility when the new field is absent;
- rejection of generic runtime-mutation bypass;
- dynamic `verified-selectable` save with hosted execution forced OFF/local;
- stale/non-selectable candidate rejection;
- static verified executable selection without live-catalog dependency;
- Settings proxy method/path/query constraints;
- integrated rendered-browser picker behavior.

Browser acceptance proves that:

- a valid Qwen Session 4B candidate appears in the Settings picker;
- saving it persists the Qwen preference;
- hosted execution remains OFF and the default route becomes local;
- the executable `hostedModel` remains `governed`;
- a mutable/unavailable DeepSeek alias does not leak into the picker;
- there is no silent runtime fallback.

## Execution authority remains unchanged

Session 4C does not create dynamic executable registry/pricing identities.

The established runtime authority boundary remains:

- executable dispatch requires an existing governed executable provider/model registry entry and pricing/spend authority;
- dynamic Session 4B candidates remain `executable=false`;
- provider-reported OpenRouter billed cost remains authoritative for actual billed cost;
- pre-dispatch spend reservation remains unchanged;
- Governed / Recommended and RESTRICTED policy remain unchanged;
- Connect remains credential and provider-runtime owner;
- no automatic model activation or silent provider/model fallback is added.

Session 4C therefore adds **preference selection**, not multi-family execution.

## Source concentration

The new picker was extracted into `HostedModelPicker.tsx` instead of allowing the Settings page to exceed the existing source-concentration ceiling.

Final reviewed sizes remained below the 30 KiB current ceiling for the concentrated Settings sources:

```text
apps/ai/app/settings/page.tsx                  = 27,908 bytes
apps/ai/app/settings/useSettingsController.ts  = 28,762 bytes
```

No threshold was weakened.

## Session ordering preserved

The remaining OpenRouter scopes stay separate:

```text
Session 4D = Ai chat quick-switch
Session 4E = real multi-family OpenRouter execution validation
Session 4F = final polish / closure
```

Session 4D may consume the persisted picker preference for chat UX, but it must not convert a non-executable preference into dispatch authority.

Session 4E remains the separate boundary for real multi-family runtime compatibility, pricing identity, spend admission, and execution evidence.

## Exact-head regression evidence

The reviewed Session 4C head passed:

- formatting;
- lint;
- typecheck;
- full test suite;
- Phase 4 real-process acceptance;
- production operations acceptance;
- secret scan and full git-history secret scan;
- dependency/toolchain/container/release-security gates;
- production build;
- Product Eval;
- integrated rendered-browser acceptance.

Merged `main` passed governed CI and Product Eval before actual staging deployment.

## Explicit next boundary

Session 4C is **CLOSED / PASS / STAGING VERIFIED**.

Session 4D — Ai chat quick-switch — is the next eligible OpenRouter scope, but it is **not active merely because 4C closed**.

Any Session 4D implementation must preserve:

```text
selected preference != executable authority
```

A dynamic preference cannot dispatch until the separately authorized execution-validation boundary proves it.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
6. use this Session 4C checkpoint as the Settings-selection boundary;
7. use Session 4B as the automatic-admission boundary;
8. use Session 4A as the family-classification boundary;
9. use Session 3 as the discovery/cache boundary and Session 2 as the static executable registry boundary;
10. start Session 4D only after explicit operator authorization.

## Bottom line

ECORIONE now has a governed OpenRouter Settings picker that can persist fresh Session 4B-selectable model preferences while keeping runtime dispatch fail-closed.

A Qwen/Gemini/GPT/DeepSeek/Kimi/GLM candidate can become a user preference without becoming executable. Static verified OpenRouter models retain their existing execution path. Dynamic execution remains a later, separately proved boundary.
