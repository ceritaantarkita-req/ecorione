# OpenRouter Model Family Foundation — Session 4A Safe Checkpoint — 2026-09-28

Status: **FINAL / CLOSED / PASS / STAGING VERIFIED**

## Scope

Session 4A establishes one version-agnostic model-family foundation for the six OpenRouter families explicitly requested by the operator:

```text
GPT
Gemini
Qwen
DeepSeek
Kimi
GLM
```

This session does **not** admit new executable models and does **not** implement the final model picker. It prepares one stable family vocabulary that later admission and picker sessions can reuse without duplicating or hard-coding individual model versions.

## Exact reviewed implementation

```text
PR                              = #394
reviewed head                   = 90ba75a1a1016110ac278909208ec2c7eede15df
merge SHA                       = 29446ad0e140d1486bd3914bb087a552409e464c
exact-head CI                   = #2467 PASS
exact-head Product Eval         = #1706 PASS
exact-head browser acceptance   = #271 PASS
merged-main CI                  = #2468 PASS
merged-main Product Eval        = #1707 PASS
open pull requests after merge  = 0
```

The temporary Prettier diagnostic used during implementation was removed before the reviewed head. `package.json` is not part of the final Session 4A diff.

## Governed staging proof

```text
runtime / staging SHA    = 29446ad0e140d1486bd3914bb087a552409e464c
staging image            = staging-29446ad0e140
Staging Deploy gate      = #1696 PASS / deploy skipped
actual Staging Deploy    = #1697 PASS
public production smoke  = PASS
Operations               = healthy
configured/running       = 15 / 15
non-running              = 0
host evidence free disk  = 23.97 GiB
stabilized free disk     = 25.31 GiB
```

Staging Deploy #1697 deployed the exact merge SHA through the governed least-privilege staging path and converged all configured services.

SumoPod remains **staging, not production**.

## Canonical family foundation

Connect now owns one canonical target-family vocabulary:

```text
gpt      -> GPT
gemini   -> Gemini
qwen     -> Qwen
deepseek -> DeepSeek
kimi     -> Kimi
glm      -> GLM
```

An internal `other` family remains available for models outside these six families, including the currently admitted Claude OpenRouter entries.

The family layer is intentionally **version-agnostic**. It does not pin one specific GPT, Gemini, Qwen, DeepSeek, Kimi, or GLM model version.

## Source-provider family mapping

The classifier currently recognizes family-shaped model identities only under the expected OpenRouter author namespace:

```text
openai                 -> GPT
google                 -> Gemini
qwen                   -> Qwen
deepseek / deepseek-ai -> DeepSeek
moonshotai             -> Kimi
z-ai                   -> GLM
```

Classification requires both the expected source-provider namespace and a matching family prefix.

This prevents unrelated models from being grouped merely because they share an author namespace. Tests explicitly keep examples such as Google Gemma, non-Kimi Moonshot models, and Llama outside the six requested families.

The Qwen classifier accepts compact versioned slugs such as `qwen3...` without pinning a version. The exact-head test suite caught and closed this boundary before merge.

## Registry and discovery metadata

`HostedModelRegistryEntry` now carries a `family` field.

Current existing entries remain:

- direct OpenAI GPT entries -> `gpt`;
- NVIDIA GLM-5.3 -> `glm`;
- existing Anthropic / OpenRouter Claude entries -> `other`.

OpenRouter discovery results also carry `family`.

The discovery snapshot exposes the canonical six-family `[{ id, displayName }]` catalog so later UI can use the same Connect-owned vocabulary instead of maintaining a second hard-coded list.

Mutable aliases can be classified for presentation/discovery, for example Kimi or GLM `~...latest` aliases, but classification alone does **not** grant execution authority.

## Governance unchanged

Session 4A does not change the execution boundary.

Current OpenRouter executable/selectable models remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

The following remain true:

- discovered-only models remain non-executable;
- family classification is descriptive metadata, not admission;
- pricing evidence is unchanged;
- routing policy is unchanged;
- Governed / Recommended behavior is unchanged;
- RESTRICTED behavior is unchanged;
- no silent provider/model fallback was added;
- no new OpenRouter model becomes selectable because it belongs to one of the six families;
- no Add/Activate picker workflow is part of Session 4A.

## Exact-head regression evidence

The final reviewed head passed:

- formatting;
- lint;
- typecheck;
- full test suite;
- Phase 4 real-process acceptance;
- production operations acceptance;
- secret scan;
- dependency/toolchain/container/release-security gates;
- production build;
- Product Eval;
- integrated rendered-browser acceptance.

Family-specific coverage includes:

- stable display order for all six requested families;
- GPT mutable alias classification;
- Gemini;
- compact Qwen version slugs;
- both DeepSeek namespaces;
- Kimi stable and mutable aliases;
- GLM stable and mutable aliases;
- negative examples for unrelated author models;
- registry family metadata;
- discovery/control/proxy/browser family propagation.

## Repository state at runtime closure

Immediately after PR #394 merged:

```text
open pull requests             = 0
live remote branch count       = 16
historical cleanup boundary    = 9
known post-cleanup refs        = 7
unexpected active work refs    = 0
```

Known post-cleanup bookkeeping/provenance refs are the current safe-resume ref, NVIDIA Session 1 ref, Session 2 ref, Session 3 implementation/closure/runbook refs, and Session 4A implementation ref.

The docs-closure branch created after this runtime checkpoint is bookkeeping only.

## Explicit next boundary

Session 4A is **CLOSED / PASS**.

The agreed next eligible scope is **Session 4B — automatic verification and admission** for selected discovered models across the six target families.

Session 4B is **not active** merely because this checkpoint exists.

Session 4B must preserve these Session 4A / Session 2–3 rules:

- family classification is not execution authority;
- remote catalog presence is not execution authority;
- arbitrary model versions must not become executable without verification;
- pricing/spend evidence remains mandatory;
- provider/model identity must remain explicit;
- no silent fallback.

## Safe resume

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read `docs/verification/ecorione-safe-resume-checkpoint-2026-09-28.md`;
6. use this Session 4A checkpoint as the family-foundation boundary;
7. use Session 3 as the discovery boundary and Session 2 as the registry/admission compatibility boundary;
8. start Session 4B only after explicit operator authorization.

## Bottom line

ECORIONE now has one stable, version-agnostic foundation for GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM across OpenRouter discovery and hosted-model metadata.

This makes later switching/admission work simpler without weakening governance: family classification is available everywhere it is needed, while the selectable OpenRouter model set remains unchanged until Session 4B explicitly verifies and admits more models.
