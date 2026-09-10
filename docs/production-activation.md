# ECORIONE — Production Activation Workstream

Status: **ACTIVE**
Date: 2026-09-10

This is the post-closure operational workstream. It does not reopen Batch 1–12 and it is not Batch 13.

## Objective

Take the repository-verified production/self-host baseline into a real VPS deployment, put a stable Cloudflare Free edge in front of it, validate real providers and real traffic, and gather production evidence before any new feature scope is accepted.

## Current starting point

- Planned implementation roadmap: **12/12 CLOSED (100%)**.
- Current main at workstream start: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`.
- Post-merge CI run `34494150426`: PASS.
- Repository provides Docker/Compose self-host baseline, Caddy, Temporal/PostgreSQL, Connect Vault, spend budget, provider canary, `/ops`, release/rollback tooling, and real public MCP acceptance.

## Execution checklist

| # | Work item | State | Evidence / next gate |
|---|---|---|---|
| 1 | Confirm final post-merge CI | **DONE** | `34494150426` PASS |
| 2 | Audit final docs/repo state | **DONE** | PR #31 merged; canonical handoff exists |
| 3 | Deploy ECORIONE to real VPS | **BLOCKED ON VPS ACCESS** | Run `scripts/production-preflight.sh`, then `scripts/self-host-install.sh --apply` on target host |
| 4 | Install Cloudflare Free + named Tunnel | **BLOCKED ON CLOUDFLARE/VPS ACCESS** | Run `scripts/cloudflare-tunnel-install.sh`, configure published hostname to local Caddy |
| 5 | Configure domain/DNS/HTTPS/Caddy/MCP routing | **BLOCKED ON DOMAIN/CLOUDFLARE ACCESS** | Public smoke must pass |
| 6 | Lock direct origin ingress | **BLOCKED ON VPS ROOT ACCESS** | Run read-only host audit, validate tunnel, then explicit firewall cutover |
| 7 | Production E2E smoke | **READY** | `node scripts/production-public-smoke.mjs` against real URL |
| 8 | Add real AI providers through Connect Vault | **BLOCKED ON OPERATOR CREDENTIALS** | No provider secret in git/env history |
| 9 | Run real provider canary | **READY AFTER #8** | `ECORIONE_CANARY_TARGET=hosted pnpm run canary:provider` + quality/latency floor |
| 10 | Start production observability baseline | **READY AFTER #3** | `/ops`, `/api/ops`, owner metrics; persist snapshots externally if required |
| 11 | VPS hardening | **READY / NEEDS VPS ROOT** | `scripts/host-security-audit.sh`; firewall/SSH/patching/off-host backup changes require operator review |
| 12 | Validate Historical Ledger + ECX + optimizer from real traffic | **READY AFTER REAL TRAFFIC** | No savings claim until comparative telemetry exists |
| 13 | UX/Control Center improvements from production evidence | **WAITING FOR EVIDENCE** | Create explicit scope only from observed friction/usage |

## Stop conditions

Do not mark #3–#12 DONE from repository CI alone. They require evidence from the actual deployment or real provider/account boundary. Do not insert production secrets into GitHub files, issue comments, workflow logs, or AI prompts.

## Required reading for another agent

1. `docs/current-state-and-next-steps.md`
2. `AGENTS.md`
3. this file
4. `docs/production-operations.md`
5. `docs/cloudflare-free-deployment.md`
6. `docs/release-operations.md`
7. `docs/security-review.md`

## Architecture boundary

Cloudflare is an external DNS/TLS/tunnel edge only. ECORIONE compute, policy, credentials, data stores, Temporal, Artifact and Sandbox remain self-hosted. Hub remains policy/approval authority and Connect remains provider/credential/MCP owner.
