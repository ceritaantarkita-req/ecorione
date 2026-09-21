# ECORIONE Security Review Baseline

Last updated: **2026-09-21**

Status: **repository security baseline CLOSED / SumoPod staging hardening VERIFIED / future security remains evidence-driven**

Batch 12 closes a production/self-host **baseline**, not an assertion that future vulnerabilities are impossible. Final closure evidence is in `docs/verification/batch12-closure-2026-09-10.md`; current operational priorities are in `docs/current-state-and-next-steps.md`.

## Enforced controls

- Internal HTTP uses bearer authentication, timing-safe comparison, bounded request IDs/body handling, no-store responses, security headers, and process-local rate limiting.
- Public MCP keeps OAuth/OIDC resource-server validation and Sync remains the public bridge; inbound MCP itself stays loopback-only in Compose.
- Outbound MCP HTTPS rejects unsafe URL forms and insecure HTTP is loopback-only with explicit policy; stdio commands require an operator allowlist and credentials remain Vault references.
- Flow HTTP is host-allowlisted, redirect-disabled, timeout-bounded, and HTTP-node side effects use deterministic idempotency identities.
- Credential-bearing internal/owner fetches, hosted-provider fetches, multimodal adapters, local-runtime/provenance fetches, and MCP JWKS retrieval fail closed on redirects.
- Local model and Local multimodal endpoints are constrained to syntactically loopback/private/local host space by default; public routing requires the explicit existing `ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC=1` operator opt-out.
- MCP JWKS handling supports bounded unknown-`kid` key-rotation refresh, throttles repeated forced refreshes, rejects trust-root redirects, bounds default JWKS retrieval latency, classifies malformed token schema as `401 invalid_token`, and surfaces JWKS dependency failure as `502` without raw upstream diagnostics.
- Sync's public MCP bridge is redirect-fail-closed and timeout-bounded; malformed upstream JSON and transport failures map to sanitized explicit upstream errors.
- Connect credential-vault mutations are serialized with a filesystem lock; active contention is surfaced as retryable service unavailability rather than allowing overlapping writes.
- Sandbox idempotency keys are leased before authority/effect execution so concurrent duplicates cannot both cross the side-effect boundary.
- Artifact/backup/Sandbox traversal and escape tests remain release evidence; Docker socket is not mounted into the application baseline.
- Credential plaintext is accepted only at the Connect credential-control boundary, encrypted into the Connect Vault, and never returned by list/settings APIs.
- Working-tree and full Git-history secret scans are separate release gates.
- Public MCP acceptance remains a real external HTTPS test and was made tunnel-provider-resilient instead of being weakened when Cloudflare Quick Tunnel provisioning became unreliable.

## AuthN/AuthZ and audit review

Caddy Basic Auth protects external `/ops` and `/settings` in the repository self-host baseline. Internal service routes remain protected by `ECORIONE_INTERNAL_TOKEN` according to their boundary. Hub remains the capability/policy/approval authority for node/model/MCP execution. Control-plane configuration does not grant execution permission by itself.

Cloudflare Tunnel, DNS, WAF, Access, or any other reverse proxy **must not become ECORIONE's authorization authority**. They may add edge defense, but Hub/Connect security boundaries remain authoritative.

## Cloudflare Free deployment security posture

Recommended public topology after Batch 12:

```text
Cloudflare Free edge
  -> named Cloudflare Tunnel
  -> VPS cloudflared
  -> Caddy
  -> Ai / Sync-MCP
  -> internal ECORIONE services
```

Security rules:

- do not expose Connect MCP or internal service ports directly;
- establish a healthy origin before tunnel cutover;
- keep origin TLS verification enabled; configure `originServerName`/trusted CA when needed rather than leaving TLS verification disabled;
- once Tunnel-only mode is verified, close direct inbound 80/443 if no other service needs them;
- keep Cloudflare credentials/API tokens out of Git;
- use least-privilege Cloudflare tokens if provisioning is automated later;
- Cloudflare Access may add defense for human-only operator routes, but do not put an incompatible interactive login in front of MCP/OAuth endpoints;
- DNS/tunnel incidents are edge incidents and normally must not trigger database restore.

Detailed procedure: `docs/cloudflare-free-deployment.md`.

## Residual operator responsibilities

Repository CI does not automatically handle:

- host firewalling and network segmentation;
- OS/kernel/security patching;
- SSH policy/key lifecycle;
- Cloudflare account MFA/session/token review;
- provider-account MFA/limits/API-key rotation;
- off-host backup replication and retention;
- external durable metrics/alert retention;
- Vault master-key custody and disaster recovery;
- real-provider canary/evaluation evidence;
- incident response and breach-driven credential rotation.

DNS/URL validation reduces SSRF surface but does not replace egress firewall/DNS controls on hostile infrastructure. Process-local rate limiting is not a distributed global limiter.

## Current progress boundary

The planned platform/production roadmap is **12/12 batches CLOSED (100% of that defined roadmap)**. Security/release code and repository evidence are closed for that scope. Bounded post-closure maintenance is now closed through PR #237 without reopening the roadmap. The first checkpoint through PR #232 is preserved in `docs/verification/post-closure-maintenance-checkpoint-2026-09-21.md`; the follow-up checkpoint covering Sync MCP failure handling, credential-vault mutation serialization, Sandbox idempotency serialization, and JWKS fetch timeout is `docs/verification/post-closure-maintenance-checkpoint-2-2026-09-21.md`. Real SumoPod staging deployment and host hardening are now verified through PCS-07..PCS-09, including key-only SSH and a zero-blocker strict inventory. Remaining operational boundaries are public production promotion, optional Cloudflare/public-edge activation, off-host backup/DR, durable external telemetry/alert retention, real-provider production validation, OS patch lifecycle, and ongoing host/account security.
