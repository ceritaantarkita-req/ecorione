# ECORIONE — Active Work Plan

Last updated: **2026-10-01**

Status: **SESSION 4E + 4F INTEGRATION CANDIDATE / READY FOR LOCAL ACCEPTANCE / NOT MERGED / MAIN + STAGING UNCHANGED**

Current integration resume pointer: [verification/session4ef-integration-local-acceptance-checkpoint-2026-10-01.md](verification/session4ef-integration-local-acceptance-checkpoint-2026-10-01.md). This status applies only to `feat/session4ef-integration-20261001`. Canonical `main` remains `c3ef2f186f465c2942b552974e47333c797cb4a1`; the latest staging-verified runtime baseline remains `15dc2a131778c2fe1249dda34e3291f9a3c8beae` from PR #415, image `staging-15dc2a131778`. Do not claim Session 4E/4F merged or staging-verified until local acceptance, exact-head CI, merge, and staging convergence complete.

## Current queue

There is **no active Product Evolution, PCS, A-series, original Batch, or ECX numbered implementation batch**.

Closed current baselines:

- original Batch 1–12 / W / F6 — CLOSED at documented boundaries;
- PE-00..PE-08 — CLOSED / PASS;
- PCS-00..PCS-10 — CLOSED / PASS;
- selected 2026-09-24 audit follow-ups through A-11 — CLOSED / PASS;
- original Off-host DR — CLOSED / PASS at documented boundary;
- ECX Recipient Execution Batch 1–7 — CLOSED / PASS;
- NVIDIA hosted-provider trial + staging activation + Docker native-build hardening — CLOSED / PASS;
- NVIDIA connection-test Session 1 hardening — CLOSED / PASS;
- OpenRouter model-registry Session 2 — CLOSED / PASS;
- OpenRouter live-discovery Session 3 — CLOSED / PASS / STAGING VERIFIED;
- OpenRouter model-family Session 4A — CLOSED / PASS / STAGING VERIFIED;
- OpenRouter automatic-admission Session 4B — CLOSED / PASS / STAGING VERIFIED;
- OpenRouter Settings model-picker Session 4C — CLOSED / PASS / STAGING VERIFIED;
- OpenRouter Ai chat quick-switch Session 4D — CLOSED / PASS / STAGING VERIFIED;
- Session 4E slice 1 — compatible OpenRouter auto-execution + visible catalog pricing — CLOSED / PASS / STAGING VERIFIED through PR #407;
- Session 4E slice 2 — canonical provider/source + provider-specific model selectors — CLOSED / PASS / STAGING VERIFIED through PR #409;
- Session 4E slice 3 — direct `+ Tambah AI` onboarding — CLOSED / PASS / STAGING VERIFIED through PR #411;
- Session 4E slice 4 — multi-credential AI Connections + bounded failover — CLOSED / PASS / STAGING VERIFIED through PR #415.

No Batch 8, PE-09, PCS-11, Batch 13, or next A-series item is automatically opened.

## Repository housekeeping

Repository/documentation reconciliation and the post-ECX branch cleanup are both **CLOSED / PASS**.

Latest hygiene executions:

```text
post-ECX cleanup run         = 36338085729
NVIDIA trial cleanup run     = 36368987090
NVIDIA work branches deleted = 3
helpers self-deleted         = yes
final remote branch count    = 9
unexpected branches          = 0
```

Evidence:

- [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)

The completed cleanup runs each ended at 9 retained branches. Later OpenRouter implementation and documentation refs are provenance/bookkeeping delta; there is no active repository-hygiene queue.

Future non-bookkeeping branch growth must be handled as a new exact-SHA delta, not by rerunning historical cleanups.

## ECX Recipient Execution baseline — CLOSED / PASS

| Batch | State |
|---|---|
| 1 — Recipient Execution Foundation | CLOSED / PASS |
| 2 — Execution Contract + Idempotency + Provenance | CLOSED / PASS |
| 3 — Real Agent A -> Agent B round trip | CLOSED / PASS |
| 4 — Security, isolation, result integration | CLOSED / PASS |
| 5 — End-to-end observability, quality, economics | CLOSED / PASS |
| 6 — Historical Ledger retention/compaction/migration | CLOSED / PASS |
| 7 — Advanced execution/productization | CLOSED / PASS |

Canonical final checkpoint:
[verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

Do not restart B1–B7 for freshness.

## NVIDIA hosted-provider trial — CLOSED / PASS

Current proven boundary:

- provider `nvidia` / NVIDIA / NIM is live in Settings and Connect;
- pinned hosted model is `z-ai/glm-5.3`;
- staging operator hosted kill switch is open under bounded spend controls; runtime hosted activation still follows the normal Settings/provider activation path;
- Docker native dependency fallback is hardened and proven on SumoPod;
- the latest runtime-changing merge and staging are converged at `9bc4cfd1bbfb2b2aed7bef1ec4de24024bd491d7` / `staging-9bc4cfd1bbfb`;
- current credential/canary default deadlines are 60 seconds; NVIDIA health probes use a bounded 1024-token output cap with low reasoning effort;
- provider-canary latency deadlines are now enforced;
- user NVIDIA secret has not been stored and is not claimed validated.

User-level validation is not a new implementation batch. It is a normal Settings action: enter key -> Test API key -> Save & activate -> send one Ai message.

Latest Session 1 checkpoint:
[verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md](verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md).

Underlying provider/runtime checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

Overall safe-resume checkpoint:
[verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md](verification/session4e-direct-ai-onboarding-safe-checkpoint-2026-09-30.md).

## OpenRouter Sessions 2–4E — 4E ACTIVE / PARTIAL

> **Accepted UX contract:** [ai-provider-model-ux-contract.md](ai-provider-model-ux-contract.md).

Sessions 2–4D remain CLOSED / PASS at their documented boundaries. Session 4E is active.

### Session 4E first runtime slice — CLOSED / PASS / STAGING VERIFIED

PR #407 removed the normal-user model-by-model certification requirement for fresh compatible OpenRouter catalog models while keeping execution governance inside Connect.

Implemented and proven:

- compatible fresh OpenRouter catalog models appear directly in the Ai model picker;
- selecting a compatible dynamic model activates trusted Connect-owned execution authority without a user `Test & Enable` step;
- catalog input/output price per 1M tokens is visible in the Ai picker;
- Connect re-checks the exact dynamic model against fresh catalog identity, capability admission, and valid pricing before each paid dispatch;
- stale/incompatible candidates, mutable aliases, missing/invalid pricing, and unavailable models remain fail-closed;
- OpenRouter provider-reported billed cost remains authoritative when supplied;
- generic runtime settings mutation cannot mint dynamic OpenRouter execution authority;
- existing spend budget, kill switch, credentials/Vault, sensitivity, audit, and no-silent-fallback boundaries remain intact.

Proof:

```text
PR #407 reviewed head = 5b9a29085287db035c2c52dd6ea783c2d93ceac4
PR-head CI            = #2555 PASS
PR-head Product Eval  = #1794 PASS
PR-head PCS-06        = #341 PASS
merged main           = bb2983d59dbe292c510fbc28aae297bcb23487c4
merged-main CI        = #2556 PASS
merged-main Eval      = #1795 PASS
Staging Deploy        = #1863 PASS
image                 = staging-bb2983d59dbe
services              = 15/15 running
Operations            = healthy
stabilized free disk  = 29.89 GiB
```

Canonical checkpoint:
[verification/session4e-openrouter-auto-execution-safe-checkpoint-2026-09-30.md](verification/session4e-openrouter-auto-execution-safe-checkpoint-2026-09-30.md).

### Current Session 4E queue

The next bounded implementation slice is **`+ Tambah AI → Lainnya` custom OpenAI-compatible provider onboarding**:

1. collect Name, Base URL, API key, and model/model-discovery information from Ai;
2. keep secrets exclusively under Connect/Vault ownership;
3. validate endpoint, credential, and model through a bounded Connect-owned probe before activation;
4. reject credential-bearing URLs and preserve existing SSRF/network-policy boundaries;
5. preserve spend governance; unknown providers must not silently bypass cost admission;
6. surface the custom provider as one logical provider/source after successful onboarding;
7. keep advanced custom headers/auth/discovery options behind progressive disclosure;
8. do not mix broad Local↔Cloud context-handoff redesign into this slice unless an invariant requires it.

The auto-execution, canonical selector, direct `+ Tambah AI`, and multi-credential slices are already CLOSED / PASS / STAGING VERIFIED through PR #407, #409, #411, and #415 and must not be redone.

After custom-provider onboarding, remaining Session 4E work includes bounded Local↔Cloud context handoff and broader live cross-provider completion evidence where real credentials/providers are available.

Session 4F remains a later independent closure/polish scope.

## DR-2

Issue #277 remains open but **DR-2 runtime work is not active**.

Current state:

- checkpoint 1 repository foundation — CLOSED / PASS;
- checkpoint 2 external-target selection — DEFERRED / SAFE-PAUSED;
- physical-independence runtime proof — NOT YET PROVEN;
- local backup — interim posture;
- encrypted Google Drive copy — possible later secondary copy, not currently a validated DR-2 target.

Do not select/provision/pay for external infrastructure without explicit operator authorization.

## Production

Public production promotion remains **DEFERRED / SEPARATE GATE**.

SumoPod is current verified staging.

Do not reinterpret staging Basic Auth, staging runtime evidence, or DR evidence as final production authorization/SLA.

## Separately selectable future scopes

The following remain outside the active Session 4E custom-provider slice unless explicitly opened:

- Session 4F final OpenRouter polish/closure after Session 4E is complete;
- DR-2 checkpoint 2;
- production cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- hosted-provider paid reruns/W18 freshness;
- external A2A;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge;
- broad ECX/History UI;
- automatic destructive Ledger purge;
- AutoClick / L4 autonomy.

## Rules for the next implementation scope

When the operator selects the next real scope:

1. start from exact synchronized `main`;
2. name the scope explicitly;
3. for Session 4E, treat [ai-provider-model-ux-contract.md](ai-provider-model-ux-contract.md) as the accepted behavior contract before coding;
4. keep service ownership unchanged unless an explicit architecture decision says otherwise;
5. add deterministic tests for new behavior;
6. require exact-head gates;
7. merge only reviewed head;
8. prove merged-main gates;
9. deploy exact reviewed `main` to staging only when the scope changes runtime;
10. update current docs once, after the real state is known;
11. keep dated evidence historical.

Do not create documentation-only “next batches” simply to continue numbering.
