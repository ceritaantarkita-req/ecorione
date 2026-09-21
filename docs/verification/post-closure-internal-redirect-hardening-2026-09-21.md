# Post-closure internal redirect fail-closed hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

A post-closure source audit found several internal service-to-service fetches that could still use Fetch's default redirect-follow behavior while carrying ECORIONE internal/owner credentials.

The existing product security boundary already requires credential-bearing owner requests to fail closed on redirects. Flow and the hardened Ai owner proxies already enforced `redirect: "error"`, but the same invariant was not uniformly applied to:

- the shared internal HTTP client;
- Hub MCP -> Artifact content;
- Hub ECX -> Artifact preview/hydration;
- Hub multimodal -> Artifact content;
- Ai Brain -> owner Context/ECX requests;
- Sync -> Connect MCP forwarding.

## Fix boundary

The maintenance patch:

- adds `redirect: "error"` to each affected internal boundary;
- does not alter provider routing or external hosted-provider semantics;
- adds a deterministic shared-client redirect regression test;
- extends `release-security-acceptance.mjs` so these internal redirect controls are continuously gated.

## Non-claims

This fix does **not**:

- authorize a production cutover;
- change staging activation;
- change provider credentials, models, budget, or W18 authorization;
- open a new PE, PCS, F6, Batch, or W-series scope.

No hosted provider call or paid workload is needed to verify this change.
