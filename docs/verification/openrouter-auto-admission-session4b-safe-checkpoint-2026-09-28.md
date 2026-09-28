# OpenRouter Automatic Admission — Session 4B Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

Session 4B adds bounded automatic verification/admission for discovered OpenRouter models in the six Connect-owned target families:

```text
GPT
Gemini
Qwen
DeepSeek
Kimi
GLM
```

The session converts discovery metadata into an explicit **selection-eligibility** decision without silently granting runtime execution authority.

## Exact reviewed implementation

```text
PR                              = #396
reviewed head                   = 57c2c9dc69f17559af67bcfc994fd30c7d3c8e75
merge SHA                       = fd921d81136433bd871a466498a283fc5bfb760e
exact-head CI                   = #2483 PASS
exact-head Product Eval         = #1722 PASS
exact-head browser acceptance   = #284 PASS
merged-main CI                  = #2484 PASS
merged-main Product Eval        = #1723 PASS
open pull requests after merge  = 0
```

A temporary Prettier diff diagnostic was used only to obtain the exact formatter output and was removed before the reviewed head. `package.json` is not part of the final Session 4B runtime diff.

## Governed staging proof

```text
runtime / staging SHA    = fd921d81136433bd871a466498a283fc5bfb760e
staging image            = staging-fd921d811364
Staging Deploy gate      = #1728 PASS / deploy skipped
actual Staging Deploy    = #1729 PASS
public/auth smoke        = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host SHA match           = true
host evidence free disk  = 26.12 GiB
stabilized free disk     = 27.44 GiB
```

Staging Deploy #1729 used the governed least-privilege SSH path and executed `deploy fd921d81136433bd871a466498a283fc5bfb760e`. The resulting image was `staging-fd921d811364`.

The public/auth smoke passed, including the protected Ai/settings/project/history/Brain/Space mutation surfaces and MCP unauthenticated challenge boundary. Operations was healthy on the first readiness attempt. Host evidence proved the exact expected SHA with a clean worktree and all 15 configured services running.

SumoPod remains **staging, not production**.

## Automatic admission states

OpenRouter discovery now distinguishes four states:

```text
verified-executable  = existing static verified registry/runtime authority
verified-selectable  = Session 4B automatic admission passed
unavailable          = target-family candidate failed a bounded admission rule
discovered-only      = catalogued model outside the six target families
```

The API also exposes:

```text
selectable
executable
selectionId
unavailableReason
```

These fields intentionally keep selection eligibility separate from runtime execution proof.

## Automatic admission gate

A discovered target-family candidate becomes `verified-selectable` only when all of the following are true:

1. the family is one of GPT, Gemini, Qwen, DeepSeek, Kimi, or GLM;
2. the exact runtime id is not duplicated in the fetched catalog;
3. the id is not a mutable `~...` / `latest` alias;
4. the runtime slug is structurally valid and its namespace matches the discovered source provider;
5. the catalog reports a positive context window;
6. text input is supported;
7. text output is supported;
8. `max_tokens` is supported by the candidate;
9. prompt pricing is present, finite, and positive;
10. completion pricing is present, finite, and positive;
11. the discovery snapshot is fresh.

Failure is explicit and fail-closed.

Current stable reason codes are:

```text
duplicate-runtime-id
mutable-alias
invalid-runtime-slug
missing-context-window
text-input-unsupported
text-output-unsupported
max-tokens-unsupported
missing-pricing
invalid-pricing
stale-catalog
```

A stale fallback never preserves dynamic selection eligibility. A previously `verified-selectable` model becomes `unavailable / stale-catalog` until a fresh catalog is available.

Existing static `verified-executable` registry entries are not revoked merely because discovery is stale; their execution authority comes from the governed registry rather than the discovery snapshot.

## Family behavior

The six-family classifier from Session 4A remains the first target boundary.

A model outside those six families remains `discovered-only`. Session 4B does not bulk-admit unrelated OpenRouter models.

Tests cover a stable candidate for every requested family:

```text
openai      -> GPT
google      -> Gemini
qwen        -> Qwen
deepseek    -> DeepSeek
moonshotai  -> Kimi
z-ai        -> GLM
```

Negative coverage includes duplicate ids, mutable aliases, invalid slugs, missing context, unsupported text I/O, missing `max_tokens`, missing/invalid pricing, non-target families, and stale-cache withdrawal.

## Settings UX

The OpenRouter discovery panel now uses the admission result directly:

- static executable entries show **Verified · selectable**;
- target-family candidates that pass Session 4B show **Selectable**;
- failed target-family candidates show **Unavailable** plus a short reason;
- non-target catalog entries remain **Discovered only**.

Integrated browser acceptance proves:

- a valid Qwen discovery result is shown as **Selectable**;
- it does not pre-empt the Session 4C runtime picker;
- a mutable DeepSeek latest alias is shown as **Unavailable**;
- the UI exposes the short alias reason.

## Execution boundary remains fail-closed

Session 4B does **not** make dynamic candidates executable.

For a newly admitted target-family model:

```text
admission  = verified-selectable
selectable = true
executable = false
```

`Selectable` here means **eligible for the later governed model-selection surface**. It does not mean the current runtime can dispatch that model.

The current execution dropdown remains the existing static OpenRouter pair:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Session 4B does not:

- create a dynamic `PinnedModelId` or pricing-table identity from remote catalog strings;
- weaken pre-dispatch spend reservation;
- change provider-reported OpenRouter billed-cost authority;
- change Governed / Recommended routing;
- change RESTRICTED routing;
- change provider credential ownership;
- add silent fallback;
- activate a model automatically;
- implement the final Settings model picker;
- implement Ai quick-switch;
- claim a live completion on each of the six families.

## Session ordering preserved

The next eligible OpenRouter scopes remain separate:

```text
Session 4C = Settings model picker
Session 4D = Ai chat quick-switch
Session 4E = real multi-family OpenRouter execution validation
Session 4F = final polish / closure
```

Session 4E remains the place where real calls can prove provider/runtime compatibility and execution evidence across the selected families. Session 4B does not pre-claim that result.

## Repository state at runtime closure

Before the documentation-closure branch was created:

```text
main SHA                   = fd921d81136433bd871a466498a283fc5bfb760e
open pull requests         = 0
live remote branch count   = 18
4B implementation branch  = feat/openrouter-auto-admission-session4b-20260928
4B reviewed branch SHA     = 57c2c9dc69f17559af67bcfc994fd30c7d3c8e75
```

The implementation branch still exists at the exact reviewed SHA. Its presence is bookkeeping/provenance, not active work.

## Exact-head regression evidence

The reviewed head passed:

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

Merged `main` passed the same governed CI and Product Eval boundary before actual staging deployment.

## Explicit next boundary

Session 4B is **CLOSED / PASS / STAGING VERIFIED**.

Session 4C is the next eligible OpenRouter scope, but it is **not active merely because 4B closed**.

Session 4C must consume the 4B admission result without treating `verified-selectable` as `verified-executable`. Runtime execution must remain fail-closed until the later execution wiring/evidence boundary is implemented and verified.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
6. use this Session 4B checkpoint as the automatic-admission boundary;
7. use Session 4A as the family-classification boundary;
8. use Session 3 as the discovery/cache boundary;
9. use Session 2 as the static registry/execution compatibility boundary;
10. start Session 4C only after explicit operator authorization.

## Bottom line

ECORIONE can now automatically evaluate discovered GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM candidates and expose a deterministic **Selectable** versus **Unavailable** result without manual per-model approval.

That admission remains intentionally separate from execution. The runtime picker, quick-switch, and real multi-family execution proof remain later sessions, so Session 4B increases model-selection readiness without weakening the existing governed execution/spend boundary.
