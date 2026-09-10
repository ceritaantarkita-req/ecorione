# ECORIONE — Production Activation Workstream

Status: **ACTIVE**
Date: 2026-09-10

This is the post-closure operational workstream. It does not reopen Batch 1–12 and it is not Batch 13.

## Objective

Take the repository-verified production/self-host baseline into a real VPS deployment, put a stable Cloudflare Free edge in front of it, validate real providers and real traffic, and gather production evidence before any new feature scope is accepted.

## Current starting point

- Planned implementation roadmap: **12/12 CLOSED (100%)**.
- Main at workstream start: `aa360b81a6ef5cd41f466d7ada239b4e461c60ee`.
- Final documentation post-merge CI run `34494150426`: **PASS**.
- Repository provides Docker/Compose self-host baseline, Caddy, Temporal/PostgreSQL, Connect Vault, spend budget, provider canary, `/ops`, release/rollback tooling, and real public MCP acceptance.

## Tooling added in this workstream

| Command | Purpose | Mutation |
|---|---|---|
| `pnpm production:preflight` | Validate production env, file mode, Compose, repository production acceptance, disk floor | Read-only |
| `pnpm cloudflare:tunnel:install` | Validate Cloudflare edge reachability; `--apply` installs the remotely-managed tunnel system service | Dry-run by default |
| `pnpm production:smoke` | Verify HTTPS home, protected `/ops` + `/settings`, MCP resource metadata and unauthenticated challenge | Read-only |
| `pnpm cloudflare:origin:lockdown` | Verify tunnel + SSH firewall preconditions; `--apply` removes direct 80/443 ingress and auto-restores on failed smoke | Dry-run by default |
| `pnpm production:host-audit` | Inspect firewall, listening sockets, SSH posture, unattended upgrades, Docker access, env mode, tunnel service, NTP | Read-only |
| `pnpm canary:providers` | Sequential real hosted canary for Anthropic/OpenRouter/OpenAI using Connect Vault; restores original runtime settings | Temporary runtime-setting mutation, restored in `finally` |
| `pnpm production:ops-snapshot` | Fetch protected `/api/ops`, require healthy fleet, optionally write a mode-0600 snapshot | Read-only except optional local snapshot file |
| `pnpm production:data-evidence` | Verify Historical Ledger integrity plus real ECX/model/token/cache/cost telemetry floors | Read-only |

Production secrets are never command-line examples in this document. Provider secrets must enter through Connect Vault/Control Center; Cloudflare tunnel token is supplied only in the operator shell when installing the service.

## Execution checklist

| # | Work item | State | Evidence / next gate |
|---|---|---|---|
| 1 | Confirm final post-merge CI | **DONE** | `34494150426` PASS |
| 2 | Audit final docs/repo state | **DONE** | PR #31 merged; canonical handoff exists |
| 3 | Deploy ECORIONE to real VPS | **BLOCKED ON VPS ACCESS** | `pnpm production:preflight` then `scripts/self-host-install.sh --apply` on target host |
| 4 | Install Cloudflare Free + named Tunnel | **TOOLING READY / BLOCKED ON CLOUDFLARE+VPS ACCESS** | `pnpm cloudflare:tunnel:install`, then publish hostname -> local Caddy |
| 5 | Configure domain/DNS/HTTPS/Caddy/MCP routing | **TOOLING READY / BLOCKED ON DOMAIN+CLOUDFLARE ACCESS** | `ECORIONE_PUBLIC_BASE_URL=https://<host> pnpm production:smoke` must PASS |
| 6 | Lock direct origin ingress | **GUARDED TOOLING READY / BLOCKED ON VPS ROOT ACCESS** | Dry-run `pnpm cloudflare:origin:lockdown`; explicit ack + `--apply` only after public smoke |
| 7 | Production E2E edge smoke | **TOOLING IMPLEMENTED; REAL RUN PENDING #3–5** | `pnpm production:smoke` |
| 8 | Add real AI providers through Connect Vault | **BLOCKED ON OPERATOR CREDENTIALS** | Add secret via `/settings` or Connect control API; no secret in Git/env history |
| 9 | Run real provider canary | **TOOLING IMPLEMENTED; REAL RUN PENDING #8** | `pnpm canary:providers`; all intended providers must PASS and original settings must be restored |
| 10 | Start production observability baseline | **TOOLING IMPLEMENTED; REAL SNAPSHOT PENDING #3** | `/ops` + `pnpm production:ops-snapshot`; external retention remains operator choice |
| 11 | VPS hardening | **READ-ONLY AUDIT IMPLEMENTED; REMEDIATION NEEDS VPS ROOT** | `pnpm production:host-audit`; review firewall/SSH/patching/off-host backup findings |
| 12 | Validate Historical Ledger + ECX + optimizer from real traffic | **TOOLING IMPLEMENTED; REAL TRAFFIC PENDING** | `pnpm production:data-evidence`; no savings claim from packet/token counters alone |
| 13 | UX/Control Center improvements from production evidence | **WAITING FOR PRODUCTION EVIDENCE** | Create explicit scope only from observed friction/usage |

## VPS execution order

```bash
# 1. Validate host/repo/config without deploying
pnpm production:preflight
pnpm production:host-audit

# 2. Start ECORIONE only after production.env contains no placeholders
scripts/self-host-install.sh --apply

# 3. Local canary before public cutover
ECORIONE_CANARY_TARGET=local pnpm canary:provider

# 4. Install named Cloudflare Tunnel (dry-run first)
pnpm cloudflare:tunnel:install
# operator supplies CLOUDFLARE_TUNNEL_TOKEN in the shell, then:
pnpm cloudflare:tunnel:install -- --apply

# 5. After the Cloudflare published hostname points to Caddy
ECORIONE_PUBLIC_BASE_URL=https://<production-hostname> pnpm production:smoke

# 6. After hosted credentials are entered through Connect Vault
pnpm canary:providers

# 7. Capture health/traffic evidence
pnpm production:ops-snapshot
pnpm production:data-evidence

# 8. Only after tunnel/public smoke is stable: firewall dry-run then explicit cutover
pnpm cloudflare:origin:lockdown
pnpm cloudflare:origin:lockdown -- --apply
```

`npm/pnpm` forwards arguments after `--`; the mutation scripts themselves also accept direct execution with `--apply`.

## Evidence rules

Do not mark #3–#12 DONE from repository CI alone. They require evidence from the actual deployment or real provider/account boundary. Specifically:

- a `Healthy` Cloudflare Tunnel alone does not prove the local origin route works;
- a local provider stub does not prove hosted-provider quality/latency/cost;
- ECX packet/hydration counts do not prove savings;
- same-host backup does not prove disaster recovery against host loss;
- repository security CI does not prove host firewall/SSH/account posture.

## Stop conditions

Stop deployment/cutover if any of these occurs:

- production env contains placeholders or has unsafe permissions;
- Compose validation or production acceptance fails;
- Cloudflare edge port 7844 is unreachable from the VPS;
- public smoke fails;
- `/ops` or `/settings` becomes unauthenticated;
- MCP protected-resource metadata/challenge points at a non-public/incorrect resource URL;
- provider matrix fails or cannot restore original runtime settings;
- Historical Ledger integrity verification fails;
- origin-lockdown preflight cannot prove active SSH allow rule + active cloudflared + working public path.

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
