# ECORIONE — Active Work Plan

Last updated: **2026-09-30**

Status: **PRE-4E PRODUCT CONTRACT LOCKED / NO SESSION 4E RUNTIME IMPLEMENTATION YET / PR #402 MERGED BUT REPAIR+REGRESSION RECONCILIATION REQUIRED / OPENROUTER SESSIONS 2–3 + 4A–4D CLOSED-PASS / NVIDIA SESSION 1 CLOSED-PASS / BRANCH HYGIENE CLOSED-PASS**

Current historical safe-resume pointer remains [verification/ecorione-safe-resume-checkpoint-2026-09-29.md](verification/ecorione-safe-resume-checkpoint-2026-09-29.md). Current `main` is `8db1dfd7536f93edbe8f59f1b2f5d6402ae2f96b` from PR #402, but the latest **accepted audited staging baseline** remains `9bc4cfd1bbfb2b2aed7bef1ec4de24024bd491d7` from PR #400 because PR #402 did not close its required gates.

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
- OpenRouter Ai chat quick-switch Session 4D — CLOSED / PASS / STAGING VERIFIED.

No Batch 8, PE-09, PCS-11, Batch 13, or next A-series item is automatically opened.
### Selected pre-4E product contract

The operator has explicitly selected the next product direction, but **this docs change does not start Session 4E runtime implementation**. Before code, treat [design.md §12](design.md#12-pre-session-4e-ai-connection--model-ux-contract--2026-09-30) as the product contract.

Required direction:

1. Ai primary control is `[Provider/source ▼] [Model ▼]`, not one opaque Local/Hosted route selector.
2. Provider/source menu includes Local, Claude/Anthropic, OpenAI, NVIDIA, OpenRouter, and `+ Tambah AI`.
3. `+ Tambah AI` performs fast onboarding in-place: provider -> API key -> Hubungkan; successful connect validates/saves/discovers without a mandatory Settings detour.
4. OpenRouter compatible models should be usable from catalog/discovery without forcing users through per-model Test/Certified/Executable workflow; show practical pricing/capability facts instead.
5. Provider/model selection is **per next message** and can change within one conversation while Historical Ledger keeps turn provenance.
6. Credential storage must evolve from one effective `<provider>/messages` slot to stable multi-connection identities so one provider can hold multiple API keys.
7. Main chat hides individual keys; Settings -> AI Connections manages labels, priority, health, rotation, and failover.
8. Initial key routing is explicit priority + failover; requested model must not silently change.
9. `Lainnya` provides a custom/OpenAI-compatible connection path.
10. Governance/spend/security remain authoritative underneath and Local <-> Cloud context handoff/privacy must be specified before 4E closure.

### Required sequence before Session 4E implementation

1. repair/reconcile current PR #402/main failures so baseline verification is trustworthy;
2. confirm the exact 4E acceptance matrix from the contract above;
3. only then implement runtime/schema/UI changes;
4. require exact-head CI/Product Eval/browser evidence before merge;
5. update current docs after actual runtime truth is known.


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
[verification/ecorione-safe-resume-checkpoint-2026-09-29.md](verification/ecorione-safe-resume-checkpoint-2026-09-29.md).

## OpenRouter Sessions 2–3 + 4A–4D — CLOSED / PASS

Current proven boundary:

- Session 2 established the governed extensible registry and fail-closed executable admission;
- Session 3 adds bounded live OpenRouter catalog fetch/search/filter/cache;
- the full normalized catalog is cached for 10 minutes with explicit refresh and explicit stale fallback;
- discovery query keys and result counts are bounded at both Connect and the Ai Settings proxy;
- Session 4A adds one version-agnostic family vocabulary for GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM;
- Session 4B automatically admits only fresh target-family candidates that pass bounded runtime-id, context, text-I/O, `max_tokens`, and positive-pricing checks;
- passing candidates become `verified-selectable` / `selectable=true` while remaining `executable=false`;
- failed target candidates become `unavailable` with stable reasons; non-target families remain `discovered-only`;
- stale discovery withdraws dynamic selectability;
- Session 4C exposes admitted OpenRouter candidates in Settings and persists `openRouterModelSelection` separately from executable `hostedModel`;
- Session 4D exposes the same governed selection semantics in the Ai chat quick-switch without creating a second authority;
- dynamic `verified-selectable` choices save as preferences but force hosted execution OFF and the default route back to local;
- current executable OpenRouter authority remains Claude Sonnet 4.5 + Claude Opus 4.1;
- no remote pricing or catalog metadata silently becomes a runtime pricing identity or executable authority.

Current checkpoint:
[verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md).

Underlying Settings-selection checkpoint:
[verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md).

Underlying admission checkpoint:
[verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md).

Underlying family checkpoint:
[verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md).

Underlying discovery checkpoint:
[verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md).

Underlying registry checkpoint:
[verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md).

Session 4D Ai chat quick-switch is CLOSED / PASS / STAGING VERIFIED. The previously phrased “Session 4E real multi-family execution validation” is now constrained by the accepted pre-4E product contract above: 4E must make practical provider/model choice simpler for end users rather than preserve manual per-model certification as the target UX. Session 4E runtime work has not started in this docs change; Session 4F remains a later independent scope.

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

The following are eligible only through an explicit new decision; none is current work:

- Session 4E implementation of the accepted Ai connection/model-routing contract, with practical multi-family OpenRouter execution and no mandatory per-model user certification;
- Session 4F final OpenRouter polish/closure;
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
3. define accepted behavior and non-goals before coding;
4. keep service ownership unchanged unless an explicit architecture decision says otherwise;
5. add deterministic tests for new behavior;
6. require exact-head gates;
7. merge only reviewed head;
8. prove merged-main gates;
9. deploy exact reviewed `main` to staging only when the scope changes runtime;
10. update current docs once, after the real state is known;
11. keep dated evidence historical.

Do not create documentation-only “next batches” simply to continue numbering.
