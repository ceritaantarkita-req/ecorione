# ECORIONE — Safe Resume Checkpoint — 2026-09-28

Status: **CURRENT / SAFE TO RESUME / NO ACTIVE PRODUCT-RUNTIME BATCH**

## Purpose

Freeze the exact safe handoff point after the closed ECX Batch 1–7 work, NVIDIA hosted-provider rollout and connection-test hardening, and OpenRouter model-registry Session 2.

This is the preferred resume pointer for the next ECORIONE session. Do **not** restart completed roadmaps or reconstruct the project from old planning notes.

## Repository audit boundary

```text
repository                       = ceritaantarkita-req/ecorione
audited runtime main             = 9f19b40cea4b9f6266caba6f8997a5c2bae67df5
latest runtime closure           = PR #389
PR #389 reviewed head            = 203775e1b37237994a48b232f4184facb8fec1ea
PR #389 merge SHA                = 9f19b40cea4b9f6266caba6f8997a5c2bae67df5
PR #389 exact-head CI            = #2428 PASS
PR #389 exact-head Product Eval  = #1667 PASS
merged-main CI                   = #2429 PASS
merged-main Product Eval         = #1668 PASS
open pull requests               = 0
live remote branches             = 12
open issue at audit boundary     = #277 DR-2 physical independence
```

The documentation branch used to maintain this pointer is bookkeeping only and does not open a product/runtime scope.

## Runtime / staging compatibility baseline

The latest audited runtime-changing merge is:

```text
runtime-changing baseline = 9f19b40cea4b9f6266caba6f8997a5c2bae67df5
staging image             = staging-9f19b40cea4b
Staging Deploy gate       = #1618 PASS
actual Staging Deploy     = #1619 PASS
Operations                = healthy
configured/running        = 15 / 15
non-running               = 0
stabilized free disk      = 29.90 GiB
```

Staging Deploy #1619 built and deployed the exact merge SHA and passed the protected-route, MCP, Operations, host-evidence, and capacity checks.

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
- OpenRouter model-registry Session 2.

There is no implicit Batch 8, PE-09, PCS-11, Batch 13, A-12 continuation, or automatic provider Session 3.

## OpenRouter Session 2 state

Session 2 is **CLOSED / PASS / STAGING VERIFIED**.

The hosted model boundary now has an extensible registry that can represent provider/runtime identity, source provider, optional discovery metadata, pricing authority, verification state, catalog provenance, and freshness.

The runtime preference schema is string-shaped for future extensibility, but execution is still fail-closed. A provider/model pair must resolve to an executable verified registry entry with an admitted pricing identity before routing can proceed.

Current OpenRouter executable/selectable models remain:

```text
Claude Sonnet 4.5 -> anthropic/claude-sonnet-4.5
Claude Opus 4.1   -> anthropic/claude-opus-4.1
```

No GPT, DeepSeek, Qwen, GLM, Kimi, Gemini, Llama, or other OpenRouter model is claimed selectable yet.

Canonical Session 2 evidence:

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

At Session 2 runtime closure:

```text
live remote branch count       = 12
known bookkeeping ref          = docs/current-safe-resume-20260928
known merged Session 1 ref     = fix/nvidia-credential-test-timeout-20260928
known merged Session 2 ref     = feat/openrouter-model-registry-session2-20260928
unexpected active work refs    = 0
open pull requests             = 0
```

These later refs are known bookkeeping/provenance refs, not active implementation scopes.

Future branch growth must be handled as an exact-SHA delta. Do not rerun historical cleanup classifications simply for freshness.

## Deferred / separately selectable scopes

None of these is active:

- **OpenRouter Session 3 — live model discovery/search/cache and discovered-vs-admitted model state**;
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

## Safe resume procedure

For the next session or agent:

1. inspect exact current `main`;
2. read `docs/current-state-and-next-steps.md`;
3. read `docs/active-work-plan.md`;
4. read `AGENTS.md`;
5. read this checkpoint;
6. use the Session 2, NVIDIA, and ECX dated checkpoints as supporting evidence;
7. open exactly one new scope only after explicit operator authorization;
8. do not infer a next numbered batch/session from historical documents.

## Bottom line

ECORIONE is at a clean handoff point: OpenRouter Session 2 is closed and deployed, the current runtime is healthy, no pull request is open, and there is **no active product/runtime implementation batch**.

The next eligible provider scope is Session 3 discovery, but it is not active until explicitly authorized.
