# ECORIONE — Safe Resume Checkpoint — 2026-09-28

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff point after the closed ECX Batch 1–7 work, NVIDIA hosted-provider rollout and connection-test hardening, OpenRouter registry Session 2, live-discovery Session 3, model-family Session 4A, and automatic-admission Session 4B.

This is the preferred resume pointer for the next ECORIONE session. Do **not** restart completed roadmaps or reconstruct the project from old planning notes.

## Repository audit boundary

```text
repository                           = ceritaantarkita-req/ecorione
audited runtime main                 = fd921d81136433bd871a466498a283fc5bfb760e
latest runtime closure               = PR #396
PR #396 reviewed head                = 57c2c9dc69f17559af67bcfc994fd30c7d3c8e75
PR #396 merge SHA                    = fd921d81136433bd871a466498a283fc5bfb760e
PR #396 exact-head CI                = #2483 PASS
PR #396 exact-head Product Eval      = #1722 PASS
PR #396 browser acceptance           = #284 PASS
merged-main CI                       = #2484 PASS
merged-main Product Eval             = #1723 PASS
open pull requests at runtime close  = 0
live remote branches at runtime close= 18
open issue at audit boundary         = #277 DR-2 physical independence
```

The Session 4B documentation-closure branch is bookkeeping only and does not open a product/runtime scope.

## Runtime / staging compatibility baseline

The latest audited runtime-changing merge is:

```text
runtime-changing baseline = fd921d81136433bd871a466498a283fc5bfb760e
staging image             = staging-fd921d811364
Staging Deploy gate       = #1728 PASS / deploy skipped
actual Staging Deploy     = #1729 PASS
public/auth smoke         = PASS
Operations                = healthy
configured/running        = 15 / 15
non-running               = 0
host SHA match            = true
host evidence free disk   = 26.12 GiB
stabilized free disk      = 27.44 GiB
```

Staging Deploy #1729 deployed the exact merge SHA through the governed least-privilege staging path. Public/auth smoke passed, including the protected Ai/settings/project/history/Brain/Space mutation surfaces and MCP unauthenticated challenge. Operations was healthy on the first readiness attempt. Sanitized host evidence showed a clean worktree, exact SHA match, all 15 configured services running, and zero non-running services.

SumoPod remains **staging, not production**.

## Closed work that must not be restarted

The following are closed at their documented boundaries:

- original Batch 1–12 / W / F6;
- Product Evolution PE-00..PE-08;
- PCS-00..PCS-10;
- selected audit follow-ups through A-11;
- original Off-host DR drill;
- repository/documentation reconciliation;
- historical and post-ECX branch cleanup;
- ECX Recipient Execution Batch 1–7;
- NVIDIA / NIM hosted-provider rollout;
- bounded staging hosted-trial activation;
- Docker native dependency build hardening;
- NVIDIA connection-test Session 1;
- OpenRouter model-registry Session 2;
- OpenRouter live-discovery Session 3;
- OpenRouter model-family Session 4A;
- OpenRouter automatic-admission Session 4B.

There is no implicit Batch 8, PE-09, PCS-11, Batch 13, next A-series item, or automatic later provider session.

## OpenRouter Sessions 2–3 + 4A–4B state

Sessions 2, 3, 4A, and 4B are **CLOSED / PASS / STAGING VERIFIED** at their documented boundaries.

Session 2 established the extensible governed model registry and current static executable boundary.

Session 3 added bounded live discovery against the OpenRouter catalog:

```text
catalog endpoint      = https://openrouter.ai/api/v1/models
upstream deadline     = 8 seconds
response cap          = 8 MiB
cache TTL             = 10 minutes
result limit          = max 100
manual refresh        = supported
stale fallback        = explicit after prior successful snapshot
```

Session 4A added one Connect-owned, version-agnostic target-family vocabulary:

```text
gpt      -> GPT
gemini   -> Gemini
qwen     -> Qwen
deepseek -> DeepSeek
kimi     -> Kimi
glm      -> GLM
```

Expected source-provider namespaces remain:

```text
openai                 -> GPT
google                 -> Gemini
qwen                   -> Qwen
deepseek / deepseek-ai -> DeepSeek
moonshotai             -> Kimi
z-ai                   -> GLM
```

Session 4B adds automatic fail-closed admission for discovered models in those six families.

A target-family candidate becomes `verified-selectable` only when it has:

- a unique exact runtime id in the fetched snapshot;
- no mutable `~...` / `latest` alias;
- a structurally valid runtime slug whose namespace matches its source provider;
- a positive context window;
- text input and text output;
- `max_tokens` support;
- positive finite prompt and completion pricing;
- a fresh discovery snapshot.

Stable unavailable reasons are:

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

Non-target families remain `discovered-only`.

A stale fallback never keeps dynamic selectability. A dynamic candidate that had passed becomes `unavailable / stale-catalog` until fresh discovery succeeds.

Existing static `verified-executable` registry entries are not revoked by discovery staleness because their authority comes from the governed registry, not catalog freshness.

## Selectable is not executable

Session 4B intentionally separates picker eligibility from runtime dispatch authority.

For a newly admitted target-family candidate:

```text
admission  = verified-selectable
selectable = true
executable = false
```

The current **runtime execution dropdown** remains:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

Therefore:

```text
catalog presence
  != family authority

family classification
  != selection admission

verified-selectable
  != executable authority

verified executable registry entry + governed pricing/execution evidence
  -> current runtime routing may proceed
```

Session 4B does not create dynamic `PinnedModelId` pricing identities, weaken pre-dispatch spend reservation, change provider-reported OpenRouter billed-cost authority, change Governed/Recommended or RESTRICTED routing, add silent fallback, activate a model automatically, implement the final model picker, or claim real six-family completion evidence.

Canonical OpenRouter evidence:

- [openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)
- [openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)
- [openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)
- [openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)

## NVIDIA current source truth

NVIDIA API Catalog / NIM remains implemented as a first-class Connect provider with pinned `z-ai/glm-5.3`.

Current source + tests establish:

```text
credential-test default deadline = 60 seconds
provider-canary default deadline = 60 seconds
NVIDIA probe output cap          = 1024 tokens
NVIDIA probe reasoning effort    = low
timeout error                    = PROVIDER_TEST_TIMEOUT
```

The user's actual NVIDIA secret is not repository state and is not claimed validated.

Latest NVIDIA evidence:

- [nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md](nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md)
- [nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)

## ECX state

ECX Batch 1–7 is **CLOSED / PASS** and remains a compatibility baseline.

Canonical ECX evidence:

- [ecx-execution-b7-safe-checkpoint-2026-09-27.md](ecx-execution-b7-safe-checkpoint-2026-09-27.md)

Do not reopen B1–B7 merely for freshness.

## Product-state interpretation

Project, Schedule/Trigger, Work, Brain, Flow, Run, and related product surfaces must be read from the **current code + accepted Product Evolution architecture**, not reconstructed from older brainstorming.

```text
Project = WHERE
Brain   = WHAT IS KNOWN
Trigger = WHEN / WHY
Flow    = HOW
Agent   = WHO/WHAT executes
Run     = WHAT HAPPENED
```

Product Evolution PE-00..PE-08 is already closed. Any future change to these surfaces is a new explicitly authorized scope.

## Repository hygiene

The historical cleanup boundary remains 9 branches.

At Session 4B runtime closure:

```text
live remote branch count       = 18
open pull requests             = 0
main                           = fd921d81136433bd871a466498a283fc5bfb760e
4B implementation branch      = feat/openrouter-auto-admission-session4b-20260928
4B reviewed branch SHA         = 57c2c9dc69f17559af67bcfc994fd30c7d3c8e75
```

The later branch count is a bookkeeping/provenance delta after the historical cleanup boundary. The merged Session 4B implementation branch remains present at its exact reviewed SHA and does not mean Session 4B is still active.

The temporary Session 4B docs-closure branch created after this runtime checkpoint is bookkeeping only.

Future branch growth must be handled as an exact-SHA delta. Do not rerun historical cleanup classifications simply for freshness.

## Deferred / separately selectable scopes

None of these is active:

- **Session 4C — Settings model picker**;
- Session 4D Ai chat quick-switch;
- Session 4E real multi-family OpenRouter execution validation;
- Session 4F final OpenRouter polish/closure;
- DR-2 checkpoint 2 external-target selection and physical-independence proof;
- public production promotion/cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- paid hosted-provider/W18 freshness work;
- external A2A interoperability;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge scheduling;
- AutoClick / L4 autonomy.

Issue #277 remains the deferred DR-2 tracker.

Session 4C must consume Session 4B selection eligibility without silently treating `verified-selectable` as `verified-executable`. Runtime execution and spend authority must remain fail-closed.

## Safe resume procedure

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read this checkpoint;
6. use Session 4B as the automatic-admission boundary;
7. use Session 4A as the family-classification boundary;
8. use Session 3 as the discovery/cache boundary and Session 2 as the static registry/execution compatibility boundary;
9. start Session 4C only after explicit operator authorization;
10. do not infer any other numbered batch/session from historical documents.

## Bottom line

ECORIONE is at a clean handoff point: OpenRouter Session 4B is closed, deployed, and staging verified.

The system can automatically classify and admission-check fresh GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM catalog candidates and expose deterministic **Selectable** versus **Unavailable** state without manual per-model approval.

That admission is intentionally not runtime execution authority. Session 4C is the agreed next eligible OpenRouter scope, but it is not active until explicitly authorized.
