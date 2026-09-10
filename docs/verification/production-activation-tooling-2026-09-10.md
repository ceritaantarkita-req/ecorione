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

## Evidence boundary

Repository CI can prove the scripts build, lint, typecheck, test and preserve the existing acceptance gates. It cannot prove external production state. Items requiring the actual VPS, Cloudflare zone/tunnel, provider credentials, firewall or real traffic remain pending until evidence is collected from those boundaries.

No ECX/optimizer savings claim is permitted from packet/token counters alone.

## Acceptance rule

Merge only after the final human-authored PR head passes repository CI and MCP External HTTPS Acceptance and the temporary formatting helper is absent from the candidate tree.
