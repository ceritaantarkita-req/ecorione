# OpenRouter Model Discovery — Session 3 Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

This checkpoint closes the explicitly authorized **Session 3 — OpenRouter live model discovery/search/cache**.

Session 3 adds a read-only discovery layer over the live OpenRouter catalog while preserving the Session 2 rule that **discovered is not the same as executable/admitted**.

It does **not** auto-admit arbitrary remote models and does not broaden provider execution merely because a model appears in the OpenRouter catalog.

## Exact reviewed implementation

```text
PR                              = #391
reviewed head                   = f487600ff29ab5a64a514b03c91384729938b545
merge SHA                       = af2ef8f61f26058178e56b0d6490248c1898976e
exact-head CI                   = #2456 PASS
exact-head Product Eval         = #1695 PASS
exact-head browser acceptance   = #265 PASS
merged-main CI                  = #2457 PASS
merged-main Product Eval        = #1696 PASS
open pull requests after merge  = 0
```

The final implementation touched Connect discovery/control boundaries, the Ai Settings proxy/controller/presentation, deterministic unit tests, and integrated rendered-browser acceptance.

## Governed staging proof

```text
runtime / staging SHA    = af2ef8f61f26058178e56b0d6490248c1898976e
staging image            = staging-af2ef8f61f26
Staging Deploy gate      = #1674 PASS / deploy skipped
actual Staging Deploy    = #1675 PASS
public production smoke  = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
stabilized free disk     = 25.33 GiB
```

Staging Deploy #1675 deployed the exact reviewed merge SHA through the least-privilege staging path, passed public/auth smoke and host evidence, reported healthy Operations, and converged all 15 configured services.

SumoPod remains **staging, not production**.

## Discovery boundary now implemented

Connect now has a bounded OpenRouter catalog reader against:

```text
https://openrouter.ai/api/v1/models
```

The discovery path provides:

- live model catalog fetch;
- 8-second upstream timeout;
- 8 MiB response-size cap;
- bounded upstream schema arrays;
- 10-minute in-memory full-catalog cache;
- concurrent refresh deduplication;
- search by model id, display name, or source provider;
- exact source-provider filter;
- result limit capped at 100;
- explicit manual refresh;
- explicit stale-cache fallback if a later refresh fails after an earlier successful snapshot;
- mutable alias detection for ids beginning with `~`;
- provider/model admission status exposed independently from catalog presence.

The read-only control endpoint is:

```text
GET /v1/settings/providers/openrouter/models
```

Accepted query keys are bounded to:

```text
q
sourceProvider
limit
refresh
```

The Ai settings proxy independently enforces the same allowlisted query boundary before forwarding to Connect.

## Discovered vs executable remains fail-closed

A remote catalog entry is normalized into either:

```text
verified-executable
discovered-only
```

A catalog entry becomes `verified-executable` only when its exact OpenRouter runtime slug already maps to an executable verified Session 2 registry entry.

Otherwise:

```text
executable = false
selectionId = null
```

Therefore OpenRouter catalog presence alone cannot grant routing authority.

Current selectable/executable OpenRouter models remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Session 3 can discover other families such as Qwen, DeepSeek, GPT, Gemini, Kimi, GLM, Llama, and others when OpenRouter returns them, but those entries remain **discovered only** until a separately authorized admission/verification scope proves the required identity, pricing, capability, and execution evidence.

## Settings UX

When OpenRouter is selected, Settings now exposes a dedicated discovery panel that can:

- search the cached/live catalog;
- filter by source provider;
- explicitly refresh from OpenRouter;
- show cache state and stale fallback state;
- show display name + exact model id;
- show source provider;
- show context-window metadata when supplied;
- show input modalities when supplied;
- label mutable aliases;
- label existing executable entries as **Verified · selectable**;
- label non-admitted catalog entries as **Discovered only**.

Session 3 deliberately provides **no Add / Activate action** for discovered-only models.

Integrated rendered-browser acceptance proves a discovered Qwen entry can appear in the discovery UI while remaining absent from the selectable hosted-model dropdown.

## Cache and failure behavior

The cache stores the normalized full catalog so later search/filter requests do not refetch upstream until TTL expiry or explicit refresh.

If OpenRouter becomes unavailable after a successful snapshot, Connect may serve the previous cache with:

```text
cache = stale
stale = true
```

If no cache exists, upstream network/HTTP failure returns an explicit catalog-unavailable error. Invalid JSON/schema returns an explicit catalog-invalid error.

No silent model admission or provider fallback was added.

## A-09 Settings decomposition preserved

Adding discovery initially pushed `apps/ai/app/settings/page.tsx` over the audited 30,000-byte concentration ceiling.

The final reviewed head fixes that by extracting:

```text
apps/ai/app/settings/OpenRouterDiscoveryPanel.tsx
```

The Settings page returns below the source-contract threshold while owner API orchestration remains in `useSettingsController.ts`.

This is a structural closure, not a weakened test threshold.

## Repository branch state at runtime closure

Immediately after PR #391 merged:

```text
open pull requests             = 0
live remote branch count       = 13
cleanup-boundary branches      = 9
known bookkeeping ref          = docs/current-safe-resume-20260928
known merged Session 1 ref     = fix/nvidia-credential-test-timeout-20260928
known merged Session 2 ref     = feat/openrouter-model-registry-session2-20260928
known merged Session 3 ref     = feat/openrouter-model-discovery-session3-20260928
unexpected active work refs    = 0
```

These post-cleanup refs are known bookkeeping/provenance refs, not active implementation scopes.

## Explicit non-scope / next boundary

Session 3 is **CLOSED / PASS**.

Not implemented by Session 3:

- auto-admitting arbitrary discovered models;
- creating pricing identities from remote metadata automatically;
- capability verification from catalog marketing metadata;
- executing a discovered-only model;
- changing Governed / Recommended routing policy;
- weakening RESTRICTED policy behavior;
- silent provider/model fallback;
- bulk adding every OpenRouter model;
- production promotion.

If explicitly authorized later, a **new bounded model-admission/verification scope** may evaluate selected discovered models one by one. It must not treat catalog presence as sufficient evidence.

No Session 4 is active merely because Session 3 closed.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
6. use this Session 3 checkpoint as the current OpenRouter discovery evidence boundary;
7. keep Session 2 registry invariants as compatibility requirements;
8. open exactly one new scope only after explicit operator authorization.

## Bottom line

OpenRouter model discovery is now live, searchable, cached, bounded, evidence-visible, and deployed on governed staging.

ECORIONE can discover remote OpenRouter models without making them executable. The current selectable set remains the verified Claude entries until a later explicitly authorized admission/verification scope proves more.
