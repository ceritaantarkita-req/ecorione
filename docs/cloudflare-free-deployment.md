# ECORIONE — Cloudflare Free Deployment Guide

Last reviewed against Cloudflare documentation: **2026-09-10**  
Current project status reconciled: **2026-09-11**

Status: **FUTURE DEPLOYMENT OPTION / DEFERRED BY OPERATOR DECISION**

This file remains the deployment guide for a future Cloudflare Free + Tunnel rollout. It is **not the active next checkpoint**. Local persistence/restart is now **CLOSED / PASS** for the tested laptop boundary; the operator-approved active next checkpoint is **isolated local backup/restore**, followed by observability, product validation, and local model-identity hardening before deciding whether to deploy to a VPS/compute host.

The local Comparative ECX checkpoint is **CLOSED / PASS WITH LIMITATIONS**. Neither that result nor the local persistence/restart PASS changes this deployment deferral or constitutes Cloudflare/VPS evidence.

Do not execute Cloudflare account, DNS, Tunnel, firewall, or target-host mutation from the current local workstream. Resume this guide only after an explicit operator decision. Current state: `docs/current-state-and-next-steps.md`.

## 1. Architecture decision when deployment resumes

If the operator later chooses Cloudflare Free for the public edge, the recommended topology remains:

```text
Internet
  -> Cloudflare Free DNS / TLS edge / basic WAF + DDoS protection
  -> Cloudflare Tunnel
  -> cloudflared on the ECORIONE compute host
  -> Caddy
  -> Ai / Sync-MCP routes
  -> internal Docker services
```

**ECORIONE compute, databases, Temporal, Artifact storage, Vault, Sandbox, and owner data stay on the VPS/self-host compute environment.** Cloudflare is transport/edge, not replacement compute.

Cloudflare Tunnel uses outbound connections from `cloudflared` to Cloudflare; a Tunnel-only final topology therefore does not require direct public inbound application ports on the origin once cutover is proven and other host requirements are accounted for.

Official references retained for future rollout:

- Cloudflare Tunnel overview: https://developers.cloudflare.com/tunnel/
- Tunnel setup: https://developers.cloudflare.com/tunnel/setup/
- Tunnel routing: https://developers.cloudflare.com/tunnel/routing/
- `cloudflared` downloads: https://developers.cloudflare.com/tunnel/downloads/
- Linux service: https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/linux/
- local tunnel configuration: https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/
- HTTPS origin troubleshooting: https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/

## 2. What “Cloudflare Free” means

A future rollout assumes:

- a Cloudflare account/zone;
- Cloudflare Tunnel on the selected plan;
- an existing VPS/server/compute host, still separate from Cloudflare;
- ECORIONE provider API usage, if any, billed separately from Cloudflare;
- domain registration handled separately unless already owned.

Do not interpret “Cloudflare Free deployment” as “zero infrastructure cost.” It means Cloudflare can be the free public edge/tunnel while ECORIONE remains self-hosted.

## 3. Prerequisites before any future mutation

When this workstream is explicitly resumed:

1. start from reviewed synchronized `main`;
2. inventory chosen target host before installing anything;
3. verify Docker + Compose and outbound connectivity;
4. prepare `deploy/production.env` from its example and remove every placeholder;
5. keep hosted-provider secrets in Connect Vault, never Git/plaintext docs;
6. generate strong internal/Sync/Temporal/Vault/MCP/operator credentials;
7. run `pnpm production:preflight` and `pnpm production:host-audit` read-only first;
8. resolve existing port/service collisions before ECORIONE deployment;
9. own/control intended domain and Cloudflare zone before publishing it.

Laptop/local evidence cannot satisfy target-host prerequisites. This includes local Comparative ECX, local persistence/restart, and local backup/restore results.

## 4. Recommended rollout when resumed

The safest sequence remains staged rather than changing application, DNS, TLS, Tunnel, and firewall state simultaneously.

### Stage A — establish real compute-host application boundary

After preflight/audit and reviewed production configuration:

```bash
scripts/self-host-install.sh --apply
ECORIONE_CANARY_TARGET=local pnpm canary:provider
```

Verify persistence/restart/application health on the actual host before public edge cutover.

If deployment design intentionally uses direct/proxied DNS temporarily for bootstrap, validate it before introducing Tunnel. Never close origin ingress before the replacement path is proven.

### Stage B — create and validate named Cloudflare Tunnel

Cloudflare Dashboard flow should be rechecked against current Cloudflare UI/documentation at execution time. Intended shape:

1. create a named Tunnel;
2. install/run `cloudflared` on ECORIONE compute host using operator-provided token;
3. wait for connected/healthy state;
4. publish application hostname to local Caddy origin;
5. preserve TLS verification and set correct origin server name/CA where required;
6. validate public hostname through ECORIONE smoke tests;
7. only after public validation, consider removing obsolete direct-origin DNS/ingress.

Repository tooling:

```bash
pnpm cloudflare:tunnel:install
# operator supplies CLOUDFLARE_TUNNEL_TOKEN only in the shell, then:
pnpm cloudflare:tunnel:install -- --apply

ECORIONE_PUBLIC_BASE_URL=https://<production-hostname> pnpm production:smoke
```

A “Healthy” Tunnel alone is not sufficient. Application path, auth boundaries, and MCP discovery/auth must pass through the public hostname.

## 5. Locally-managed Tunnel alternative

Cloudflare may recommend remotely managed tunnels for most deployments, but a locally-managed named tunnel remains an alternative when the operator intentionally wants local configuration.

Typical commands:

```bash
cloudflared tunnel login
cloudflared tunnel create ecorione-prod
cloudflared tunnel list
```

Example configuration shape:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/<USER>/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: ecorione.example.com
    service: https://localhost:443
    originRequest:
      originServerName: ecorione.example.com
  - service: http_status:404
```

Validate configuration before service installation:

```bash
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://ecorione.example.com
cloudflared tunnel info ecorione-prod
```

If installing as Linux service for a non-root-owned config, pass explicit config path so `sudo` does not make `cloudflared` search the wrong home directory.

## 6. ECORIONE hostname and MCP consistency

Caddy public routing separates:

- `/` -> Ai;
- `/ops*`, `/api/ops*`, `/settings*`, `/api/settings*` -> protected Ai/operator surfaces;
- `/.well-known/oauth-protected-resource*` -> Sync;
- `/mcp*` -> Sync.

Production values must refer to the real deployment, for example:

```text
ECORIONE_DOMAIN=ecorione.example.com
ECORIONE_MCP_RESOURCE=https://ecorione.example.com/mcp
ECORIONE_MCP_ALLOWED_ORIGINS=<explicit allowed origin list>
ECORIONE_MCP_OAUTH_ISSUER=<real HTTPS issuer>
ECORIONE_MCP_JWKS_URL=<real HTTPS JWKS endpoint>
```

Do not invent OAuth/JWKS values. They must match actual authorization deployment.

## 7. Firewall posture after proven Tunnel cutover

Only after named Tunnel and public application smoke are proven:

- do not expose internal ECORIONE service ports publicly;
- do not expose Temporal/PostgreSQL/Context/Connect/Hub/Sandbox/Artifact/Space/Flow/RnD directly;
- keep SSH restricted to operator secure administration path;
- close direct inbound web ports only if nothing else needs them and Tunnel-only mode is intended final state;
- keep required outbound connectivity for `cloudflared`, including documented tunnel port requirements.

Use guarded repo flow:

```bash
pnpm cloudflare:origin:lockdown
pnpm cloudflare:origin:lockdown -- --apply
```

Never skip dry-run/public-smoke/SSH/tunnel prerequisites merely because Cloudflare shows a connected connector.

## 8. Cloudflare security settings

Use edge controls only when they preserve ECORIONE semantics:

- HTTPS at public edge;
- applicable managed WAF/DDoS controls;
- rate/bot controls only after verifying they do not break MCP streaming/API behavior;
- Cloudflare Access may be defense-in-depth for human operator surfaces, but it must not replace ECORIONE Hub/Connect authorization or break MCP/OAuth client flows.

Caddy/operator authentication remains part of ECORIONE application baseline.

## 9. Verification required before calling future deployment healthy

At minimum, verify on real deployment:

```bash
docker compose --env-file deploy/production.env -f deploy/compose.yml ps
ECORIONE_PUBLIC_BASE_URL=https://<production-hostname> pnpm production:smoke
pnpm production:ops-snapshot
pnpm production:data-evidence
```

Also require evidence that:

- Ai loads through intended public hostname;
- `/ops` and `/settings` remain protected;
- local provider canary passes on compute host if local inference is part of deployment;
- hosted canaries run only when operator explicitly enables credentials/spend;
- MCP protected-resource discovery works;
- valid MCP auth works and invalid token/scope/origin cases remain rejected;
- owner data survives intended restart boundary;
- backups are created and integrity-verified;
- off-host/failure-domain backup evidence exists before claiming disaster-recovery resilience;
- origin is not directly reachable after firewall closure if Tunnel-only mode is intended.

## 10. Rollback

If edge/Tunnel routing fails:

1. do not mutate/restore ECORIONE owner data for a pure edge incident;
2. restore only minimum previous network/DNS/firewall path needed for service recovery;
3. validate Caddy/application health independently of Tunnel;
4. diagnose `cloudflared` separately;
5. re-cut over only after same public checks pass.

Cloudflare edge rollback and ECORIONE application/data rollback are separate operations.

## 11. Current implementation boundary

ECORIONE already has production Compose/Caddy, release tooling, observability, provider canaries, guarded Tunnel/origin scripts, and real public HTTPS MCP acceptance. A persistent named Cloudflare production tunnel remains an operator deployment action.

Current state on 2026-09-11:

- local runtime and Historical Ledger + ECX traffic/integrity evidence: **CLOSED**;
- local Comparative ECX evidence: **CLOSED / PASS WITH LIMITATIONS**;
- local persistence/restart evidence: **CLOSED / PASS**;
- isolated local backup/restore evidence: **ACTIVE NEXT CHECKPOINT**;
- VPS/compute-host deployment: **DEFERRED BY OPERATOR**;
- Cloudflare named Tunnel/public cutover: **DEFERRED WITH DEPLOYMENT**.

If Cloudflare provisioning is automated further later, it must remain a new explicit operations scope with least-privilege credentials, deterministic hostname/config validation, rollback, no personal production credentials in CI, and no weakening of Hub/Connect authorization boundaries.
