# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

> **Current status — 2026-09-26:** the original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, post-closure **PCS-00..PCS-10**, the original Off-host DR total-SumoPod-host-loss drill, and the bounded 2026-09-24 audit follow-ups through **A-11** are **CLOSED / PASS** at their documented boundaries. The pre-reconciliation GitHub/staging baseline is `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47`; governed Staging Deploy **#1288** deployed that exact A-11 docs-closure revision with public/auth + MCP checks passing, Operations healthy, zero unhealthy owner services, all **15/15** configured services running, and **26.29 GiB** stabilized free space. **DR-2 physical independence remains DEFERRED at checkpoint 2 before external-target selection.** SumoPod remains staging; public production/Cloudflare promotion, native Google Drive, hosted-provider spend, broader multi-user identity, and AutoClick remain separate/deferred decisions.

**Start here:** [docs/README.md](docs/README.md).

> **Security/audit reconciliation — 2026-09-26:** the 2026-09-24 CRITICAL general-Ai human-authentication finding and the later HIGH/MEDIUM/product-gap follow-ups selected from that audit are now closed at their bounded implemented/staging boundaries. The general Ai browser/API surface is private-by-default behind the staging operator Basic-Auth boundary; MCP discovery/OAuth remains separate. This is still a single-credential staging gate, **not** a final multi-user identity/RBAC design and **not** production authorization. See [docs/verification/current-main-staging-audit-2026-09-24.md](docs/verification/current-main-staging-audit-2026-09-24.md) and the latest A-11 closure evidence.

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

## Product model and completed evolution

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

PE-08 Product closure is CLOSED / PASS on PR #180. Product Evolution PE-00 through PE-08 is complete at the documented boundaries; no Batch 13 is opened. Native Windows portability hardening was merged through PR #182 after Windows-local verification plus CI #1477 and Product Eval #716 passed. Clean-checkout reproducibility then closed on PR #183: canonical formatting is committed and CI now validates source without a pre-format mutation; exact closure head passed CI #1482 and Product Eval #721. Fresh-clone Windows EOL closure then completed on PR #185: the three `.cmd` blobs were renormalized to canonical LF in Git while `.gitattributes` preserves CRLF in Windows working trees; PR CI #1486, Product Eval #725, Desktop Installer #76, and post-merge main CI #1487 / Product Eval #726 all passed.

The follow-on PCS-00..PCS-10 roadmap is also CLOSED / PASS. It delivered persistent Project chat/history, provider/model onboarding, Local runtime resilience, product visual/IA cleanup, Flow defect closure, integrated browser acceptance, SumoPod remote staging, governed GitHub-to-staging CD, real-host hardening/reboot/backup/observability evidence, and final documentation convergence. Historical staging/DR revisions remain preserved in dated evidence, but they are no longer the current runtime identity. After the audit-follow-up sequence and A-11 closure bookkeeping, governed auto-deploy converged SumoPod staging to the pre-reconciliation A-11 bookkeeping baseline `65bf8d2ce0b832bd12b0b279ccf9df0384a07c47` in Staging Deploy #1288. Later docs-only merges may advance the Git/staging SHA without changing the application/service/package trees. No new PE/PCS batch is active.

## Local development

Requires Node 22.20.0 (from `.node-version`) and pnpm 10.28.0. Repository text is normalized by `.gitattributes` to LF, with `.cmd`/`.bat` kept CRLF.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

## Production/self-host

Repository-side production/self-host tooling is ready and the SumoPod **remote staging** boundary is verified. The original total-SumoPod-host-loss Off-host DR drill is also CLOSED / PASS at its documented boundary, including independent retrieval, 12-volume restore, 15-service recovery, semantic canary checks, changed-boot-ID persistence, and final RPO/RTO closure evidence. **DR-2** remains the deferred follow-up for stronger physical-host/storage independence for the backup target and replacement compute. Public production promotion, final public edge/domain posture, provider/account-wide DR, and long-term telemetry retention remain separate explicit gates. See the staging, DR, production, and release runbooks under `docs/`.

## License

MIT for repository code already released. See [docs/LICENSING.md](docs/LICENSING.md).
