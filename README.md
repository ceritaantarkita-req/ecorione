# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

## Current status — 2026-10-01

The latest **staging-verified runtime-changing** baseline is:

```text
runtime baseline = 15f007c5d248df8319644f2d9a6c4c7905c70681
image            = staging-15f007c5d248
```

PR #421 final reviewed head `828368eb6eaa00c991e52b0e4cfeea8d3abbfc35` passed CI **#2609**, Product Eval **#1848**, MCP External HTTPS Acceptance **#1203**, and PCS-06 Integrated Browser Acceptance **#374**. It merged to `main` as `15f007c5d248df8319644f2d9a6c4c7905c70681`; merged-main CI **#2610**, Product Eval **#1849**, and MCP External HTTPS Acceptance **#1204** passed. Actual Staging Deploy **#1968** deployed exact SHA `15f007c5...` as `staging-15f007c5d248`; public/auth and MCP smoke passed, Operations reported `healthy: true`, all **15/15** configured services were running, exact-host identity matched with a clean detached worktree, and capacity stabilized at **27.39 GiB free**.

NVIDIA API Catalog / NIM is now a first-class hosted provider using the existing Connect/Vault/OpenAI-compatible boundary, pinned to `z-ai/glm-5.3`. The staging **operator kill switch was opened** under bounded spend controls; normal runtime activation still happens through Settings when a verified provider is saved/activated. The user's actual NVIDIA secret has **not** been stored or validated by this checkpoint.

Repository hygiene remains bounded: the historical cleanup boundary is **9 retained branches**. Later OpenRouter implementation/docs branches are known provenance/bookkeeping refs, not an active hygiene queue.

The original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, post-closure **PCS-00..PCS-10**, original Off-host DR drill, audit follow-ups through **A-11**, and **ECX Recipient Execution Batch 1–7** are CLOSED / PASS at their documented boundaries.

Sessions 4E and 4F are now **CLOSED / PASS / STAGING VERIFIED** through PR #417. The final package adds bounded `Lainnya / Custom OpenAI-compatible` onboarding, preserves Connect/Vault ownership and multi-credential priority/failover, locks the Local↔Hosted privacy boundary, fixes certified dynamic OpenRouter pricing for normal completions, and closes the provider/model selector polish contract. Local acceptance also proved real OpenRouter model switching with Gemini 3.8 Flash and another dynamic model. Real success-path execution for an arbitrary user-controlled custom endpoint remains credential-dependent evidence, not an open implementation item. There is still **no implicit Batch 8, PE-09, PCS-11, or Batch 13**.

Session 5 — **Project Source Picker** — is **CLOSED / PASS / STAGING VERIFIED** through PR #419 and Staging Deploy #1958. Projects expose a searchable owner-backed picker for Artifact, Space page, Flow graph, and MCP server sources while keeping URL/manual upload paths, Source/Reference roles, exact attach state, and owner-data boundaries intact.

Session 6 — **External Source Lifecycle** — is now **CLOSED / PASS / STAGING VERIFIED** through PR #421 and Staging Deploy #1968. URL/MCP snapshots now carry explicit `SNAPSHOT_READY / INDEXED / DETACHED` lifecycle metadata, refresh/index timestamps, content-addressed refresh semantics, direct text indexing into Project-scoped Context, and Refresh/Index/Re-index UI while preserving Artifact/Context/Connect ownership boundaries. Canonical closure: [docs/verification/session6-external-source-lifecycle-closure-2026-10-01.md](docs/verification/session6-external-source-lifecycle-closure-2026-10-01.md).

**Start here:** [docs/README.md](docs/README.md).

## What exists today

| Area | Current baseline |
|---|---|
| Ai | Chat UI, provider/source + provider-specific model routing, attachments, voice, Projects, Work, Brain, Space, Flow, Ops, Settings |
| Hub | Policy, approval, capability authority, audit, orchestration, Historical Ledger, ECX |
| Connect | Local/hosted providers, Vault, spend budget, runtime settings, inbound/outbound MCP |
| Context | L0 episodic source, semantic facts, core memory, retrieval and provenance |
| Artifact | Content-addressed raw artifact storage |
| Space | Workspace-scoped composition/notes without duplicating owner data |
| Flow | Visual graph control plane + Temporal durable execution |
| Sandbox | Governed execution boundary |
| RnD | Trace/eval and dataset-governance foundation |
| Sync | Local/self-host bridge and hosted MCP reachability boundary |
| Operations | Compose/Caddy staging, health, metrics/traces, backup/recovery and governed release tooling |

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

Core ownership rules:

- no cross-service database access;
- Hub owns authority, policy, approvals, audit and ECX coordination;
- Connect owns providers, credentials, runtime invocation and hosted-spend authority;
- Context owns memory semantics;
- Artifact owns raw bytes;
- Flow + Temporal own durable workflow execution;
- Space stores composition/references rather than copying owner data;
- side effects remain governed and idempotent.

## OpenRouter hosted-model foundation

Accepted Session 4E product contract: [docs/ai-provider-model-ux-contract.md](docs/ai-provider-model-ux-contract.md).

The normal-user Ai control now uses **two adjacent selectors** — `[Provider / Source ▼] [Model ▼]`. Provider/model choices may change inside one conversation and apply to the next message. `+ Tambah AI` is now available directly from this control and completes first-time provider onboarding without a Settings detour. Normal OpenRouter use should expose compatible catalog models without requiring model-by-model user certification; input/output token pricing should be visible while governance remains internal.

OpenRouter model selection resolves through an extensible governed registry. Session 3 added bounded live catalog discovery/search/filter/cache, Session 4A added one Connect-owned version-agnostic family vocabulary for **GPT, Gemini, Qwen, DeepSeek, Kimi, and GLM**, Session 4B added automatic fail-closed admission for those six families, Session 4C added the governed Settings model picker, and Session 4D added the governed Ai chat quick-switch.

PR #407 implements compatible OpenRouter auto-execution + catalog pricing. PR #409 implements the canonical provider/source + provider-specific model selectors. PR #411 implements direct `+ Tambah AI` onboarding. PR #415 implements multiple encrypted AI Connections/API keys beneath one logical provider, priority ordering, bounded invalid-credential/unreachable failover, per-connection Settings management, and non-secret connection provenance. PR #417 closes Session 4E/4F with bounded custom OpenAI-compatible onboarding, Local↔Hosted context-isolation evidence, final provider/model UX contracts, and the dynamic OpenRouter pricing fix required for certified catalog models such as Gemini 3.8 Flash.

Canonical Session 4E/4F closure:
[docs/verification/session4ef-closure-2026-10-01.md](docs/verification/session4ef-closure-2026-10-01.md).

Prior Session 4D checkpoint:
[docs/verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md](docs/verification/openrouter-ai-chat-quick-switch-session4d-safe-checkpoint-2026-09-29.md).

Underlying Session 4C checkpoint:
[docs/verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md](docs/verification/openrouter-settings-model-picker-session4c-safe-checkpoint-2026-09-29.md).

Underlying Session 4B checkpoint:
[docs/verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md](docs/verification/openrouter-auto-admission-session4b-safe-checkpoint-2026-09-28.md).

Underlying Session 4A checkpoint:
[docs/verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md](docs/verification/openrouter-model-family-session4a-safe-checkpoint-2026-09-28.md).

Underlying discovery checkpoint:
[docs/verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](docs/verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md).

Underlying registry checkpoint:
[docs/verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md](docs/verification/openrouter-model-registry-session2-safe-checkpoint-2026-09-28.md).

## NVIDIA hosted provider

Current verified provider boundary:

- provider: `nvidia` / **NVIDIA / NIM**;
- Connect Vault scope: `nvidia/messages`;
- development fallback variable: `NVIDIA_API_KEY`;
- hosted base URL: `https://integrate.api.nvidia.com/v1`;
- pinned model: `z-ai/glm-5.3`;
- UI route label: **Hosted · NVIDIA · GLM-5.3**;
- staged free-prototype provider-token accounting: USD 0, while existing spend admission/reservation semantics remain enforced.

The supported free-prototype boundary does not imply partner/self-hosted/production NVIDIA pricing or arbitrary NVIDIA model support.

Canonical checkpoint:
[docs/verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md](docs/verification/nvidia-hosted-provider-safe-checkpoint-2026-09-28.md).

The user's actual NVIDIA API key is not repository state. It must be entered locally in Settings, pass `Test API key`, then be encrypted/saved in Connect Vault before a real user-key completion can be claimed.

## ECX Recipient Execution

The bounded ECX Recipient Execution roadmap **Batch 1–7 is CLOSED / PASS**.

Current implementation includes:

- governed single-recipient Hub -> Connect execution;
- durable execution receipts, request-fingerprint conflict protection and replay/no-redispatch;
- real Agent A -> Agent B -> Agent A round-trip behavior;
- explicit `agent.result.receive` authority;
- bounded/hash-evidenced returned-result integration;
- hosted-parent source isolation;
- end-to-end usage/cost observability and deterministic offline quality/economics evidence;
- Historical Ledger hot-retention + immutable gzip archive compaction with transparent replay;
- deterministic **2–8 recipient `delta` fan-out**;
- **65,536-byte** per-child result limit;
- **131,072-byte** aggregate result-material limit;
- durable fan-out receipts and exactly one parent aggregation continuation.

Canonical ECX closure:
[docs/verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md](docs/verification/ecx-execution-b7-safe-checkpoint-2026-09-27.md).

Batch 7 does not imply external A2A, recursive agent graphs, Flow/Temporal fan-out orchestration, `full` multi-recipient merge semantics, broad ECX UI, paid-provider reruns, DR-2, or production promotion.

## Product model

```text
Project = WHERE
Brain   = WHAT IS KNOWN
Trigger = WHEN / WHY
Flow    = HOW
Agent   = WHO/WHAT executes
Run     = WHAT HAPPENED
```

Product Evolution PE-00..PE-08 and PCS-00..PCS-10 are historical closed roadmaps, not current work queues.

See:

- [docs/product-evolution-architecture.md](docs/product-evolution-architecture.md)
- [docs/product-evolution-roadmap.md](docs/product-evolution-roadmap.md)
- [docs/post-closure-product-staging-roadmap.md](docs/post-closure-product-staging-roadmap.md)

## Current active / separate boundaries

Sessions 4E and 4F are **closed / pass / staging verified** through PR #417 and Staging Deploy #1950. Sessions 5 and 6 are also **closed / pass / staging verified** through PR #419 / #421 and Staging Deploy #1958 / #1968. No implementation session is active; any Session 7 work requires explicit operator authorization.

The following remain separate explicit decisions:

- any newly selected post-4F provider/agentic scope;
- **DR-2 checkpoint 2** physical-independence target selection and proof;
- public production promotion/cutover;
- native Google Drive integration;
- broader Workspace registry / multi-user identity / final RBAC;
- hosted-provider paid reruns / W18 freshness;
- external A2A interoperability;
- recursive agent graphs;
- Flow/Temporal long-running ECX fan-out orchestration;
- `full` multi-recipient merge semantics;
- broad ECX/History UI;
- automatic destructive Historical Ledger purge scheduling;
- AutoClick / L4 autonomy.

SumoPod is **verified staging, not production**.

## Repository hygiene

The historical branch-hygiene program deleted its full **393/393** exact-SHA safe-delete set. Later ECX/reconciliation work created a bounded delta; that delta is now also **CLOSED / PASS** after exact-SHA dry-run and deletion.

Final cleanup execution:

- 15 post-ECX allowlisted branches deleted;
- 2 reconciliation branches deleted after exact ref validation;
- one-time helper self-deleted;
- final remote inventory: **9 branches**;
- unexpected branches: **0**.

Evidence:
[docs/verification/post-ecx-branch-cleanup-execution-2026-09-28.md](docs/verification/post-ecx-branch-cleanup-execution-2026-09-28.md).

The later NVIDIA trial work also returned to the same retained 9-branch inventory after exact-SHA cleanup run `36368987090`; see the NVIDIA safe checkpoint above.

## Local development

Requires Node 22.20.0 (from `.node-version`) and pnpm 10.28.0.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Repository text is normalized by `.gitattributes` to LF, with `.cmd` / `.bat` materialized as CRLF on Windows.

## Production / self-host

Repository-side production/self-host tooling exists, but the proven runtime boundary is still **SumoPod staging**.

The original total-SumoPod-host-loss Off-host DR drill is CLOSED / PASS at its documented boundary. **DR-2 physical independence is not yet proven** and public production promotion remains a separate explicit gate.

See the staging, release, production, and DR runbooks under [docs/](docs/).

## License

MIT for repository code already released. See [docs/LICENSING.md](docs/LICENSING.md).
