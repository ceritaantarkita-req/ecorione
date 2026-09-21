# Post-closure JWKS refresh outage semantics — 2026-09-21

Status: **BOUNDED MAINTENANCE AUTH RELIABILITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

The bounded unknown-`kid` refresh introduced for MCP JWKS rotation throttles repeated forced refreshes for 30 seconds.

If that forced refresh fails because the authorization server/JWKS dependency is unavailable, the refresh timestamp is already inside the cooldown window. Without preserving the failed-refresh state, a second unknown-`kid` request during the cooldown could be classified as `401 invalid_token` even though the most recent refresh failed because of an upstream dependency outage.

## Fix boundary

The maintenance patch:

- records whether the most recent unknown-`kid` forced refresh failed;
- keeps the 30-second cooldown and does not add another fetch during that window;
- rethrows the safe `McpAuthDependencyError` classification during the cooldown after a failed refresh;
- clears the failed-refresh state after any successful JWKS load;
- preserves normal `401 invalid_token` behavior when a successful JWKS refresh still does not contain the requested `kid`;
- adds deterministic regression coverage;
- extends the release-security contract for the refresh state.

## Non-claims

This change does **not**:

- change issuer/JWKS configuration;
- weaken signature, issuer, audience, expiry, or scope validation;
- change the JWKS TTL or cooldown duration;
- add provider calls or spend;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head verification and merge status.
