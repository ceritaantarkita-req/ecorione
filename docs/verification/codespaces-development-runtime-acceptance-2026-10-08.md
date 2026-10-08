# ECORIONE — Codespaces development profile runtime acceptance

Date: **2026-10-08**

Status: **PASS / DEVELOPMENT PROFILE ACCEPTED**

## Scope

This record closes the bounded GitHub Codespaces development-profile setup introduced by PR #463.

The purpose is to provide disposable online development compute for ECORIONE without changing product/service ownership and without reclassifying Codespaces as staging or production.

## Repository acceptance

PR #463 exact head before this closure record was `aca849d85478e20284cf7634ebf361b03ca84a7c`.

Observed GitHub gates:

- CI #2840 — PASS;
- Product Eval #2079 — PASS;
- CI `naming` — PASS;
- CI `secret-history` — PASS;
- CI full `verify` — PASS, including install, format, lint, typecheck, tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, dependency/toolchain/image reviews, release-security acceptance, and production build.

## Operator-controlled Codespaces runtime acceptance

The operator created a Codespace from branch `infra/codespaces-dev-profile-20261006` and executed:

```bash
bash .devcontainer/start.sh
```

Observed runtime acceptance:

- Codespace creation completed from the repository devcontainer;
- repository dependencies were present;
- existing `deploy/local-temporal.yml` startup path completed sufficiently for ECORIONE runtime use;
- existing root `pnpm dev` path launched the ECORIONE development stack;
- Ai preview loaded successfully through forwarded port `3000`;
- an internal Hub/Project request was observed returning HTTP 200 during the live run;
- the browser rendered the ECORIONE Ai surface with navigation for Projects, Schedule, Automation, Brain, Space, Flow, Operations, and Settings;
- port `3000` was intentionally made Public only for bounded visual review;
- Temporal `7233` and internal service ports remained Private;
- hosted/local model credentials were not required to prove the development environment itself.

## Explicit non-claims

This PASS does **not** prove:

- remote staging verification;
- production readiness or production authorization;
- DR-2 physical independence;
- durable production persistence;
- final multi-user identity/RBAC;
- safe permanent public exposure of port 3000;
- Session 12D Google OAuth + Picker acceptance from a Codespaces origin.

Session 12D retains its existing localhost OAuth/Picker acceptance contract until a separate origin/redirect adaptation is explicitly designed and accepted.

## Accepted development workflow

```text
GitHub main / short-lived branch
        |
        v
GitHub Codespaces
        |
        +--> existing ECORIONE service bootstrap
        +--> existing local Temporal Compose stack
        |
        v
private port 3000 preview by default
        |
        +--> temporary public visibility only for bounded shared review
```

Codespaces is now accepted as an ECORIONE **online development environment**, not as a replacement for a future persistent staging/production target.
