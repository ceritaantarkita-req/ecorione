# Fase 6+ — Evidence-driven hardening

**Status:** ACTIVE / OPEN-ENDED  
**Current item:** F6-E08  
**Last reconciled:** 2026-09-18

Fase 6+ is not a permanent “feature phase” and should never become an excuse to keep old workstreams open. Each item is a bounded evidence-driven hardening scope. Closed items stay closed unless new evidence invalidates them.

Current handoff: [current-state-and-next-steps.md](current-state-and-next-steps.md).

## Closed F6 scopes

| ID | Scope | State |
|---|---|---:|
| F6-E01 | Held-out selector eval + bounded eval governance | **CLOSED / REPO-SIDE PASS** |
| F6-E02 | Continuous dependency-policy CI gate | **CLOSED / REPO-SIDE PASS** |
| F6-E03 | Release-security acceptance in normal CI | **CLOSED / REPO-SIDE PASS** |
| F6-E04 | Immutable GitHub Actions pinning | **CLOSED / REPO-SIDE PASS** |
| F6-E05 | Fixed GitHub-hosted runner labels | **CLOSED / REPO-SIDE PASS** |
| F6-E06 | Immutable Node toolchain | **CLOSED / REPO-SIDE PASS** |
| F6-E07 | Pinned Inno Setup toolchain | **CLOSED / REPO-SIDE PASS** |

Exact evidence remains in `docs/verification/`.

## Active F6-E08

Goal: make governed container/base-image identity immutable and continuously reviewable.

Required result:

- Dockerfile/base image references are digest-bound;
- deployment Compose images are digest-bound where governed;
- readable version tags remain alongside digests where supported;
- deterministic drift review rejects tag-only/malformed governed identities;
- focused tests cover the policy;
- CI and release-security acceptance run the review;
- relevant exact-head gates pass before merge.

This work is repository-side only. It does not authorize provider calls, paid benchmarks, production deployment, or Cloudflare mutation.

## Baseline hardening already present

The repository already has:

- working-tree and full-history secret scanning;
- dependency and release-security gates;
- immutable GitHub Actions references;
- fixed GitHub-hosted runner labels;
- pinned Node and Inno Setup toolchains;
- Connect Vault + durable spend controls;
- no silent provider fallback;
- Hub policy/approval/capability authority;
- idempotency rules for side effects;
- Temporal durable execution;
- owner-scoped data/backup/rebuild boundaries;
- local observability and production-ops tooling;
- Windows runtime + installer acceptance evidence.

Do not rebuild these as new subsystems merely because older planning documents still describe their original implementation work.

## Deferred scopes

- compute-host/VPS + Cloudflare activation — deferred by operator;
- AutoClick — deferred by design until a concrete non-API use case passes review.

## Evidence rules

For any new hardening item:

1. open a bounded explicit scope;
2. preserve owner boundaries and accepted ADRs;
3. add deterministic tests for code/policy changes;
4. do not weaken gates to recover PASS;
5. capture exact-head CI/Product Eval/acceptance where relevant;
6. preserve valid failures as historical evidence;
7. update current docs after guarded merge;
8. do not turn bounded evidence into universal performance/security claims.

Paid W18 evidence is closed and must not be rerun just to refresh documentation.

## Future product evolution

Projects / Work / Schedule / Brain are not F6 hardening. Once the existing baseline is frozen after F6-E08, they should begin under a new product roadmap with explicit architecture decisions and migration boundaries.
