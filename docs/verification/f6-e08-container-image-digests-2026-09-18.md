# F6-E08 — immutable container image digest pinning

Date: **2026-09-18**

Status: **CLOSED / REPO-SIDE PASS**

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

## Closure evidence

```text
PR = #164
exact reviewed head = 6c46944108cdc275aebc682bd132ec9dc69e14e4
CI #1114 = PASS
Product Eval #353 = PASS
MCP External HTTPS Acceptance #528 = PASS
Desktop Installer #70 = PASS
merged main = cacffa6c59d6871ae1ab4e11ae17cd48847864c1
```

CI #1114 explicitly passed the new **Container image digest review** and **Release security acceptance** steps, alongside format/lint/typecheck/test, Phase 4 real-process acceptance, production operations acceptance, secret scans, dependency policy, Actions/runner pinning, Node/Inno toolchain reviews, and production build.

Desktop Installer #70 passed both the Linux bundle job and real Windows installer job, including Setup compilation and installer SHA-256 generation.

No hosted W18 call, provider/model mutation, VPS/Cloudflare mutation, or future Projects/Schedule/Brain implementation was part of this closure.
