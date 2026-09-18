# ECORIONE — Active Work Plan

Last updated: **2026-09-18**

Status: **ACTIVE / current work only**

This document intentionally excludes closed W-series chronology and old benchmark details. Those remain in `docs/verification/`.

## Active item

| ID | Work | Status | Boundary |
|---|---|---:|---|
| F6-E08 | Immutable container/base image digest pinning + drift gate | **IMPLEMENTED / IN REVIEW** | Repository/release reproducibility only; no deployment or provider mutation. |

F6-E01 through F6-E07 are **CLOSED / REPO-SIDE PASS**.

## F6-E08 objective

Current Docker/build/deployment image references are version-tagged but still mutable at the registry level. F6-E08 closes that reproducibility gap without changing runtime architecture.

### Implementation checkpoint

Implemented on the F6-E08 branch:

- Node/Postgres/Temporal/Caddy external image refs use readable tags plus full sha256 digests;
- production, local Temporal, and desktop Compose surfaces are governed;
- repository-built ECORIONE images remain exempt because their identity is source/bundle-derived rather than registry-resolved;
- `scripts/container-image-review.mjs` rejects tag-only, digest-only, malformed-digest, and unexpected dynamic external refs;
- focused Vitest coverage is included;
- normal CI + release-security acceptance execute/protect the review.

Closure still requires exact-head CI/Product Eval/relevant acceptance and guarded merge.

### Implementation checklist

1. inventory every governed `FROM` and Compose image reference;
2. bind each governed image to a reviewed digest while preserving a readable version tag;
3. add a deterministic repository review script that rejects governed tag-only identities;
4. add focused tests for valid pins, missing digests, malformed digests, and policy drift;
5. wire the review into normal CI;
6. wire it into release-security acceptance;
7. run relevant exact-head CI/Product Eval/acceptance;
8. guarded merge;
9. synchronize current docs and mark F6-E08 closed.

### Invariants

- no change to provider/model selection;
- no hosted spend;
- no W18 rerun;
- no VPS/Cloudflare mutation;
- no second scheduler/runtime;
- no weakening existing security/release gates to obtain PASS.

## After F6-E08

Close/freeze the existing baseline first. Then, if the operator chooses, create a **new roadmap** for the next product layer. Projects / Work / Schedule / Brain belong to that later roadmap and must not be silently folded into Fase 6 hardening.
