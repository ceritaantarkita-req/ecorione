# Post-closure JWKS rotation refresh hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE AUTH RELIABILITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

Connect MCP caches configured JWKS keys for five minutes. Before this maintenance fix, a valid token signed with a newly rotated `kid` could be rejected until the existing cache TTL expired, even when the issuer had already published the new key.

Blindly refreshing on every unknown `kid` would create a network-amplification path for attacker-controlled JWT headers.

## Fix boundary

The maintenance patch:

- keeps the normal JWKS cache TTL unchanged;
- if the cache is still fresh and the requested `kid` is absent, performs one bounded refresh;
- does not perform an immediate second fetch when the cache was just populated and the `kid` is still absent;
- throttles repeated unknown-`kid` forced refreshes with a 30-second cooldown;
- keeps issuer, audience, expiry, signature, OAuth scope, memory scope, and sensitivity validation unchanged;
- adds deterministic tests for key rotation refresh and unknown-`kid` refresh throttling;
- extends release-security acceptance to guard the bounded-refresh contract.

## Non-claims

This change does **not**:

- change the configured issuer or JWKS URL;
- add OIDC discovery;
- weaken signature verification;
- make provider calls or consume spend;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head verification and merge status.
