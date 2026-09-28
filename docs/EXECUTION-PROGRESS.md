# ECORIONE — Execution Progress

Last updated: **2026-09-28**

Status: **CURRENT SUMMARY**

## Audited repository/staging baseline

Latest audited runtime-changing baseline:

```text
runtime / staging       = af2ef8f61f26058178e56b0d6490248c1898976e (PR #391)
image                   = staging-af2ef8f61f26
CI                      = #2457 PASS
Product Eval            = #1696 PASS
Staging Deploy          = #1675 PASS
Operations              = healthy
services                = 15/15 running
free disk               = 25.33 GiB stabilized
```

This includes the NVIDIA hosted-provider capability and connection-test hardening plus the OpenRouter extensible model-registry foundation from Session 2 and bounded live discovery/search/cache from Session 3.

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
SHA   = af2ef8f61f26058178e56b0d6490248c1898976e
image = staging-af2ef8f61f26
```

Actual Staging Deploy #1675 proved:

- native builder installed `python3 make g++`;
- `better-sqlite3` fallback installation completed;
- auth/protected-route checks PASS;
- MCP metadata/challenge checks PASS;
- Operations healthy;
- 0 unhealthy services;
- 15 configured / 15 running;
- exact SHA match;
- 25.33 GiB stabilized free disk.

The preceding Staging Deploy #1505 is preserved as valid failed evidence: the one-time hosted-trial host migration passed, image build failed because the old slim builder lacked Python, and governed rollback to `41fdedf...` fully revalidated.

NVIDIA / NIM remains live with pinned `z-ai/glm-5.3`. Current source uses 60-second default credential/canary deadlines, a 1024-token NVIDIA health-probe cap with low reasoning effort, and explicit `PROVIDER_TEST_TIMEOUT`. The user's actual API key is not claimed validated.

Latest checkpoint:
[verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md](verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md).

Underlying rollout checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

This is staging evidence, not production promotion.


## OpenRouter provider foundation

| Scope | State |
|---|---|
| Session 1 — NVIDIA connection-test hardening | CLOSED / PASS |
| Session 2 — OpenRouter extensible model registry foundation | CLOSED / PASS |
| Session 3 — OpenRouter live discovery/search/cache | CLOSED / PASS / STAGING VERIFIED |

Session 3 adds bounded live catalog discovery while preserving Session 2 admission rules. The current OpenRouter selectable set remains Claude Sonnet 4.5 and Claude Opus 4.1; other catalog models are discovery-only until separately admitted.

Canonical Session 3 checkpoint:
[verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md).

Underlying Session 2 checkpoint:
[verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md).

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
| Current live inventory after Session 3 runtime closure | 13 branches (4 known bookkeeping/provenance refs beyond cleanup boundary) |

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
| Repository-hygiene queue | NONE ACTIVE |
| DR-2 checkpoint 2 | DEFERRED |
| Production cutover | DEFERRED |

Latest overall safe-resume checkpoint:
[verification/ecorione-safe-resume-checkpoint-2026-09-28.md](verification/ecorione-safe-resume-checkpoint-2026-09-28.md).

Underlying NVIDIA/runtime evidence:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).
