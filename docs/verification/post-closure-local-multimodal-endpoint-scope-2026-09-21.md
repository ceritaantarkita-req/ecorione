# Post-closure local multimodal endpoint scope hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE PRIVACY/SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

ECORIONE already enforces that text-model `localBaseUrl` stays in loopback/private/local host space unless the operator explicitly enables `ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC=1`.

The HTTP multimodal adapter used the same `route: "local"` privacy label for raw image/PDF/audio/video/TTS payloads, but its configured `ECORIONE_MULTIMODAL_LOCAL_URL` had no equivalent host-scope validation. A typo or public hostname could therefore send local-classified media to a public endpoint while the route still reported `local`.

## Fix boundary

The maintenance patch:

- validates `route: "local"` HTTP multimodal endpoints at adapter construction;
- permits only HTTP/HTTPS;
- rejects inline URL credentials and fragments;
- requires loopback/private/link-local/private-name host space by default;
- reuses the existing explicit local-inference opt-out `ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC=1` for deliberate public local endpoints;
- leaves hosted multimodal endpoint behavior unchanged;
- keeps redirect fail-closed behavior unchanged;
- adds deterministic regression coverage and release-security gating;
- updates the current multimodal operator contract.

## Non-claims

This change does **not**:

- change hosted fallback or sync-class policy;
- add a provider call or consume spend;
- add a new environment variable;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head verification and merge status.
