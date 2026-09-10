# Production Activation tooling verification — 2026-09-10

Status: **CANDIDATE / exact-head CI required**

This verification note belongs to the explicit post-closure Production Activation workstream. It does not reopen Batch 1–12 and does not claim that a real VPS, Cloudflare account, hosted-provider credential, or production traffic has already been exercised.

## Repository-side candidate

The candidate adds guarded operational tooling for:

- production environment/Compose preflight;
- named Cloudflare Tunnel install readiness and explicit service installation;
- public HTTPS edge + MCP metadata/auth challenge smoke checks;
- origin firewall lockdown with SSH/tunnel/public-path prechecks and automatic web-ingress restoration when post-change smoke fails;
- read-only host security posture audit;
- sequential Anthropic/OpenRouter/OpenAI canaries through the existing Connect Vault/runtime settings boundary, restoring the original settings in `finally`;
- protected `/api/ops` health snapshots;
- Historical Ledger integrity and ECX/model/token/cache/cost traffic evidence floors;
- deterministic local regression coverage for the new scripts plus shell syntax validation.

## Acceptance hardening found during this workstream

A real public HTTPS run exposed a resilience bug in the existing MCP acceptance harness: in `auto` mode, the first successful tunnel provider was stored globally and reused for the second public endpoint. If the OAuth/JWKS Cloudflare Quick Tunnel became routable but the independently-created Sync/MCP Quick Tunnel hit fresh-host NXDOMAIN, the configured Pinggy fallback was never attempted for that second endpoint.

The candidate keeps `MCP_TUNNEL_PROVIDER=<explicit provider>` deterministic, but leaves `auto` selection independent per public endpoint. Therefore OAuth/JWKS and Sync/MCP may use different tunnel providers when necessary while still exercising the same real public-network OAuth/JWKS and MCP checks. The acceptance test is not downgraded to loopback evidence.

## Evidence boundary

Repository CI can prove the scripts build, lint, typecheck, test and preserve the existing acceptance gates. It cannot prove external production state. Items requiring the actual VPS, Cloudflare zone/tunnel, provider credentials, firewall or real traffic remain pending until evidence is collected from those boundaries.

No ECX/optimizer savings claim is permitted from packet/token counters alone.

## Acceptance rule

Merge only after the final human-authored PR head passes repository CI and MCP External HTTPS Acceptance and all temporary formatting/patch helpers are absent from the candidate tree.
