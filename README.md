# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

## Current status — 2026-09-28

The latest audited **runtime-changing** repository/staging baseline is:

```text
runtime baseline = af2ef8f61f26058178e56b0d6490248c1898976e
image            = staging-af2ef8f61f26
```

That exact runtime merge passed CI **#2457**, Product Eval **#1696**, and actual Staging Deploy **#1675**. Docs-only checkpoint commits may advance live Git revision without changing this runtime compatibility baseline. Operations is `healthy: true`, **15/15** configured services are running, exact host SHA matched, and capacity stabilized at **25.33 GiB free**.

NVIDIA API Catalog / NIM is now a first-class hosted provider using the existing Connect/Vault/OpenAI-compatible boundary, pinned to `z-ai/glm-5.3`. The staging **operator kill switch was opened** under bounded spend controls; normal runtime activation still happens through Settings when a verified provider is saved/activated. The user's actual NVIDIA secret has **not** been stored or validated by this checkpoint.

Repository hygiene remains bounded: the historical cleanup boundary is **9 retained branches**; the current live inventory is **12 branches**, with the three additional refs known as docs/Session 1/Session 2 bookkeeping or provenance and no unexpected active work refs.

The original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, post-closure **PCS-00..PCS-10**, original Off-host DR drill, audit follow-ups through **A-11**, and **ECX Recipient Execution Batch 1–7** are CLOSED / PASS at their documented boundaries.

There is **no active product/runtime implementation batch** and **no implicit Batch 8, PE-09, PCS-11, or Batch 13**. OpenRouter Sessions 2 and 3 are closed; no later provider session is active implicitly.

**Start here:** [docs/README.md](docs/README.md).

## What exists today

| Area | Current baseline |
|---|---|
| Ai | Chat UI, Local/Hosted routing, attachments, voice, Projects, Work, Brain, Space, Flow, Ops, Settings |
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

## OpenRouter hosted-model registry

OpenRouter model selection resolves through an extensible governed registry rather than a separate Claude-only mapping table. Session 3 adds bounded live catalog fetch/search/filter/cache while keeping catalog presence distinct from executable admission.

Current selectable OpenRouter models remain **Claude Sonnet 4.5** and **Claude Opus 4.1**. Other returned catalog models may be visible as **Discovered only** but are not yet claimed selectable.

Current Session 3 checkpoint:
[docs/verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md](docs/verification/openrouter-model-discovery-session3-safe-checkpoint-2026-09-28.md).

Underlying Session 2 registry checkpoint:
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

## Current separate / deferred boundaries

The following remain separate explicit decisions:

- selected OpenRouter discovered-model admission/verification;
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
