# ECORIONE Security Review Baseline

Batch 12 closes a production/self-host **baseline**, not an assertion that future vulnerabilities are impossible.

## Enforced controls

- Internal HTTP uses bearer authentication, timing-safe comparison, bounded request IDs, no-store responses, security headers, and process-local rate limiting.
- Public MCP keeps OAuth/OIDC resource-server validation and Sync remains the public bridge; inbound MCP itself stays loopback-only in Compose.
- Outbound MCP HTTPS rejects inline URL credentials/fragments; insecure HTTP is loopback-only with explicit opt-in; stdio commands require an operator allowlist; secret-looking env names require vault references.
- Flow HTTP is host-allowlisted, redirect-disabled, timeout-bounded, and HTTP node POSTs carry deterministic idempotency keys.
- Artifact/backup/Sandbox existing traversal and escape tests remain release evidence; Docker socket is not mounted into the application baseline.
- Credential plaintext is accepted only at Connect's control endpoint, encrypted into the Connect vault, and never returned by list/settings APIs.
- Working-tree and full Git-history secret scans are separate CI gates.

## AuthN/AuthZ and audit review

Caddy Basic Auth protects external `/ops` and `/settings`; internal service routes remain protected by `ECORIONE_INTERNAL_TOKEN`. Hub remains the capability/policy authority for node/model/MCP execution. Control-plane mutations do not grant execution permission. Operational counters record control changes; Hub/RnD keep the existing durable execution/audit evidence for governed actions.

## Residual operator responsibilities

Host firewalling, OS patching, TLS/DNS ownership, provider-account MFA/limits, off-host backup replication, external metrics retention, master-key custody, and real-provider canary evidence remain deployment responsibilities. DNS allowlists reduce SSRF surface but do not replace egress firewall/DNS controls on hostile infrastructure.
