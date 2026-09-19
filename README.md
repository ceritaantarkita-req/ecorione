# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

> **Current status — 2026-09-19:** the original Batch 1–12 / W / F6 baseline is **CLOSED**. Product Evolution is active: **PE-00 through PE-06 are CLOSED / PASS; PE-07 Brain + Context + ECX is ACTIVE; PE-08 is BLOCKED BY PE-07**. Production host/Cloudflare remains deferred by operator; AutoClick remains deferred by design.

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
| Production ops | Compose/Caddy baseline, metrics/traces, backup/recovery and release tooling |

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

Core rules remain: no cross-service DB access; Hub owns authority/policy; Context owns memory; Artifact owns raw bytes; Connect owns providers/credentials/spend; Flow uses Temporal for durability; side effects remain governed/idempotent.

## Next product evolution

Canonical model:

```text
Project = WHERE
Brain   = WHAT IS KNOWN
Trigger = WHEN / WHY
Flow    = HOW
Agent   = WHO/WHAT executes
Run     = WHAT HAPPENED
```

Roadmap:

```text
PE-00 Architecture lock
PE-01 Project foundation
PE-02 Project Sources
PE-03 Trigger control plane
PE-04 Work + Schedule + Runs
PE-05 Event/Webhook automation
PE-06 Brain V1
PE-07 Brain + Context + ECX
PE-08 Product closure
```

Read [docs/product-evolution-architecture.md](docs/product-evolution-architecture.md), [docs/product-evolution-roadmap.md](docs/product-evolution-roadmap.md), and [docs/product-evolution-agent-guide.md](docs/product-evolution-agent-guide.md).

PE-06 Brain V1 is CLOSED / PASS. PE-07 Brain + Context + ECX is the active implementation batch; PE-08 remains blocked until PE-07 closes.

## Local development

Requires Node 22.x and pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

## Production/self-host

Repository-side production/self-host tooling is ready, but real target-host activation remains operator-owned and deferred. See the production and release runbooks under `docs/`.

## License

MIT for repository code already released. See [docs/LICENSING.md](docs/LICENSING.md).
