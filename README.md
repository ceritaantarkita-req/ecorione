# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

> **Current status — 2026-09-22:** the original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, and post-closure **PCS-00..PCS-10** are **CLOSED / PASS** at their documented boundaries. SumoPod remote staging is verified and GitHub `main` remains source of truth. Public production promotion/Cloudflare remains a separate explicit operator decision; AutoClick remains deferred by design.

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

The follow-on PCS-00..PCS-10 roadmap is also CLOSED / PASS. It delivered persistent Project chat/history, provider/model onboarding, Local runtime resilience, product visual/IA cleanup, Flow defect closure, integrated browser acceptance, SumoPod remote staging, governed GitHub-to-staging CD, real-host hardening/reboot/backup/observability evidence, and final documentation convergence. The later bounded latest-main staging-convergence scope is also CLOSED / PASS at the runtime boundary: governed Staging Deploy #293 moved SumoPod staging to exact reviewed revision `52046db35e403babdda934881773c46bf2c57b68` / image `staging-52046db35e40` and passed public smoke, authenticated Ops health, and exact-host evidence.

## Local development

Requires Node 22.20.0 (from `.node-version`) and pnpm 10.28.0. Repository text is normalized by `.gitattributes` to LF, with `.cmd`/`.bat` kept CRLF.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

## Production/self-host

Repository-side production/self-host tooling is ready and the SumoPod **remote staging** boundary has been verified through PCS-07..PCS-09. That staging evidence is not a production claim. Public production promotion, final public edge/domain posture, off-host DR, and long-term telemetry retention remain separate explicit gates. See the staging, production, and release runbooks under `docs/`.

## License

MIT for repository code already released. See [docs/LICENSING.md](docs/LICENSING.md).
