# ECORIONE — Execution Progress

Last updated: **2026-10-04**

Status: **CURRENT SUMMARY / SESSION 12D REPOSITORY+MOCK GREEN / SUMOPOD ACTIVE-STAGING ROLE RETIRED / REAL LOCAL GOOGLE OAUTH+PICKER ACCEPTANCE NEXT**

## Current operating state — 2026-10-04

```text
GitHub main                 = bd8d2513aa21164e5a1f6d36b898d8140b57506a
active scope                = Session 12D Native Google Drive closure
12A                         = MERGED / quality gates PASS
12B                         = MERGED / quality gates PASS / no successful new remote-staging proof
12C                         = MERGED / quality gates PASS / base product merge 4326e77...
12D support                 = #448 MERGED / local preflight + runbook on current main
12D                         = PR #444 DRAFT / repository+mock acceptance CLOSED / PASS
12D reviewed head           = 1e4f58c7d9dd4dc9f09687fbdd393261f38830f8
12D exact-head gates        = CI #2819 / Eval #2058 / MCP #1320 / Browser #471 / Desktop #346 PASS
active remote staging       = NONE
last proven SumoPod runtime = 084d669d8631a2590e7a9e88b62e161691bf4fc9
next gate                   = real local Google OAuth + Picker acceptance
```

SumoPod was retired from the active staging role by operator decision on 2026-10-03. Historical PCS/staging/DR evidence below remains valid at its dated boundary; it is not the current deployment target.

Current transition evidence:
[verification/sumopod-retirement-local-first-transition-2026-10-03.md](verification/sumopod-retirement-local-first-transition-2026-10-03.md).

## Audited repository/staging baseline

Latest audited runtime-changing baseline:

```text
runtime / staging       = 15f007c5d248df8319644f2d9a6c4c7905c70681 (PR #421)
image                   = staging-15f007c5d248
CI                      = #2610 PASS
Product Eval            = #1849 PASS
MCP External HTTPS      = #1204 PASS
PR browser acceptance   = #374 PASS
Staging Deploy          = #1968 PASS
Operations              = healthy
services                = 15/15 running
free disk               = 27.39 GiB stabilized
```

This baseline includes closed Sessions 4E/4F, Session 5 Project Source Picker productization, and Session 6 External Source Lifecycle. Session 6 adds explicit URL/MCP snapshot lifecycle metadata, content-addressed refresh semantics, direct text indexing into Context, and Refresh/Index/Re-index UX while preserving owner-backed source boundaries.

Session 12 Native Google Drive is the active explicitly authorized implementation scope. 12D repository/mock acceptance is closed; real local Google OAuth + Picker acceptance is the next bounded gate.

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

## Historical remote staging

There is no active remote staging target. The following older runtime record is retained as historical evidence, not current deployment truth.

Historical exact runtime:

```text
SHA   = 15f007c5d248df8319644f2d9a6c4c7905c70681
image = staging-15f007c5d248
```

Actual Staging Deploy #1968 proved:

- exact target/host SHA match;
- clean detached staging worktree;
- public auth/protected-route smoke PASS;
- MCP metadata/challenge checks PASS;
- Operations healthy with no unhealthy services;
- 15 configured / 15 running;
- image `staging-15f007c5d248`;
- stale staging image cleanup retained the new and previous rollback-set images;
- 27.39 GiB stabilized free disk.

Staging Deploy #1967 is preserved as valid gate-only evidence; #1968 is the actual runtime deployment proof.

NVIDIA / NIM remains live with pinned `z-ai/glm-5.3`. Current source uses 60-second default credential/canary deadlines, a 1024-token NVIDIA health-probe cap with low reasoning effort, and explicit `PROVIDER_TEST_TIMEOUT`. The user's actual API key is not claimed validated.

Current Session 6 checkpoint:
[verification/session6-external-source-lifecycle-closure-2026-10-01.md](verification/session6-external-source-lifecycle-closure-2026-10-01.md).

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
| Session 4E slice 4 — multi-credential AI Connections + bounded failover | CLOSED / PASS / STAGING VERIFIED |
| Session 4E final integration | CLOSED / PASS / STAGING VERIFIED |
| Session 4F provider/model UX closure | CLOSED / PASS / STAGING VERIFIED |
| Session 5 Project Source Picker | CLOSED / PASS / STAGING VERIFIED |
| Session 6 External Source Lifecycle | CLOSED / PASS / STAGING VERIFIED |

Sessions 4E and 4F are fully closed through PR #417 and their canonical closure checkpoint. Current behavior includes compatible dynamic OpenRouter execution, visible catalog pricing, adjacent provider/model selectors, direct provider onboarding, multi-credential priority/failover, bounded custom OpenAI-compatible onboarding, and Local↔Hosted context isolation. There is no remaining Session 4E/4F implementation queue.

Canonical Session 4E/4F checkpoint:
[verification/session4ef-closure-2026-10-01.md](verification/session4ef-closure-2026-10-01.md).

Session 5 Project Source Picker is fully closed through PR #419 and Staging Deploy #1958.

Session 6 External Source Lifecycle is fully closed through PR #421 and Staging Deploy #1968. Canonical Session 6 checkpoint:
[verification/session6-external-source-lifecycle-closure-2026-10-01.md](verification/session6-external-source-lifecycle-closure-2026-10-01.md).

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
| Product/runtime implementation | SESSION 12D CLOSURE ACTIVE — 12A–12C MERGED; #448 ON MAIN; #444 REPOSITORY+MOCK GREEN / REAL LOCAL GOOGLE ACCEPTANCE PENDING |
| Repository truth/docs reconciliation | SESSION 6 CURRENT TRUTH CLOSED / PASS |
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
| Session 4E + 4F final integration | CLOSED / PASS / STAGING VERIFIED |
| Session 5 Project Source Picker | CLOSED / PASS / STAGING VERIFIED |
| Session 6 External Source Lifecycle | CLOSED / PASS / STAGING VERIFIED |
| Session 12 Native Google Drive | ACTIVE / 12D REPOSITORY+MOCK CLOSED / REAL LOCAL GOOGLE OAUTH+PICKER ACCEPTANCE NEXT |
| Repository-hygiene queue | NONE ACTIVE |
| DR-2 checkpoint 2 | DEFERRED |
| Production cutover | DEFERRED |

Latest overall safe-resume checkpoint:
[verification/session6-external-source-lifecycle-closure-2026-10-01.md](verification/session6-external-source-lifecycle-closure-2026-10-01.md).

Underlying NVIDIA/runtime evidence:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).
