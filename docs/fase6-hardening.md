# Fase 6+ — Evidence-driven hardening

**Status:** ACTIVE / OPEN-ENDED  
**Current item:** none — F6-E01 through F6-E08 CLOSED  
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
| F6-E08 | Immutable container image digests + drift gate | **CLOSED / REPO-SIDE PASS** |

Exact evidence remains in `docs/verification/`.

## F6-E08 closure

F6-E08 is **CLOSED / REPO-SIDE PASS**.

The repository now:

- digest-pins governed external Dockerfile/Compose images while retaining readable tags;
- governs production, local Temporal, and desktop Compose surfaces;
- rejects tag-only, digest-only, malformed-digest, and unexpected dynamic external refs;
- runs the deterministic image review in normal CI and release-security acceptance.

Exact head `6c46944108cdc275aebc682bd132ec9dc69e14e4` passed CI #1114, Product Eval #353, MCP #528, and Desktop Installer #70 before PR #164 merged at `cacffa6c59d6871ae1ab4e11ae17cd48847864c1`.

There is no next F6 item implicitly opened by this closure.

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

Projects / Work / Schedule / Brain are not F6 hardening. They remain discussion material until a new product roadmap is explicitly agreed with architecture decisions and migration boundaries.
