# ECORIONE — Current State & Next Steps

Last updated: **2026-10-04**

Status: **CURRENT / SESSION 12D NATIVE GOOGLE DRIVE CLOSURE ACTIVE / 12A–12C MERGED / #448 CURRENT-MAIN SUPPORT / 12D REPOSITORY+MOCK CLOSED / REAL LOCAL GOOGLE ACCEPTANCE PENDING / SUMOPOD ACTIVE-STAGING ROLE RETIRED / DR-2 + PRODUCTION DEFERRED**

## Current operating override — 2026-10-04

The operator has decided not to renew the current SumoPod VPS when its current paid period ends. **SumoPod is no longer the active staging target for new ECORIONE work.** Do not repair, redeploy, or require new proof from that host unless the operator explicitly reauthorizes it.

Historical SumoPod evidence remains valid at the boundary/date where it was recorded. The last proven actual SumoPod runtime is Session 12A merge `084d669d8631a2590e7a9e88b62e161691bf4fc9` / image `staging-084d669d8631` via Staging Deploy #2183 with 15/15 services running and healthy Operations. Session 12B merge `977689ffff8bdf2d00fd1ed34c172d3452d98d17` and Session 12C merge `4326e77b2f77aa48a4be075c5fab2ff8b9983655` passed their repository quality gates, but their real SumoPod deploy attempts #2226/#2228 failed before mutation because the host could not determine the active ECORIONE image. They are **not** staging-verified. Current `main` is later support baseline `bd8d2513aa21164e5a1f6d36b898d8140b57506a` from #448 and does not claim a newer remote staging runtime.

Current Native Google Drive work is Session 12:

```text
12A OAuth foundation           = MERGED / quality gates PASS
12B selected-file fetch        = MERGED / quality gates PASS / no new remote-staging proof
12C Project Source lifecycle   = MERGED / quality gates PASS / merge 4326e77...
12D local acceptance support   = #448 MERGED / current main bd8d251...
12D Picker/browser UX          = PR #444 DRAFT / UNMERGED
12D reviewed head              = 1e4f58c7d9dd4dc9f09687fbdd393261f38830f8
12D CI                         = #2819 PASS
12D Product Eval               = #2058 PASS
12D MCP External HTTPS         = #1320 PASS
12D browser acceptance         = #471 PASS
12D Desktop Installer          = #346 PASS
12D automated/mock acceptance  = CLOSED / PASS
next gate                      = real local Google OAuth + Picker acceptance
```

Until a replacement external staging target is explicitly selected, runtime-changing product closure uses reviewed GitHub gates plus local Docker/Compose acceptance on operator-controlled compute. This is a development/acceptance model only; it does not imply production readiness, remote-host evidence, DR-2 physical independence, or public-production authorization.

Canonical current checkpoint:
[verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md](verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md).

Historical staging-transition record:
[verification/sumopod-retirement-local-first-transition-2026-10-03.md](verification/sumopod-retirement-local-first-transition-2026-10-03.md).

## Repository identity

```text
repository                 = ceritaantarkita-req/ecorione
default branch             = main
current main               = bd8d2513aa21164e5a1f6d36b898d8140b57506a (#448 local-acceptance support)
active implementation      = Session 12D Native Google Drive closure
open implementation PR    = #444 (12D Picker/browser UX, DRAFT / UNMERGED)
PR #444 reviewed head      = 1e4f58c7d9dd4dc9f09687fbdd393261f38830f8
PR #444 repository/mock    = CLOSED / PASS
active remote staging      = NONE
last proven SumoPod runtime = 084d669d8631a2590e7a9e88b62e161691bf4fc9
last proven SumoPod image   = staging-084d669d8631
interim runtime acceptance = real local Google OAuth + Picker acceptance
```

Sessions 4E and 4F are CLOSED / PASS / STAGING VERIFIED through PR #417. Exact PR head `93c3230b552e479194b756135a5458d8a6fd001e` passed CI #2600, Product Eval #1839, and PCS-06 Integrated Browser Acceptance #371. It merged to `main` as `6170ee5d67ee4b105771d8ce2c348afba6cce896`; merged-main CI #2601 and Product Eval #1840 passed, and actual Staging Deploy #1950 deployed exact SHA `6170ee5d...` as `staging-6170ee5d67ee`. Public/auth and MCP smoke passed, Operations reported `healthy: true`, exact-host identity matched with a clean worktree, all **15/15** configured services were running, and capacity stabilized at **29.95 GiB free**.

The Ai composer uses adjacent `[Provider / Source ▼] [Model ▼]` controls with direct `+ Tambah AI` onboarding. One logical provider may own multiple encrypted AI Connections/API keys with priority/failover. `Lainnya / Custom OpenAI-compatible` now has bounded public-HTTPS onboarding and Connect-owned validation/Vault persistence. Local↔Hosted continuity preserves the existing Project-scoped hosted-eligible context boundary rather than silently uploading local-only history. Dynamic certified OpenRouter models now carry their fresh pricing snapshot through reservation and normal completion. Real success-path proof for an arbitrary custom endpoint remains dependent on a user-controlled endpoint/credential and is not an open implementation item.

Session 5 Project Source Picker is CLOSED / PASS / STAGING VERIFIED through PR #419. Projects expose searchable owner-backed Artifact, Space page, Flow graph, and MCP-server source choices while preserving Source/Reference roles, URL/manual upload paths, owner authority, exact attach/detach state, and unavailable/revoked handling.

Session 6 External Source Lifecycle is CLOSED / PASS / STAGING VERIFIED through PR #421. URL/MCP snapshots now have explicit `SNAPSHOT_READY / INDEXED / DETACHED` lifecycle metadata, refresh/index timestamps, content-addressed refresh semantics, direct external-text indexing into Project-scoped Context, and Refresh/Index/Re-index product actions while owner boundaries remain unchanged.

Session 7 Schedule Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #423. Schedule is now first-class at `/schedule` while `/work` remains a compatibility route; Project-aware list/day/week/month/year views, exact Flow-version links, Runs, and Temporal projections are preserved. The natural-language Schedule AI composer is persistently available at the bottom of the surface and remains draft-only until explicit Save through Flow Trigger ownership into Temporal.

Session 8 Brain Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #425. Brain now reuses the searchable owner-backed Project picker with inline `+ New Project`, preserves its deterministic Project-scoped connected graph, and exposes grounded local Brain AI as a persistent bottom composer that stays disabled until a connected dot is selected. Canonical Project/Schedule/Flow/Context/Connect ownership remains unchanged.

Session 9 Automation Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #427. Automation is now first-class at `/automations` over the existing Flow-owned `event` and `webhook` Trigger substrate. It reuses the searchable Project picker, exact pinned Flow versions, existing Runs projection and Hub/Temporal authority path. Connect remains webhook-secret/token owner; the public `/webhooks/*` edge is bounded to 96 KiB and cannot let callers choose Workspace, Project, Flow, version, or autonomy. `condition`, polling, provider-specific Gmail/Telegram connectors, Task-domain consolidation, L4/AutoClick, and production cutover remain outside this session.

Session 10 Deterministic Condition Trigger is CLOSED / PASS / STAGING VERIFIED through PR #429. The previously reserved `condition` kind is now an event-driven bounded predicate over normalized events: selector mismatch fails closed, predicate false returns a side-effect-free no-op, and predicate true continues through the existing Project + exact pinned Flow + Hub policy/approval/capability + Temporal + Run path. ADR-39 explicitly forbids turning Condition into polling, an always-on LLM monitor, dynamic code, or a second scheduler. `/automations` now supports Condition configuration while Schedule remains time-Trigger-only.

Session 11 MCP Action Product Convergence is CLOSED / PASS / STAGING VERIFIED through PR #431. Flow MCP Tool nodes now bind to configured Connect-owned MCP servers/tools through guided product pickers and explicit L0 READ discovery. Browser product routes cannot call remote tools directly; actual external actions still execute only through exact pinned Flow → Connect outbound MCP → Hub governance. Runtime MCP arguments support bounded structured `{{ path }}` binding to Flow input, with exact templates preserving JSON value types and embedded templates remaining text. ADR-40 keeps native Gmail/Telegram adapters, OAuth/subscriptions, polling, L4/AutoClick, and production cutover outside this session.

Post-Session-11 CD hardening remains deployment-control work, not Session 12. PR #436 exposed the incomplete original `docs/**` classifier. PR #437 expanded the automatic documentation-only allowlist to `docs/**`, `README.md`, and `AGENTS.md`. PR #438 then live-verified that boundary: merge `6daea51053ee24ae4aebb5a8c155ff8554da85f9` passed CI #2709 and Product Eval #1948; Staging Deploy #2166 and #2167 both gate-passed and explicitly skipped deploy as docs-only. Runtime/control therefore remains `5f1245083047c4014789e90c2ba25b7e16ebe366`, image `staging-5f1245083047`, with the previously verified healthy 15/15 staging services and 29.91 GiB stabilized free disk.

Current safe-resume checkpoint:
[verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md](verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md).

The closed ECX Batch 1–7 contracts remain compatibility requirements. The repository has since added the bounded NVIDIA hosted-provider capability and Docker native-build hardening without changing service ownership or opening a new numbered roadmap.

## Current runtime compatibility baseline

Latest audited runtime/control repository/staging convergence:

```text
Session 11 product SHA = 9bd2b87fc4f3755b837c74d6b42585e0c5181870
latest control SHA     = 5f1245083047c4014789e90c2ba25b7e16ebe366
image                  = staging-5f1245083047
```

Latest proof:

| Gate / runtime | Result |
|---|---|
| Session 11 product PR #431 reviewed head | `cd57404e767335e46abbdc8bc629774f32ad2b70` |
| Session 11 product merge | `9bd2b87fc4f3755b837c74d6b42585e0c5181870` |
| post-checkpoint CD hardening PR #437 reviewed head | `ecb99b266f6854e3a010189ae747a899c3e9826e` |
| PR #437 head CI #2706 | PASS |
| PR #437 head Product Eval #1945 | PASS |
| PR #437 merged-main CI #2707 | PASS |
| PR #437 merged-main Product Eval #1946 | PASS |
| Staging Deploy #2162 | gate PASS / deploy skipped while peer gate was incomplete |
| Staging Deploy #2163 | actual deploy PASS |
| expected host SHA | matched `5f1245083047c4014789e90c2ba25b7e16ebe366` |
| staging image | `staging-5f1245083047` |
| public/auth + MCP smoke | PASS |
| Operations | `healthy: true`, `unhealthyServices: []` |
| configured/running services | 15 / 15 |
| non-running services | 0 |
| exact-host worktree | clean / DETACHED |
| stabilized free disk | 29.91 GiB |
| expanded automatic documentation-only allowlist | `docs/**`, `README.md`, `AGENTS.md`; PR #438 merge `6daea51053ee24ae4aebb5a8c155ff8554da85f9` LIVE VERIFIED via Staging #2166/#2167 deploy SKIPPED |
| explicit `workflow_dispatch` | still allowed |

SumoPod historical staging evidence remains valid, but the operator retired SumoPod from the active staging role on 2026-10-03. There is currently **no active remote staging target**. Public production remains separate and deferred.

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

There is **no active implementation queue**. Sessions 4E/4F and Sessions 5–11 are CLOSED / PASS / STAGING VERIFIED. Session 11 product work is closed through PR #431; post-closure CD hardening is closed through PR #433 and Staging Deploy #2146.

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
- deterministic Condition Trigger activation over normalized events — PR #429;
- MCP Action product convergence over existing Flow/Connect outbound MCP authority — PR #431.
- expanded automatic documentation-only staging redeploy prevention — PR #437 implementation, PR #438 live verification (`docs/**`, `README.md`, `AGENTS.md`); Staging #2166/#2167 deploy SKIPPED.

Session 11 is closed. Session 12 Native Google Drive is explicitly authorized and active; this does not implicitly open any other numbered continuation. There is no active repository-hygiene scope and no implicit Product Evolution, PCS, A-series, ECX, Batch 8, PE-09, PCS-11, Batch 13, or A-12 continuation.

## Explicit deferred / separately selectable future scopes

Any of the following requires a new explicit operator decision and its own bounded scope:

- a newly selected post-4F provider/agentic scope;
- DR-2 checkpoint 2 external target selection and later runtime proof;
- public production promotion/cutover;
- Session 12 Native Google Drive is already active; any widening beyond the accepted 12A–12D boundary requires a new explicit decision;
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
7. continue only the explicitly authorized Session 12 boundary or another newly authorized scope;
8. use dated verification files as evidence, not as the current queue.

Current safe-resume checkpoint:
[verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md](verification/session12d-repository-green-local-acceptance-pending-2026-10-04.md).

Underlying runtime/provider checkpoint:
[verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

Prior repository truth reconciliation:
[verification/repository-truth-reconciliation-2026-09-27.md](verification/repository-truth-reconciliation-2026-09-27.md).

Do not restart closed roadmap work merely for freshness.
