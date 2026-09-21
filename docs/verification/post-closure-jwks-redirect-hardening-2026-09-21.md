# Post-closure MCP JWKS redirect fail-closed hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

Connect MCP validates OAuth JWT signatures against a configured JWKS endpoint. The default JWKS fetch still used Fetch's redirect-follow behavior.

JWKS is a trust-root input: a redirect should not silently move key retrieval away from the configured endpoint, even though the request itself carries no bearer credential.

## Fix boundary

The maintenance patch:

- adds `redirect: "error"` to the default JWKS fetch;
- adds deterministic regression coverage proving a JWKS 302 target is not followed;
- extends release-security acceptance so the JWKS redirect boundary remains continuously gated.

## Non-claims

This change does **not**:

- change issuer, audience, JWT algorithm, scope, or sensitivity validation;
- change the configured JWKS URL;
- change OAuth/MCP exposure topology;
- mutate staging or production;
- make a hosted provider call or consume provider spend;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head test and merge status.
