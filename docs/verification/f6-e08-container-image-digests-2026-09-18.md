# F6-E08 — Immutable Container Image Digests

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E08 removes tag-only mutable identity from governed third-party container images used by the production/self-host baseline and local Temporal runtime.

Repository-pinned identities:

```text
node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e
postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94
caddy:2.11.4-alpine@sha256:de23def33b17fb5d1290b0f6c2add1d70780e52341896c00a4c8a2a2fe9d355e
temporalio/auto-setup:1.29.7@sha256:f14912b699cf73015ad5c4fc18d522d4b014db90e794039214dfb7c022c2644f
```

Readable version tags are intentionally retained next to immutable OCI index digests.

## Digest provenance

The exact digests were resolved on GitHub-hosted Ubuntu 24.04 through Docker Hub's OCI Registry API on CI #1078, job **e08-digest-resolver**. The resolver authenticated for pull scope and read the registry `Docker-Content-Digest` response for each exact tag.

The temporary resolver job was removed after the four full SHA-256 values were recorded. It is not part of the final CI baseline. The resolved identities are now stored once in `deploy/container-image-lock.json`; runtime surfaces are checked against that reviewed lock so a syntactically valid but different digest is rejected.

## Repository changes

- `deploy/container-image-lock.json` is the authoritative reviewed identity map for Node, Postgres, Caddy, and Temporal;
- Dockerfile Node base is tag+digest pinned and must match the lock;
- `deploy/compose.yml` Postgres, Temporal, and Caddy images are tag+digest pinned and must match the lock;
- `deploy/local-temporal.yml` Postgres and Temporal images must use the exact same locked identities;
- repository-built `ecorione:${ECORIONE_IMAGE_TAG:-local}` remains exempt because it is built from this repository rather than pulled as a third-party image;
- added `scripts/container-image-digest-review.mjs`;
- added `pnpm run images:digest-review`;
- added focused digest-policy tests;
- normal CI has a named **Container image digest review** step;
- release-security acceptance protects and re-executes the same policy;
- production-ops acceptance requires the exact reviewed tag+digest identities.

## Policy boundary

The permanent review requires:

1. `deploy/container-image-lock.json` must contain exactly the four reviewed external identities and each must be readable `tag@sha256:<64hex>`;
2. every external Dockerfile `FROM` image must match the corresponding reviewed lock identity;
3. every external `image:` in governed deployment compose files must match the corresponding reviewed lock identity;
4. repository-built ECORIONE image references remain explicitly exempt;
5. `scratch` build stages remain allowed;
6. CI, release-security, and production-ops wiring cannot silently disappear.

This scope pins the registry image identity. It does not claim that upstream tags will never be republished; digest pinning is precisely what prevents such tag movement from changing a reviewed build.

## Closure gate

F6-E08 closes only after:

- exact-head CI PASS;
- named **Container image digest review** PASS;
- named **Release security acceptance** PASS;
- production-ops acceptance PASS;
- Product Eval PASS;
- guarded merge to `main`;
- canonical docs closure sync.

No provider/model call, hosted spend, W18 rerun, or production deployment mutation is part of this scope.
