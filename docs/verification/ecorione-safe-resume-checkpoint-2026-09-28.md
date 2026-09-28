# ECORIONE — Safe Resume Checkpoint — 2026-09-28

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff point after the closed ECX Batch 1–7 work, NVIDIA hosted-provider rollout and connection-test hardening, OpenRouter registry Session 2, live-discovery Session 3, and model-family foundation Session 4A.

This is the preferred resume pointer for the next ECORIONE session. Do **not** restart completed roadmaps or reconstruct the project from old planning notes.

## Repository audit boundary

```text
repository                           = ceritaantarkita-req/ecorione
audited runtime main                 = 29446ad0e140d1486bd3914bb087a552409e464c
latest runtime closure               = PR #394
PR #394 reviewed head                = 90ba75a1a1016110ac278909208ec2c7eede15df
PR #394 merge SHA                    = 29446ad0e140d1486bd3914bb087a552409e464c
PR #394 exact-head CI                = #2467 PASS
PR #394 exact-head Product Eval      = #1706 PASS
PR #394 browser acceptance           = #271 PASS
merged-main CI                       = #2468 PASS
merged-main Product Eval             = #1707 PASS
open pull requests at runtime close  = 0
live remote branches at runtime close= 16
open issue at audit boundary         = #277 DR-2 physical independence
```

The Session 4A documentation-closure branch is bookkeeping only and does not open a product/runtime scope.

## Runtime / staging compatibility baseline

The latest audited runtime-changing merge is:

```text
runtime-changing baseline = 29446ad0e140d1486bd3914bb087a552409e464c
staging image             = staging-29446ad0e140
Staging Deploy gate       = #1696 PASS / deploy skipped
actual Staging Deploy     = #1697 PASS
public/auth smoke         = PASS
Operations                = healthy
configured/running        = 15 / 15
non-running               = 0
host evidence free disk   = 23.97 GiB
stabilized free disk      = 25.31 GiB
```

Staging Deploy #1697 deployed the exact merge SHA through the governed least-privilege staging path and passed public/auth smoke, Operations, exact-host evidence, and capacity checks.

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
- OpenRouter model-family Session 4A.

There is no implicit Batch 8, PE-09, PCS-11, Batch 13, next A-series item, or automatic later provider session.

## OpenRouter Sessions 2–3 + 4A state

Sessions 2, 3, and 4A are **CLOSED / PASS / STAGING VERIFIED** at their documented boundaries.

Session 2 established the extensible governed model registry.

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

Session 4A adds one Connect-owned, version-agnostic target-family vocabulary:

```text
gpt      -> GPT
gemini   -> Gemini
qwen     -> Qwen
deepseek -> DeepSeek
kimi     -> Kimi
glm      -> GLM
```

Expected source-provider namespaces are:

```text
openai                 -> GPT
google                 -> Gemini
qwen                   -> Qwen
deepseek / deepseek-ai -> DeepSeek
moonshotai             -> Kimi
z-ai                   -> GLM
```

The classifier requires the expected source namespace plus a family-shaped slug/name. Unrelated models under the same vendor remain `other`.

The family layer is intentionally version-agnostic. Compact slugs such as `qwen3...` can be classified without pinning a particular Qwen version. Mutable aliases may also be classified for discovery/presentation, but alias or family classification never grants execution authority.

Registry entries and discovered models now carry `family`, and discovery responses expose the canonical six-family catalog so later admission/picker work does not need a second hard-coded family list.

Execution remains fail-closed:

```text
remote catalog presence
  != executable admission

family classification
  != executable admission

verified executable registry entry + required pricing/evidence
  -> routing may proceed
```

Current OpenRouter executable/selectable models remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

GPT, Gemini, Qwen, DeepSeek, Kimi, GLM, and other catalog models are **not** claimed selectable merely because they can now be family-classified.

Canonical OpenRouter evidence:

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

At Session 4A runtime closure:

```text
live remote branch count         = 16
historical cleanup boundary      = 9
known post-cleanup refs          = 7
unexpected active work refs      = 0
open pull requests               = 0
```

The seven post-cleanup refs are known bookkeeping/provenance refs created by NVIDIA and OpenRouter Sessions 1–4A. Their presence does not mean those closed scopes remain active.

The temporary Session 4A docs-closure branch created after this runtime checkpoint is bookkeeping only.

Future branch growth must be handled as an exact-SHA delta. Do not rerun historical cleanup classifications simply for freshness.

## Deferred / separately selectable scopes

None of these is active:

- **Session 4B — selected OpenRouter model automatic verification/admission across GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM**;
- Session 4C Settings model picker;
- Session 4D Ai chat quick-switch;
- Session 4E real multi-family OpenRouter validation;
- Session 4F final polish/closure;
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

Session 4B must keep family classification, catalog presence, pricing metadata, and mutable aliases separate from execution authority. New executable models must pass the explicit verification/admission boundary; no silent fallback or bulk auto-admission is authorized by Session 4A.

## Safe resume procedure

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read this checkpoint;
6. use Session 4A as the family-foundation boundary;
7. use Session 3 as the discovery boundary and Session 2 as the registry/admission compatibility boundary;
8. start Session 4B only after explicit operator authorization;
9. do not infer any other numbered batch/session from historical documents.

## Bottom line

ECORIONE is at a clean handoff point: OpenRouter Session 4A is closed, deployed, and staging verified.

The system now has one version-agnostic family vocabulary for GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM without widening the executable model set.

There is **no active product/runtime implementation batch**. Session 4B is the agreed next eligible OpenRouter scope, but it is not active until explicitly authorized.
