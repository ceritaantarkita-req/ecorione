# ECORIONE — Current State & Next Steps

Last updated: **2026-10-02**

Status: **CURRENT / SESSION 10 DETERMINISTIC CONDITION TRIGGER CLOSED-PASS-STAGING VERIFIED / DR-2 CHECKPOINT 2 DEFERRED / PRODUCTION CUTOVER DEFERRED**

## Repository identity

```text
repository                 = ceritaantarkita-req/ecorione
default branch             = main
runtime-changing main      = 222b47403a9c6df3f29580a70cca53e2dff40263 (PR #429 merge)
session 10 reviewed head   = f5c7ddfa53473e2179be3aad7b453c5adb4060ba (PR #429 head)
staging-verified runtime   = 222b47403a9c6df3f29580a70cca53e2dff40263
staging image              = staging-222b47403a9c
```

Sessions 4E and 4F are CLOSED / PASS / STAGING VERIFIED through PR #417. Exact PR head `93c3230b552e479194b756135a5458d8a6fd001e` passed CI #2600, Product Eval #1839, and PCS-06 Integrated Browser Acceptance #371. It merged to `main` as `6170ee5d67ee4b105771d8ce2c348afba6cce896`; merged-main CI #2601 and Product Eval #1840 passed, and actual Staging Deploy #1950 deployed exact SHA `6170ee5d...` as `staging-6170ee5d67ee`. Public/auth and MCP smoke passed, Operations reported `healthy: true`, exact-host identity matched with a clean worktree, all **15/15** configured services were running, and capacity stabilized at **29.95 GiB free**.

The Ai composer uses adjacent `[Provider / Source ▼] [Model ▼]` controls with direct `+ Tambah AI` onboarding. One logical provider may own multiple encrypted AI Connections/API keys with priority/failover. `Lainnya / Custom OpenAI-compatible` now has bounded public-HTTPS onboarding and Connect-owned validation/Vault persistence. Local↔Hosted continuity preserves the existing Project-scoped hosted-eligible context boundary rather than silently uploading local-only history. Dynamic certified OpenRouter models now carry their fresh pricing snapshot through reservation and normal completion. Real success-path proof for an arbitrary custom endpoint remains dependent on a user-controlled endpoint/credential and is not an open implementation item.

Session 5 Project Source Picker is CLOSED / PASS / STAGING VERIFIED through PR #419. Projects expose searchable owner-backed Artifact, Space page, Flow graph, and MCP-server source choices while preserving Source/Reference roles, URL/manual upload paths, owner authority, exact attach/detach state, and unavailable/revoked handling.

Session 6 External Source Lifecycle is CLOSED / PASS / STAGING VERIFIED through PR #421. URL/MCP snapshots now have explicit `SNAPSHOT_READY / INDEXED / DETACHED` lifecycle metadata, refresh/index timestamps, content-addressed refresh semantics, direct external-text indexing into Project-scoped Context, and Refresh/Index/Re-index product actions while owner boundaries remain unchanged.

Session 7 Schedule Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #423. Schedule is now first-class at `/schedule` while `/work` remains a compatibility route; Project-aware list/day/week/month/year views, exact Flow-version links, Runs, and Temporal projections are preserved. The natural-language Schedule AI composer is persistently available at the bottom of the surface and remains draft-only until explicit Save through Flow Trigger ownership into Temporal.

Session 8 Brain Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #425. Brain now reuses the searchable owner-backed Project picker with inline `+ New Project`, preserves its deterministic Project-scoped connected graph, and exposes grounded local Brain AI as a persistent bottom composer that stays disabled until a connected dot is selected. Canonical Project/Schedule/Flow/Context/Connect ownership remains unchanged.

Session 9 Automation Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #427. Automation is now first-class at `/automations` over the existing Flow-owned `event` and `webhook` Trigger substrate. It reuses the searchable Project picker, exact pinned Flow versions, existing Runs projection and Hub/Temporal authority path. Connect remains webhook-secret/token owner; the public `/webhooks/*` edge is bounded to 96 KiB and cannot let callers choose Workspace, Project, Flow, version, or autonomy. `condition`, polling, provider-specific Gmail/Telegram connectors, Task-domain consolidation, L4/AutoClick, and production cutover remain outside this session.

Session 10 Deterministic Condition Trigger is CLOSED / PASS / STAGING VERIFIED through PR #429. The previously reserved `condition` kind is now an event-driven bounded predicate over normalized events: selector mismatch fails closed, predicate false returns a side-effect-free no-op, and predicate true continues through the existing Project + exact pinned Flow + Hub policy/approval/capability + Temporal + Run path. ADR-39 explicitly forbids turning Condition into polling, an always-on LLM monitor, dynamic code, or a second scheduler. `/automations` now supports Condition configuration while Schedule remains time-Trigger-only.

Current safe-resume checkpoint:
[verification/session10-condition-trigger-convergence-closure-2026-10-02.md](verification/session10-condition-trigger-convergence-closure-2026-10-02.md).

The closed ECX Batch 1–7 contracts remain compatibility requirements. The repository has since added the bounded NVIDIA hosted-provider capability and Docker native-build hardening without changing service ownership or opening a new numbered roadmap.

## Current runtime compatibility baseline

Latest audited runtime-changing repository/staging convergence:

```text
SHA   = 222b47403a9c6df3f29580a70cca53e2dff40263
image = staging-222b47403a9c
```

Latest proof:

| Gate / runtime | Result |
|---|---|
| PR #429 reviewed head | `f5c7ddfa53473e2179be3aad7b453c5adb4060ba` |
| PR-head CI #2671 | PASS |
| PR-head Product Eval #1910 | PASS |
| PR-head PCS-06 browser #419 | PASS |
| PR-head MCP External HTTPS #1222 | PASS |
| merged-main CI #2672 | PASS |
| merged-main Product Eval #1911 | PASS |
| merged-main MCP External HTTPS #1223 | PASS |
| Staging Deploy #2091 | gate PASS / deploy skipped |
| Staging Deploy #2092 | actual deploy PASS |
| expected host SHA | matched `222b47403a9c6df3f29580a70cca53e2dff40263` |
| staging image | `staging-222b47403a9c` |
| public/auth + MCP smoke | PASS |
| Operations | `healthy: true`, `unhealthyServices: []` |
| configured/running services | 15 / 15 |
| non-running services | 0 |
| exact-host worktree | clean / DETACHED |
| stabilized free disk after BuildKit-only cleanup | 29.93 GiB |

SumoPod remains **staging, not production**.

## Current architecture

```text
Ai
 -> Hub
    -> Context
    -> Connect -> local/hosted models + MCP
    -> Artifact
    -> Space
    -> Flow -> Temporal
    -> Sandbox
    -> RnD
```

Current ownership remains:

- Hub: policy, approvals, capability authority, audit, orchestration, Historical Ledger and ECX coordination;
- Connect: provider/runtime invocation, credentials/Vault, MCP runtime state and hosted-spend authority;
- Context: memory/retrieval semantics;
- Artifact: raw artifact bytes;
- Flow + Temporal: durable workflow execution/timers/retry/recovery;
- Space: composition/references without duplicating owner data;
- Sandbox: governed execution;
- RnD: trace/eval and dataset-governance foundation.

No ECX Batch 1–7 work introduced a new service or changed these ownership boundaries.

## NVIDIA hosted provider — current capability

NVIDIA API Catalog / NIM is implemented and live through Connect's existing hosted-provider framework:

```text
provider       = nvidia / NVIDIA / NIM
Vault scope    = nvidia/messages
endpoint       = https://integrate.api.nvidia.com/v1
pinned model   = z-ai/glm-5.3
operator gate  = OPEN under bounded spend controls
runtime hosted = activated through normal Settings/provider activation
```

The route reuses the existing OpenAI-compatible adapter, keeps no-silent-fallback behavior, keeps the operator cost kill switch authoritative, and keeps durable spend admission/reservation semantics.

The free-prototype USD-0 pricing snapshot applies only to the supported NVIDIA API Catalog prototype route. It does not claim partner/self-hosted/production NVIDIA pricing.

NVIDIA credential and provider-canary testing remains bounded: current source sets a 60-second default credential-test deadline and 60-second default canary deadline, caps NVIDIA health probes at 1024 output tokens with low reasoning effort, and returns `PROVIDER_TEST_TIMEOUT` on deadline. The user's actual key is still not claimed validated.

The user's real NVIDIA API key is **not repository state and is not claimed validated**. The next user action is: Settings -> NVIDIA / NIM -> paste key -> `Test API key` -> observe PASS or a bounded explicit error -> `Save & activate` only after PASS -> send one real Ai message.

Latest Session 1 checkpoint:
[verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md](verification/nvidia-connection-test-session1-safe-checkpoint-2026-09-28.md).

Underlying provider rollout checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

## OpenRouter Sessions 2–4F — CLOSED / PASS / STAGING VERIFIED

Sessions 2, 3, 4A, 4B, 4C, 4D, 4E, and 4F are CLOSED / PASS at their documented boundaries. PR #417 closes the remaining 4E custom-provider/context-handoff work together with 4F provider/model UX polish, without changing service ownership.

Current implemented OpenRouter behavior:

- Connect owns bounded live catalog fetch/search/filter/cache with an 8-second / 8 MiB discovery boundary and 10-minute normalized cache;
- GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM use the Connect-owned family/admission vocabulary;
- fresh compatible candidates pass capability, runtime-id, text-I/O, `max_tokens`, and positive-pricing checks;
- mutable aliases, stale snapshots, incompatible candidates, duplicate/invalid runtime identities, and invalid/missing prices remain fail-closed;
- compatible dynamic catalog models now appear directly in the Ai OpenRouter model picker without a normal-user model-by-model `Test & Enable` step;
- selecting a compatible dynamic model uses a trusted Connect-owned activation marker; generic runtime PATCH cannot mint that execution authority;
- before each paid dynamic OpenRouter completion, Connect re-resolves the exact selected catalog id and requires a fresh selectable match with valid input/output pricing;
- OpenRouter catalog input/output price per 1M tokens is visible in the Ai picker;
- provider-reported billed cost remains authoritative when supplied;
- spend budget, kill switch, credential boundary, and no-silent-fallback rules remain unchanged;
- unavailable models do not leak into the normal picker;
- a model/provider change still applies to subsequent messages without forcing a new chat session.

PR #407 proof:

- reviewed head `5b9a29085287db035c2c52dd6ea783c2d93ceac4`;
- CI #2555 PASS;
- Product Eval #1794 PASS;
- PCS-06 Integrated Browser Acceptance #341 PASS;
- merged `main` `bb2983d59dbe292c510fbc28aae297bcb23487c4`;
- merged-main CI #2556 PASS;
- merged-main Product Eval #1795 PASS;
- actual Staging Deploy #1863 PASS;
- exact host SHA matched, image `staging-bb2983d59dbe`, public smoke PASS, Operations healthy, 15/15 configured services running, 29.89 GiB stabilized free disk.

PR #409 selector proof:

- reviewed head `2efc0b56b9cc97f7ccdd11a13f7a4b979204945b`;
- CI #2571 PASS;
- Product Eval #1810 PASS;
- PCS-06 Integrated Browser Acceptance #354 PASS;
- merged `main` `e21f6f943fff9c0c2afdc71a45b05d6ab38eff76`;
- merged-main CI #2572 PASS;
- merged-main Product Eval #1811 PASS;
- actual Staging Deploy #1893 PASS;
- exact host SHA matched, image `staging-e21f6f943fff`, public smoke PASS, Operations healthy, 15/15 configured services running, 25.26 GiB stabilized free disk.

PR #411 direct-onboarding proof:

- reviewed head `011ac87b07d12608c7da3906ccbbc064d7701b3c`;
- CI #2585 PASS;
- Product Eval #1824 PASS;
- PCS-06 Integrated Browser Acceptance #365 PASS;
- merged `main` `2c223ea8c54045de3dc5e6b15971bdb2a898e2fe`;
- merged-main CI #2586 PASS;
- merged-main Product Eval #1825 PASS;
- actual Staging Deploy #1922 PASS;
- exact host SHA matched, image `staging-2c223ea8c540`, public smoke PASS, Operations healthy, 15/15 configured services running, 27.35 GiB stabilized free disk.

Accepted Session 4E product contract:
[ai-provider-model-ux-contract.md](ai-provider-model-ux-contract.md).

Session 4E/4F closure boundary:

- multi-credential AI Connections + priority/bounded failover are implemented;
- Local↔Hosted continuity uses the existing Project-scoped hosted-eligible context boundary and does not replay local-only history into hosted prompts;
- `Lainnya / Custom OpenAI-compatible` onboarding is implemented with public-HTTPS/SSRF/DNS-rebinding protections, bounded response/timeout behavior, Connect-owned validation and Vault persistence;
- final provider/model selector/loading/error/custom-provider UX contracts are locked;
- real local acceptance proved dynamic OpenRouter switching with Gemini 3.8 Flash and another catalog model;
- arbitrary custom-provider success-path proof remains credential/endpoint-dependent evidence, not unfinished product code.

Current Session 4E/4F checkpoint:
[verification/session4ef-closure-2026-10-01.md](verification/session4ef-closure-2026-10-01.md).

Prior checkpoints remain historical evidence:

- [verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md)
- [verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md)
- [verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md)
- [verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md)
- [verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md)
- [verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md)

## Closed roadmap families

| Scope | State |
|---|---|
| Original Batch 1–12 / W / F6 | CLOSED at documented boundaries |
| Product Evolution PE-00..PE-08 | CLOSED / PASS |
| PCS-00..PCS-10 | CLOSED / PASS |
| Original Off-host DR | CLOSED / PASS at documented boundary |
| 2026-09-24 audit follow-ups through A-11 | CLOSED / PASS |
| Repository/documentation reconciliation through PR #354 | CLOSED / PASS |
| Historical 393-branch hygiene program | CLOSED / PASS |
| ECX Recipient Execution Batch 1–7 | CLOSED / PASS |
| NVIDIA hosted-provider trial + staging activation + Docker hardening | CLOSED / PASS |
| NVIDIA connection-test Session 1 hardening | CLOSED / PASS |
| OpenRouter model-registry Session 2 | CLOSED / PASS |
| OpenRouter live-discovery Session 3 | CLOSED / PASS |
| OpenRouter model-family Session 4A | CLOSED / PASS |
| OpenRouter automatic-admission Session 4B | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter Settings model-picker Session 4C | CLOSED / PASS / STAGING VERIFIED |
| OpenRouter Ai chat quick-switch Session 4D | CLOSED / PASS / STAGING VERIFIED |

There is **no active Product Evolution, PCS, A-series, or ECX numbered batch**.

There is **no implicit Batch 8, PE-09, PCS-11, Batch 13, or A-12 continuation**.

## ECX Recipient Execution — current capability

The final bounded Batch 1–7 implementation includes:

1. governed single-recipient Hub -> Connect agent execution;
2. durable execution receipts and request-fingerprint conflict protection;
3. one-claim dispatch and success replay without provider redispatch;
4. real Agent A -> Agent B -> Agent A round-trip behavior;
5. single-recipient `delta` parent continuation and `full` standalone handback;
6. explicit `agent.result.receive` authority;
7. returned-result trust/sensitivity/byte/hash evidence;
8. **65,536-byte** per-child returned-result integration cap;
9. hosted-parent owner-backed source eligibility rechecks;
10. Connect completion usage/cost/budget telemetry preservation;
11. replay-safe model-call/token/cost process metrics;
12. deterministic offline quality/economics evidence;
13. Historical Ledger hot-retention + immutable gzip archive compaction;
14. transparent logical replay across archive + hot suffix;
15. archived EventId retry/conflict preservation and fail-closed archive integrity;
16. deterministic **2–8 recipient `delta` fan-out**;
17. per-child Batch 2–4 execution/security semantics;
18. **131,072-byte** aggregate returned-material cap;
19. aggregate SHA-256 evidence;
20. durable fan-out receipts and Workspace-scoped status;
21. exactly one sender/parent aggregation continuation;
22. bounded Historical Ledger aggregate-return/continuation provenance.

Canonical final checkpoint:
[verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

### ECX explicit non-claims

Current ECX does **not** implement or prove:

- external A2A interoperability;
- arbitrary recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- default broadcast;
- broad ECX/History product UI;
- automatic destructive Historical Ledger purge scheduling;
- paid-provider/W18 freshness;
- universal quality, latency or savings superiority;
- DR-2 physical independence;
- production promotion/cutover.

## Current security / identity boundary

The general Ai staging surface is private-by-default behind the existing operator Basic-Auth boundary while MCP discovery/OAuth remains separate.

This is a bounded staging human gate. It is **not** final multi-user identity/RBAC and must not be described as production authorization.

The 2026-09-24 selected audit follow-ups through A-11 remain closed at their documented scopes.

## Backup / DR

The original total-SumoPod-host-loss Off-host DR drill is **CLOSED / PASS** at its documented boundary.

DR-2 is additive and remains **DEFERRED at checkpoint 2** before genuinely external target selection.

Current facts:

- Issue #277 is the only open issue at the audit boundary;
- DR-2 physical independence is **not yet proven**;
- local backup remains the interim posture;
- an encrypted Google Drive copy may be considered later but is not currently a validated DR-2 target.

Do not downgrade or rewrite the original DR closure merely because DR-2 remains deferred.

## Repository / branch hygiene

Both bounded cleanup waves are now **CLOSED / PASS**.

Historical cleanup:

```text
393 / 393 historical exact-SHA safe-delete entries absent
```

Post-ECX cleanup (Actions run `36338085729`):

```text
15 allowlisted ECX branches deleted
2 reconciliation branches deleted after exact-ref validation
1 temporary helper self-deleted
final remote branch count = 9
unexpected branches = 0
```

NVIDIA trial cleanup (Actions run `36368987090`):

```text
3 exact merged work branches deleted
1 temporary helper self-deleted
final remote branch count = 9
unexpected branches = 0
```

The completed cleanup boundary retained 9 branches: `main`, seven retained substantive/provenance branches, and the historical branch-hygiene checkpoint branch.

The live inventory at Session 4B runtime closure was **18 branches with 0 open PRs** before the temporary Session 4B docs-closure branch. This is a later provenance/bookkeeping delta from the historical 9-branch cleanup boundary; it does not reopen the historical cleanup program.

Evidence:

- [verification/post-ecx-branch-cleanup-execution-2026-09-28.md](verification/post-ecx-branch-cleanup-execution-2026-09-28.md)
- [verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md)

Canonical Session 4D checkpoint:
[verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md).

## Current active work

There is **no active implementation queue**. Sessions 4E/4F and Sessions 5–10 are CLOSED / PASS / STAGING VERIFIED. Session 10 is closed through runtime PR #429 and Staging Deploy #2092.

Closed current slices that must not be redone:

- compatible OpenRouter auto-execution + visible catalog pricing — PR #407;
- canonical `[Provider / Source ▼] [Model ▼]` controls — PR #409;
- direct `+ Tambah AI` onboarding from Ai — PR #411;
- multi-credential AI Connections + priority/bounded failover — PR #415;
- custom OpenAI-compatible onboarding + Local↔Hosted handoff proof + final provider/model polish — PR #417;
- searchable owner-backed Project Source Picker + normal local owner-service/Temporal bootstrap — PR #419;
- external-source lifecycle / refresh / indexing productization — PR #421;
- Schedule product convergence — PR #423;
- Brain product convergence — PR #425;
- Automation product convergence over existing event/webhook Triggers — PR #427;
- deterministic Condition Trigger activation over normalized events — PR #429.

Session 10 is closed. No Session 11 or other numbered continuation is automatically opened. There is no active repository-hygiene scope and no implicit Product Evolution, PCS, A-series, ECX, Batch 8, PE-09, PCS-11, Batch 13, or A-12 continuation.

## Explicit deferred / separately selectable future scopes

Any of the following requires a new explicit operator decision and its own bounded scope:

- a newly selected post-4F provider/agentic scope;
- DR-2 checkpoint 2 external target selection and later runtime proof;
- public production promotion/cutover;
- native Google Drive integration;
- Workspace registry/switcher;
- broader multi-user identity/final RBAC;
- paid hosted-provider/W18 reruns;
- external A2A interoperability;
- recursive agent graphs;
- Flow/Temporal long-running ECX execution;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge;
- AutoClick / L4 autonomy.

## Resume instructions

For a new session/agent:

1. read [README.md](../README.md);
2. read this file;
3. read [active-work-plan.md](active-work-plan.md);
4. read [ai-provider-model-ux-contract.md](ai-provider-model-ux-contract.md);
5. read [../AGENTS.md](../AGENTS.md);
6. inspect exact current `main`;
7. open only the explicitly authorized new scope;
8. use dated verification files as evidence, not as the current queue.

Current safe-resume checkpoint:
[verification/session10-condition-trigger-convergence-closure-2026-10-02.md](verification/session10-condition-trigger-convergence-closure-2026-10-02.md).

Underlying runtime/provider checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

Prior repository truth reconciliation:
[verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md).

Do not restart closed roadmap work merely for freshness.
