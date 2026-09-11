# ECORIONE — Production Activation Workstream

Status: **ACTIVE**
Date: 2026-09-11

This is the post-closure operational workstream. It does not reopen Batch 1–12 and it is not Batch 13.

## Objective

Take the repository-verified production/self-host baseline through a real local rehearsal first, then into a real compute-host deployment, put a stable Cloudflare Free edge in front of it, validate real providers and real traffic, and gather production evidence before any new feature scope is accepted.

## Current starting point

- Planned implementation roadmap: **12/12 CLOSED (100%)**.
- Production Activation tooling and local-rehearsal runtime fixes are merged on `main`.
- Real laptop rehearsal: **PASS through Phase 4 + real Ollama/Gemma canary + direct Ai API + real browser Local chat**; see `docs/verification/local-production-rehearsal-2026-09-10.md`.
- Final sourced-env local verification after the local-fix merges: **104/104 test files, 540 passed, 2 skipped, secret scan clean, production build PASS**.
- Post-merge CI for the secret-scan boundary fix (`34515179325`) passed all repository gates.
- Repository provides Docker/Compose self-host baseline, Caddy, Temporal/PostgreSQL, Connect Vault, spend budget, provider canaries, `/ops`, release/rollback tooling, and real public MCP acceptance.

## Local rehearsal findings now merged

The local rehearsal deliberately preceded VPS mutation and found defects that repository-only CI had not exposed:

- the previous Temporal image pin `temporalio/auto-setup:1.31.2` could not be pulled; the pull/run-verified pin is `1.29.7`;
- local model runtime identity was conflated with a hard-coded Qwen pricing identity and cache key;
- browser chat could not explicitly request the local path and therefore hit the hosted kill switch during a local-first test;
- one proxy test inherited a sourced machine-local `ECORIONE_INTERNAL_TOKEN` instead of isolating its own environment;
- `secret-scan` treated intentionally gitignored machine-local `.env` as though it were a commit candidate.

All five findings are corrected on `main`. The merged state separates runtime model identity from the generic zero-provider-token pricing identity, makes the local cache key runtime/model-specific, adds explicit Local/Hosted chat selection, keeps tests deterministic under sourced local runtime state, and scopes secret scanning to Git commit candidates while still rejecting tracked/force-added credentials and non-ignored untracked secrets.

## Real local browser evidence

The final real local runtime used the OpenAI-compatible local path with Ollama and `gemma4:latest`, while `ECORIONE_COST_KILL_SWITCH=1` kept hosted calls blocked.

Evidence observed on the laptop:

- provider canary: `target=local`, `provider=local`, `model=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`, PASS;
- direct Ai `POST /api/chat` with `target=local`: success, `model=gemma4:latest`, provider-token `actualUsd=0`, `routeReason=local-consolidation`;
- browser UI after hard refresh: `Route: Local` visible, route locked after first turn, real assistant response completed, UI displayed `Model: gemma4:latest`, cache state and zero local provider-token cost.

A stale browser bundle initially hid the route selector even though server HTML already contained it. Hard refresh loaded the merged UI; no repository code change was required for that condition.

## Tooling available in this workstream

| Command | Purpose | Mutation |
|---|---|---|
| `pnpm production:preflight` | Validate production env, file permissions/Compose/repo acceptance/disk-floor checks | Read-only |
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
| 0 | Local production rehearsal | **DONE / LOCAL BOUNDARY CLOSED** | Phase 1/3/4 PASS; Temporal worker RUNNING; real Gemma canary PASS; direct Ai API PASS; browser Local chat PASS; sourced-env verification PASS |
| 1 | Confirm repository/post-merge CI | **DONE** | Current local-fix post-merge CI passed all gates |
| 2 | Audit final docs/repo state | **DONE / synchronized through local evidence closure** | Canonical handoff and local verification note updated |
| 3 | Validate Historical Ledger + ECX against real local traffic | **ACTIVE NEXT CHECKPOINT** | Inspect the real Local chat chronology/integrity and ECX/model/token/cache/cost evidence; keep claims bounded |
| 4 | Deploy ECORIONE to real compute host/VPS | **PENDING AFTER CURRENT LOCAL EVIDENCE CHECKPOINT** | sync merged `main`, then `pnpm production:preflight` and `scripts/self-host-install.sh --apply` on target host |
| 5 | Install Cloudflare Free + named Tunnel | **TOOLING READY / BLOCKED ON CLOUDFLARE+HOST ACCESS** | `pnpm cloudflare:tunnel:install`, then publish hostname -> local Caddy |
| 6 | Configure domain/DNS/HTTPS/Caddy/MCP routing | **TOOLING READY / BLOCKED ON DOMAIN+CLOUDFLARE ACCESS** | `ECORIONE_PUBLIC_BASE_URL=https://<host> pnpm production:smoke` must PASS |
| 7 | Lock direct origin ingress | **GUARDED TOOLING READY / BLOCKED ON HOST ROOT ACCESS** | Dry-run `pnpm cloudflare:origin:lockdown`; explicit ack + `--apply` only after public smoke |
| 8 | Production E2E edge smoke | **TOOLING IMPLEMENTED; REAL RUN PENDING #4–6** | `pnpm production:smoke` |
| 9 | Add real hosted AI providers through Connect Vault | **BLOCKED ON OPERATOR CREDENTIALS** | Add secret via `/settings` or Connect control API; no secret in Git/env history |
| 10 | Run real hosted-provider matrix canary | **TOOLING IMPLEMENTED; REAL RUN PENDING #9** | `pnpm canary:providers`; all intended providers must PASS and original settings restored |
| 11 | Start production observability baseline | **TOOLING IMPLEMENTED; REAL SNAPSHOT PENDING #4** | `/ops` + `pnpm production:ops-snapshot`; external retention remains operator choice |
| 12 | Host hardening | **READ-ONLY AUDIT IMPLEMENTED; REMEDIATION NEEDS ROOT** | `pnpm production:host-audit`; review firewall/SSH/patching/off-host backup findings |
| 13 | Product/UX improvements from production evidence | **WAITING FOR EVIDENCE** | Create explicit scope only from observed friction/usage |

## Current immediate execution order

```bash
# 1. Local Historical Ledger + ECX evidence from the real Local chat traffic
pnpm production:data-evidence

# 2. On the future compute host: validate host/repo/config without deploying
pnpm production:preflight
pnpm production:host-audit

# 3. Start ECORIONE only after production.env contains no placeholders
scripts/self-host-install.sh --apply

# 4. Local canary on the compute host before public cutover
ECORIONE_CANARY_TARGET=local pnpm canary:provider

# 5. Install named Cloudflare Tunnel (dry-run first)
pnpm cloudflare:tunnel:install
# operator supplies CLOUDFLARE_TUNNEL_TOKEN in the shell, then:
pnpm cloudflare:tunnel:install -- --apply

# 6. After the Cloudflare published hostname points to Caddy
ECORIONE_PUBLIC_BASE_URL=https://<production-hostname> pnpm production:smoke

# 7. After hosted credentials are entered through Connect Vault
pnpm canary:providers

# 8. Capture health/traffic evidence
pnpm production:ops-snapshot
pnpm production:data-evidence

# 9. Only after tunnel/public smoke is stable: firewall dry-run then explicit cutover
pnpm cloudflare:origin:lockdown
pnpm cloudflare:origin:lockdown -- --apply
```

`npm/pnpm` forwards arguments after `--`; mutation scripts themselves also accept direct execution with `--apply`.

## Evidence rules

Do not mark the compute-host/Cloudflare/hosted-provider steps DONE from repository CI or the local rehearsal alone. They require evidence from the actual production host/provider/account boundary where applicable. Specifically:

- a local Phase 4 PASS does not prove VPS persistence/restart/backup behavior;
- a `Healthy` Cloudflare Tunnel alone does not prove the local origin route works;
- a real local provider canary does not prove hosted-provider quality/latency/cost;
- ECX packet/hydration counts do not prove savings;
- the UI's counterfactual `savedUsd` display is not a public savings claim;
- same-host backup does not prove disaster recovery against host loss;
- repository security CI does not prove host firewall/SSH/account posture.

## Stop conditions

Stop deployment/cutover if any of these occurs:

- production env contains placeholders or has unsafe permissions;
- Compose validation or production acceptance fails;
- Cloudflare edge port 7844 is unreachable from the compute host;
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
4. `docs/verification/local-production-rehearsal-2026-09-10.md`
5. `docs/production-operations.md`
6. `docs/cloudflare-free-deployment.md`
7. `docs/release-operations.md`
8. `docs/security-review.md`

## Architecture boundary

Cloudflare is an external DNS/TLS/tunnel edge only. ECORIONE compute, policy, credentials, data stores, Temporal, Artifact and Sandbox remain self-hosted. Hub remains policy/approval authority and Connect remains provider/credential/MCP owner.
