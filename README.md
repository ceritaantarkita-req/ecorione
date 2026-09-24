# ecorione

**Shared memory, governed execution, and cost-aware orchestration for local and hosted AI.**

ECORIONE is a local-first monorepo that keeps AI context continuous across models/providers while preserving explicit ownership boundaries, approvals, auditability, durable workflows, MCP interoperability, and spend control.

> **Current status — 2026-09-23:** the original Batch 1–12 / W / F6 baseline, Product Evolution **PE-00..PE-08**, post-closure **PCS-00..PCS-10**, and the original Off-host DR total-SumoPod-host-loss drill are **CLOSED / PASS** at their documented boundaries. **DR-2 physical independence is currently DEFERRED at checkpoint 2 before any external target selection.** Local backup is the interim posture; an encrypted Google Drive copy may be added later as a secondary off-device copy but is not yet a validated DR-2 target. SumoPod remains staging, GitHub `main` remains source of truth, public production/Cloudflare promotion remains a separate explicit decision, and AutoClick remains deferred by design.

**Start here:** [docs/README.md](docs/README.md).

> **Security audit notice — 2026-09-24:** the bounded current-main audit found a CRITICAL missing human-authentication boundary on the general Ai web/API edge. `/ops` and `/settings` are protected, but general Ai proxies are not user-authenticated and inject the internal service token server-side. No fresh live-host probe was performed, but public/staging/production exposure must not be treated as safe for personal data until this boundary is fixed and negatively tested. See `docs/verification/current-main-staging-audit-2026-09-24.md`.

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

The follow-on PCS-00..PCS-10 roadmap is also CLOSED / PASS. It delivered persistent Project chat/history, provider/model onboarding, Local runtime resilience, product visual/IA cleanup, Flow defect closure, integrated browser acceptance, SumoPod remote staging, governed GitHub-to-staging CD, real-host hardening/reboot/backup/observability evidence, and final documentation convergence. The later latest-main staging convergence to `52046db35e403babdda934881773c46bf2c57b68` is historical; the newer governed staging runtime selected and fully exercised by the closed DR drill is exact `b27c1e5833be0a0fccf3f525d82ae8853cd22113` / `staging-b27c1e5833be`. Subsequent documentation/DR-2 merges have not been deployed because staging deployment activation remains disabled.

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
