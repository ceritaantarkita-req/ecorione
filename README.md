# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

> **Current status — 2026-09-18:** the defined Batch 1–12 platform roadmap is **CLOSED**; Windows runtime and installer are verified; W16/W17/W18/W20 and **F6-E01 through F6-E08 are CLOSED at their documented boundaries**. There is no active scope in the previous hardening plan. Production host/Cloudflare activation remains deferred by operator. AutoClick remains deferred by design.

**Start here:** [docs/README.md](docs/README.md). Do not use dated audits or verification records as current-state documents.

## What exists today

| Area | Current baseline |
|---|---|
| Ai | Chat UI, Local/Hosted routing, attachments, voice, Space, Flow, Ops, Settings |
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

## Architecture

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

Core rules:

- owner services do not read another owner's database directly;
- Hub owns policy/approval/capability authority;
- Connect owns provider credentials, MCP runtime state, and hosted spend authority;
- Context owns memory semantics; Artifact owns raw L3 bytes;
- Flow uses Temporal for durability instead of creating a second scheduler/retry engine;
- memory and external content are data, never trusted instructions;
- side effects require idempotency and the appropriate approval boundary.

## Current work

The previous implementation/hardening plan has **no active item**. F6-E08 closed after exact-head CI, Product Eval, MCP external acceptance, and Desktop Installer all passed and PR #164 merged.

The current repository baseline should now be treated as the clean discussion point for whatever product scope is explicitly approved next. Projects / Work / Schedule / Brain remain **discussion/future scope only**, not an active implementation roadmap.

## Local development

Requires Node 22.x and pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Phase-expanded runtime helpers remain available through the root package scripts. Windows engine/installer workflows are documented in the current runbooks.

## Production/self-host

Repository-side production/self-host tooling is ready, but real target-host activation remains operator-owned and currently deferred. Use:

- [docs/production-activation.md](docs/production-activation.md)
- [docs/production-operations.md](docs/production-operations.md)
- [docs/release-operations.md](docs/release-operations.md)
- [docs/cloudflare-free-deployment.md](docs/cloudflare-free-deployment.md)

## Documentation

The documentation map and precedence rules live in [docs/README.md](docs/README.md).

Architecture decisions remain in [docs/adr/](docs/adr/). Historical evidence remains preserved under [docs/verification/](docs/verification/) and [docs/archive/](docs/archive/), but those are not current work queues.

## License

MIT for repository code already released. See [docs/LICENSING.md](docs/LICENSING.md).
