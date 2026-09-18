# F6-E08 — immutable container image digest pinning

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E08 closes mutable external container identity without changing provider, model, deployment, or workflow architecture.

Governed external references are pinned as readable version tag + full sha256 digest:

- Node `22.20.0-bookworm-slim`;
- PostgreSQL `17.6-alpine`;
- Temporal `auto-setup:1.29.7`;
- Caddy `2.11.4-alpine`.

Surfaces governed:

- `Dockerfile`;
- `deploy/compose.yml`;
- `deploy/local-temporal.yml`;
- `desktop/compose.yml`.

Repository-built ECORIONE images are intentionally exempt from external-registry digest policy because desktop/production identity is derived from reviewed source/bundle artifacts.

## Repository enforcement

- `scripts/container-image-review.mjs` auto-discovers tracked compose definitions plus required governed files;
- external images must contain both an explicit readable tag and full `sha256` digest;
- tag-only, digest-only, malformed digest, and arbitrary dynamic external image references fail closed;
- `pnpm run images:digest-review` is wired into normal CI;
- release-security acceptance verifies both wiring and policy result;
- focused tests live in `test/container-image-review.test.mjs`.

## Digest evidence used for implementation

The selected digests were checked against the corresponding registry metadata before being committed. This is repository identity pinning, not a vulnerability or freshness claim.

## Closure gate

F6-E08 closes only after exact-head CI, Product Eval, relevant acceptance, guarded merge, and canonical documentation sync. No hosted W18 calls or production infrastructure mutation are authorized by this scope.
