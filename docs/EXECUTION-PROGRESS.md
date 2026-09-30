# ECORIONE — Execution Progress

Last updated: **2026-09-30**

Status: **CURRENT SUMMARY**

## Audited repository/staging baseline

Latest audited runtime-changing baseline:

```text
runtime / staging       = 2c223ea8c54045de3dc5e6b15971bdb2a898e2fe (PR #409)
image                   = staging-2c223ea8c540
CI                      = #2586 PASS
Product Eval            = #1825 PASS
Staging Deploy          = #1922 PASS
Operations              = healthy
services                = 15/15 running
free disk               = 27.35 GiB stabilized
```

This includes the NVIDIA hosted-provider capability and connection-test hardening; OpenRouter Sessions 2–4D; post-#402 stabilization; and two Session 4E runtime slices. Session 4E now allows fresh compatible OpenRouter catalog models to be selected/executed without normal-user model-by-model certification and exposes the canonical adjacent `[Provider / Source ▼] [Model ▼]` composer controls with provider-specific model choices.

Session 4E is **ACTIVE / PARTIAL**. Auto-execution/pricing, canonical selectors, and direct `+ Tambah AI` onboarding are closed; the next bounded slice is the multi-credential provider foundation with priority/failover.

## Closed foundational roadmaps

| Scope | State |
|---|---|
| Fase 0–4 / original Batch 1–12 | CLOSED |
| W-series through W20 | CLOSED at documented boundaries |
| F6-E01 through F6-E08 | CLOSED / REPO-SIDE PASS |
| Windows runtime + installer | VERIFIED |
| Native Windows portability / EOL policy | CLOSED / PASS |
| Product Evolution PE-00..PE-08 | CLOSED / PASS |
| PCS-00..PCS-10 | CLOSED / PASS |
| 2026-09-24 selected audit follow-ups through A-11 | CLOSED / PASS |
| Original Off-host DR | CLOSED / PASS at documented boundary |

## Product Evolution

| Batch | State |
|---|---|
| PE-00 Architecture lock | CLOSED / PASS |
| PE-01 Project foundation | CLOSED / PASS |
| PE-02 Project Sources | CLOSED / PASS |
| PE-03 Trigger control plane | CLOSED / PASS |
| PE-04 Work + Schedule + Runs | CLOSED / PASS |
| PE-05 Event/Webhook automation | CLOSED / PASS |
| PE-06 Brain V1 | CLOSED / PASS |
| PE-07 Brain + Context + ECX | CLOSED / PASS |
| PE-08 Product closure | CLOSED / PASS |

No PE-09 is active.

## Post-closure PCS roadmap

| Scope | State |
|---|---|
| PCS-00 Baseline lock | CLOSED / PASS |
| PCS-01 Chat continuity/history | CLOSED / PASS |
| PCS-02 Provider onboarding + hosted model choice | CLOSED / PASS |
| PCS-03 Local AI resilience/runtime discovery | CLOSED / PASS |
| PCS-04 Visual + information-architecture cleanup | CLOSED / PASS |
| PCS-05 Flow runtime defect closure | CLOSED / PASS |
| PCS-06 Integrated browser/regression acceptance | CLOSED / PASS |
| PCS-07 SumoPod remote staging | CLOSED / PASS |
| PCS-08 GitHub -> staging continuous deployment | CLOSED / PASS |
| PCS-09 Staging persistence/security/backup/observability | CLOSED / PASS |
| PCS-10 Closure/docs | CLOSED / PASS |

No PCS-11 is active.

## Audit follow-ups

| Scope | State |
|---|---|
| A-00 human authentication | CLOSED / PASS |
| A-12 remote-bind auth | CLOSED / PASS |
| A-01 internal HTTP deadlines | CLOSED / PASS |
| A-13 Space/Flow default port | CLOSED / PASS |
| A-02 virtual All | CLOSED / PASS |
| A-03 stale Project selection | CLOSED / PASS |
| A-04 Project settings | CLOSED / PASS |
| A-05 generic source onboarding boundary | CLOSED / PASS |
| A-06 Schedule | CLOSED / PASS |
| A-07 Brain scalable layout | CLOSED / PASS |
| A-08 Brain owner-backed projection/assistant boundary | CLOSED / PASS |
| A-09 frontend decomposition | CLOSED / PASS |
| A-10 Compose readiness/health | CLOSED / PASS |
| A-11 browser Workspace context | CLOSED / PASS |

No next A-series item is active.

## ECX Recipient Execution roadmap

| Batch | State |
|---|---|
| Batch 1 — Recipient Execution Foundation | CLOSED / PASS |
| Batch 2 — Execution Contract + Idempotency + Provenance | CLOSED / PASS |
| Batch 3 — Real Agent A -> Agent B round trip | CLOSED / PASS |
| Batch 4 — Security, isolation, result integration | CLOSED / PASS |
| Batch 5 — End-to-end observability, quality, economics | CLOSED / PASS |
| Batch 6 — Historical Ledger retention/compaction/migration | CLOSED / PASS |
| Batch 7 — Advanced execution/productization | CLOSED / PASS |

Canonical final ECX evidence:
[verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

No Batch 8 is active or implied.

### Current ECX capability summary

- governed single-recipient execution;
- durable execution idempotency/replay;
- single-recipient `delta` and `full` round trip;
- result-receive authority and isolation;
- usage/cost observability;
- deterministic offline quality/economics evidence;
- Historical Ledger archive/compaction with exact replay;
- deterministic 2–8 recipient `delta` fan-out;
- one durable fan-out receipt;
- exactly one parent aggregate continuation;
- 65,536-byte per-child and 131,072-byte aggregate bounds.

## Staging

Current exact runtime:

```text
SHA   = 2c223ea8c54045de3dc5e6b15971bdb2a898e2fe
image = staging-2c223ea8c540
```

Actual Staging Deploy #1922 proved:

- exact target/host SHA match;
- clean detached staging worktree;
- public auth/protected-route smoke PASS;
- MCP metadata/challenge checks PASS;
- Operations healthy;
- 0 unhealthy services;
- 15 configured / 15 running;
- image `staging-2c223ea8c540`;
- 23.91 GiB free at sanitized host evidence before cleanup;
- stale staging image cleanup completed while retaining the new and previous rollback-set images;
- 27.35 GiB stabilized free disk.

Staging Deploy #1892 is preserved as valid gate-only evidence; its deploy job was skipped and it is not runtime deployment proof.

NVIDIA / NIM remains live with pinned `z-ai/glm-5.3`. Current source uses 60-second default credential/canary deadlines, a 1024-token NVIDIA health-probe cap with low reasoning effort, and explicit `PROVIDER_TEST_TIMEOUT`. The user's actual API key is not claimed validated.

Current Session 4E checkpoint:
[verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md](verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md).

This is staging evidence, not production promotion.

## OpenRouter provider foundation / Session 4E

| Scope | State |
|---|---|
| Session 1 — NVIDIA connection-test hardening | CLOSED / PASS |
| Session 2 — OpenRouter extensible model registry foundation | CLOSED / PASS |
| Session 3 — OpenRouter live discovery/search/cache | CLOSED / PASS / STAGING VERIFIED |
| Session 4A — OpenRouter model-family foundation | CLOSED / PASS / STAGING VERIFIED |
| Session 4B — OpenRouter automatic target-family admission | CLOSED / PASS / STAGING VERIFIED |
| Session 4C — OpenRouter Settings model picker | CLOSED / PASS / STAGING VERIFIED |
| Session 4D — OpenRouter Ai chat quick-switch | CLOSED / PASS / STAGING VERIFIED |
| Session 4E slice 1 — compatible auto-execution + catalog pricing | CLOSED / PASS / STAGING VERIFIED |
| Session 4E slice 2 — canonical provider/model selectors | CLOSED / PASS / STAGING VERIFIED |
| Session 4E slice 3 — direct + Tambah AI onboarding | CLOSED / PASS / STAGING VERIFIED |
| Session 4E overall | ACTIVE / PARTIAL |

Session 4E slice 2 closed through PR #409. Exact reviewed head `2efc0b56b9cc97f7ccdd11a13f7a4b979204945b` passed CI #2571, Product Eval #1810, and PCS-06 #354; merged main `2c223ea8c54045de3dc5e6b15971bdb2a898e2fe` passed CI #2586 + Product Eval #1825; actual Staging Deploy #1922 passed.

Current behavior:

- fresh qualifying OpenRouter models can be selected and used without normal-user model-by-model `Test & Enable`;
- dynamic execution authority is minted only by the trusted Connect admission path;
- dispatch re-checks the exact selected model against fresh selectable catalog metadata and valid input/output pricing;
- catalog input/output price per 1M tokens is visible in Ai;
- provider-reported billed cost remains authoritative when supplied;
- mutable aliases, stale/incompatible models, and invalid/missing pricing remain fail-closed;
- generic runtime PATCH cannot grant dynamic execution authority.

Next bounded Session 4E slice:

- implement multiple AI Connections/API keys beneath one logical provider;
- preserve Connect/Vault as sole credential owner;
- add stable connection identity, enabled state, priority/order, and non-secret per-attempt provenance;
- choose the highest-priority usable connection and use bounded failover only for availability/auth/provider failures;
- never fail over around policy, spend, sensitivity, or operator denial;
- keep one logical provider row in Ai.

Bounded Local↔Cloud handoff behavior and custom-provider onboarding remain later Session 4E work.

Canonical Session 4E checkpoint:
[verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md](verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md).

Prior Session 4D checkpoint:
[verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md).

## DR

| Scope | State |
|---|---|
| Original total-SumoPod-host-loss recovery | CLOSED / PASS |
| DR-2 checkpoint 1 repository foundation | CLOSED / PASS |
| DR-2 checkpoint 2 external target selection | DEFERRED / SAFE-PAUSED |
| DR-2 physical-independence runtime proof | NOT YET PROVEN |
| Production promotion | DEFERRED / SEPARATE GATE |

Issue #277 remains the DR-2 tracker.

## Repository hygiene

| Cleanup scope | State |
|---|---|
| Historical 393-entry exact-SHA cleanup | CLOSED / PASS |
| Post-ECX branch delta cleanup | CLOSED / PASS |
| Cleanup-boundary retained inventory | 9 branches |
| Current live inventory | exact count is bookkeeping-only; inspect GitHub when a new hygiene scope is explicitly opened |

Post-ECX Actions run `36338085729` dry-ran 15/15 allowlisted branches with zero hold/fail/skip, deleted all 15, exact-validated and deleted 2 reconciliation branches, self-deleted its helper, and proved:

```text
POST_ECX_BRANCHES_DELETED=17
FINAL_REMOTE_BRANCH_COUNT=9
POST_ECX_BRANCH_CLEANUP=PASS
```

Evidence:

- [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)

## Current work state

| Scope | State |
|---|---|
| Product/runtime implementation | NONE ACTIVE |
| Repository truth/docs reconciliation | CLOSED / PASS |
| Post-ECX branch delta cleanup | CLOSED / PASS |
| NVIDIA hosted-provider trial | CLOSED / PASS |
| NVIDIA work-branch cleanup | CLOSED / PASS |
| NVIDIA connection-test Session 1 | CLOSED / PASS |
| OpenRouter model-registry Session 2 | CLOSED / PASS |
| OpenRouter live-discovery Session 3 | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter model-family Session 4A | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter automatic-admission Session 4B | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter Settings model-picker Session 4C | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter Ai chat quick-switch Session 4D | CLOSED / PASS / STAGING VERIFIED |
| Repository-hygiene queue | NONE ACTIVE |
| DR-2 checkpoint 2 | DEFERRED |
| Production cutover | DEFERRED |

Latest overall safe-resume checkpoint:
[verification/ecorione-safe-resume-checkpoint-2026-09-29.md](verification/ecorione-safe-resume-checkpoint-2026-09-29.md).

Underlying NVIDIA/runtime evidence:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).
