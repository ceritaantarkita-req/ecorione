# ECORIONE — Safe Resume Checkpoint — 2026-09-28

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff point after the closed ECX Batch 1–7 work, NVIDIA hosted-provider rollout and connection-test hardening, OpenRouter model-registry Session 2, and OpenRouter live-discovery Session 3.

This is the preferred resume pointer for the next ECORIONE session. Do **not** restart completed roadmaps or reconstruct the project from old planning notes.

## Repository audit boundary

```text
repository                         = ceritaantarkita-req/ecorione
audited runtime main               = af2ef8f61f26058178e56b0d6490248c1898976e
latest runtime closure             = PR #391
PR #391 reviewed head              = f487600ff29ab5a64a514b03c91384729938b545
PR #391 merge SHA                  = af2ef8f61f26058178e56b0d6490248c1898976e
PR #391 exact-head CI              = #2456 PASS
PR #391 exact-head Product Eval    = #1695 PASS
PR #391 browser acceptance         = #265 PASS
merged-main CI                     = #2457 PASS
merged-main Product Eval           = #1696 PASS
open pull requests at runtime close= 0
live remote branches at runtime close = 13
open issue at audit boundary       = #277 DR-2 physical independence
```

The documentation branch used to update this pointer is bookkeeping only and does not open a product/runtime scope.

## Runtime / staging compatibility baseline

The latest audited runtime-changing merge is:

```text
runtime-changing baseline = af2ef8f61f26058178e56b0d6490248c1898976e
staging image             = staging-af2ef8f61f26
Staging Deploy gate       = #1674 PASS / deploy skipped
actual Staging Deploy     = #1675 PASS
public/auth smoke         = PASS
Operations                = healthy
configured/running        = 15 / 15
non-running               = 0
stabilized free disk      = 25.33 GiB
```

Staging Deploy #1675 deployed the exact merge SHA through the governed least-privilege staging path and passed public/auth smoke, Operations, exact-host evidence, and capacity checks.

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
- OpenRouter live-discovery Session 3.

There is no implicit Batch 8, PE-09, PCS-11, Batch 13, next A-series item, or automatic later provider session.

## OpenRouter Sessions 2–3 state

Sessions 2 and 3 are **CLOSED / PASS / STAGING VERIFIED** at their documented boundaries.

Session 2 established the extensible governed model registry. The hosted model boundary can represent provider/runtime identity, source provider, optional discovery metadata, pricing authority, verification state, catalog provenance, and freshness.

Session 3 adds bounded live discovery against the OpenRouter catalog:

```text
catalog endpoint      = https://openrouter.ai/api/v1/models
upstream deadline     = 8 seconds
response cap          = 8 MiB
cache TTL             = 10 minutes
result limit          = max 100
manual refresh        = supported
stale fallback        = explicit after prior successful snapshot
```

Search/filter runs against the normalized cached full catalog. The read-only Settings path exposes exact model ids, source provider, context/input metadata when returned, mutable alias state, and admission status.

Execution remains fail-closed. A discovered model is not executable merely because it appears in OpenRouter.

```text
remote catalog presence
  -> normalize as discovered model
  -> exact existing verified registry mapping?
       yes -> verified-executable
       no  -> discovered-only / executable=false / selectionId=null
```

Current OpenRouter executable/selectable models remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

GPT, DeepSeek, Qwen, GLM, Kimi, Gemini, Llama, and other catalog models may be discoverable when OpenRouter returns them, but none is claimed selectable without a separate explicit admission/verification scope.

Integrated browser acceptance proves a discovered Qwen entry can be visible as **Discovered only** while remaining absent from the selectable model dropdown.

Canonical OpenRouter evidence:

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

The older Session 1 checkpoint contains intermediate 30-second / 512-token wording; current code and this checkpoint supersede those figures.

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

At Session 3 runtime closure:

```text
live remote branch count         = 13
known bookkeeping ref            = docs/current-safe-resume-20260928
known merged Session 1 ref       = fix/nvidia-credential-test-timeout-20260928
known merged Session 2 ref       = feat/openrouter-model-registry-session2-20260928
known merged Session 3 ref       = feat/openrouter-model-discovery-session3-20260928
unexpected active work refs      = 0
open pull requests               = 0
```

The temporary docs-closure branch created after this runtime checkpoint is bookkeeping for current-state convergence and is not a product/runtime implementation scope.

These later refs are known bookkeeping/provenance refs, not active implementation scopes.

Future branch growth must be handled as an exact-SHA delta. Do not rerun historical cleanup classifications simply for freshness.

## Deferred / separately selectable scopes

None of these is active:

- selected OpenRouter discovered-model admission/verification;
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

A later OpenRouter model-admission scope must be selected explicitly and must verify models individually. Catalog presence, catalog pricing strings, a mutable alias, or marketing capability metadata must not silently become execution authority.

## Safe resume procedure

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read this checkpoint;
6. use the Session 3 + Session 2 OpenRouter checkpoints, NVIDIA checkpoints, and ECX checkpoint as supporting evidence;
7. open exactly one new scope only after explicit operator authorization;
8. do not infer a next numbered batch/session from historical documents.

## Bottom line

ECORIONE is at a clean handoff point: OpenRouter Session 3 is closed, staging verified, and the current runtime is healthy. Live discovery is available without widening executable admission.

There is **no active product/runtime implementation batch**. A future selected-model admission/verification scope is only eligible after explicit authorization; no Session 4 is active implicitly.
