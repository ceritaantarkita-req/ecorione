# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

## Current status — 2026-09-27

The last audited Batch 7 closure/runtime baseline before this docs-only reconciliation is:

```text
reviewed closure = 2c2e3c8ad1b4a961251d57ff1e0a7d8f2414e370
staging image    = staging-2c2e3c8ad1b4
```

Docs-only reconciliation commits may advance Git/staging revision identity without changing the application/service/package compatibility baseline. Use the live repository head for the exact newest Git SHA and the dated reconciliation evidence for audited identities.

Latest proof for the audited closure baseline:

- CI **#2352** — PASS;
- Product Eval **#1591** — PASS;
- actual Staging Deploy **#1475** — PASS;
- Operations `healthy: true`;
- **15/15** configured services running;
- exact host SHA matched expected SHA;
- final stabilized free disk: **26.31 GiB**.

The original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, post-closure **PCS-00..PCS-10**, original Off-host DR drill, audit follow-ups through **A-11**, and **ECX Recipient Execution Batch 1–7** are CLOSED / PASS at their documented boundaries.

There is **no active product/runtime implementation batch** and **no implicit Batch 8, PE-09, PCS-11, or Batch 13**.

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

The original branch-hygiene program deleted its full historical **393/393** exact-SHA safe-delete set. Subsequent ECX work created a new bounded branch delta. That post-ECX delta is classified separately and must be exact-SHA revalidated before deletion; do not reuse the historical 9-branch inventory as a current claim.

Current reconciliation:
[docs/verification/repository-truth-reconciliation-2026-09-27.md](docs/verification/repository-truth-reconciliation-2026-09-27.md).

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
