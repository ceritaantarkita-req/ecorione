# OpenRouter Model Registry — Session 2 Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

This checkpoint closes the bounded Session 2 requested after the OpenRouter Settings UX showed a Claude-only model list.

Session 2 builds the **extensible governed model-registry foundation**. It deliberately does **not** perform live OpenRouter model discovery/search and does **not** auto-admit arbitrary models.

## Exact reviewed implementation

```text
PR                         = #389
reviewed head              = 203775e1b37237994a48b232f4184facb8fec1ea
merge SHA                  = 9f19b40cea4b9f6266caba6f8997a5c2bae67df5
exact-head CI              = #2428 PASS
exact-head Product Eval    = #1667 PASS
open pull requests after merge = 0
```

The final PR touched Connect registry/catalog/routing/runtime-setting boundaries and deterministic tests. The final head did not require the Ai rendered-browser workflow because the final diff no longer changed the Ai application surface.

## Merged-main / staging proof

```text
runtime / staging SHA      = 9f19b40cea4b9f6266caba6f8997a5c2bae67df5
staging image              = staging-9f19b40cea4b
merged-main CI             = #2429 PASS
merged-main Product Eval   = #1668 PASS
Staging Deploy gate        = #1618 PASS
actual Staging Deploy      = #1619 PASS
Operations                 = healthy
configured/running         = 15 / 15
non-running                = 0
stabilized free disk       = 29.90 GiB
```

Staging Deploy #1619 built and deployed the exact merge SHA, passed public/auth and MCP smoke checks, reported healthy Operations, and converged all 15 configured services.

SumoPod remains **staging, not production**.

## Registry foundation now implemented

The hosted-model registry is now the source of truth for provider/model runtime identity and execution admission.

Each registry entry can represent:

- provider;
- stable registry selection id;
- provider runtime slug;
- source/origin provider;
- optional context-window evidence;
- admitted capabilities;
- pricing identity and pricing authority;
- verification state;
- catalog source/provenance;
- optional freshness timestamp.

The persistence/API preference shape is now string-based so a later discovered model id does not require a compile-time enum edit.

That does **not** make arbitrary strings executable.

Execution remains fail-closed:

```text
persisted model string
  -> provider/model registry lookup
  -> executable verified entry required
  -> admitted pricing identity required
  -> routing may proceed
otherwise
  -> reject as not verified
```

A catalogued/discovered model can therefore exist without being executable until verification and pricing/evidence requirements are satisfied.

## OpenRouter compatibility boundary

The OpenRouter adapter no longer owns a separate Claude-only runtime mapping table. It resolves runtime slugs through the governed registry.

Current **executable/selectable OpenRouter models remain unchanged**:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Session 2 does **not** claim GPT, DeepSeek, Qwen, GLM, Kimi, Gemini, Llama, or other OpenRouter models are already selectable.

This is intentional. Those models must enter through the later discovery/verification flow instead of being admitted merely because a slug is known.

## Governance preserved

Session 2 preserves the existing boundaries:

- Governed / Recommended remains the default model policy;
- RESTRICTED routing remains authoritative;
- provider/model mismatches fail closed;
- OpenRouter provider-reported `usage.cost` remains authoritative for billed actual cost;
- executable entries still require an admitted ECORIONE pricing identity for pre-dispatch spend reservation/evidence;
- no live OpenRouter catalog dependency exists yet;
- no arbitrary model string can execute solely because it is saved;
- no silent provider fallback was added.

## Evidence-honest metadata

The registry schema is ready for richer discovery metadata, but Session 2 does not invent freshness/capability claims that were not externally proven.

For the static verified entries at this checkpoint:

- `catalogSource = static-verified`;
- `verifiedAt = null` when no external freshness timestamp has been established;
- `contextWindowTokens = null` where current repository evidence does not establish a fresh provider claim;
- admitted capability is conservative rather than inferred from marketing metadata.

Session 3 can populate discovery metadata from an actual OpenRouter catalog source while keeping executable admission separate.

## NVIDIA compatibility correction

Current source truth after Session 1 is:

```text
credential-test default deadline = 60 seconds
provider-canary default deadline = 60 seconds
NVIDIA probe output cap          = 1024 tokens
NVIDIA probe reasoning effort    = low
timeout error                    = PROVIDER_TEST_TIMEOUT
```

Earlier Session 1 docs that mention 30 seconds / 512 tokens describe an intermediate implementation and must not override current code + tests.

The user's actual NVIDIA API key is still not claimed validated by repository work.

## Repository / branch state

At Session 2 runtime closure, before this docs refresh:

```text
open pull requests          = 0
live remote branches        = 12
cleanup-boundary branches   = 9
known bookkeeping ref       = docs/current-safe-resume-20260928
known Session 1 ref         = fix/nvidia-credential-test-timeout-20260928
known merged Session 2 ref  = feat/openrouter-model-registry-session2-20260928
unexpected active work refs = 0
```

These later refs are known bookkeeping/provenance refs. Their presence does not mean the closed sessions remain active.

## Explicit next boundary

Session 2 is **CLOSED / PASS**.

The agreed next eligible scope, only when explicitly continued, is **Session 3 — OpenRouter model discovery**:

- fetch/cache the OpenRouter catalog;
- search/filter models;
- represent discovered vs verified/admitted state distinctly;
- do not make a discovered model executable merely because it appears in the remote catalog.

Do not retroactively mix Session 3 discovery work into Session 2.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
6. use this Session 2 checkpoint as the OpenRouter registry evidence boundary;
7. open Session 3 only after explicit operator authorization.

## Bottom line

OpenRouter is no longer architecturally locked to a Claude-only hard-coded mapping. ECORIONE now has an extensible, evidence-aware, fail-closed hosted-model registry foundation deployed on staging, while the current selectable OpenRouter set intentionally remains the two previously verified Claude models until discovery/verification work is completed.
