# Post-closure MCP auth error semantics — 2026-09-21

Status: **BOUNDED MAINTENANCE AUTH CORRECTNESS FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Findings

Two MCP authentication failures were being flattened into HTTP 400 responses:

1. a JWT that decoded as JSON but failed the required header/payload schema (for example unsupported `alg` or a missing required claim);
2. a JWKS dependency failure such as network failure, non-success response, or malformed JWKS data.

These are different classes of failure and should not be presented to callers as the same client-side bad request.

## Fix boundary

The maintenance patch:

- converts JWT header/payload schema failures into `McpAuthError(401, "invalid_token", ...)`;
- preserves the existing scoped Bearer challenge for invalid tokens;
- wraps JWKS retrieval/parsing failures in a dedicated `McpAuthDependencyError`;
- maps that dependency failure to HTTP 502 with a JSON-RPC internal-error body;
- does not emit a Bearer challenge for JWKS dependency outages;
- keeps raw upstream diagnostics out of the public error body;
- keeps signature, issuer, audience, expiry, OAuth scope, memory scope, sensitivity, redirect, cache, and rotation-refresh behavior unchanged;
- adds regression tests and a release-security contract check.

## Non-claims

This change does **not**:

- change OAuth issuer/resource/JWKS configuration;
- weaken JWT validation;
- change MCP tool authorization;
- mutate staging or production;
- make provider calls or consume spend;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head verification and merge status.
