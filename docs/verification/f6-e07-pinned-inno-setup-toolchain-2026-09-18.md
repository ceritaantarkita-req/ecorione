# F6-E07 — Pinned Inno Setup Installer Toolchain

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E07 removes the last known mutable compiler package resolution from the Windows Desktop Installer workflow.

Canonical compiler pin:

```text
.inno-setup-version = 6.7.1
```

Chocolatey currently lists Inno Setup 6.7.1 as an approved package version. The repository consumes the version through one central file instead of relying on Chocolatey's current default at workflow execution time.

## Repository changes

- added `.inno-setup-version` with exact semver `6.7.1`;
- Desktop Installer reads the central file on the Windows job;
- Chocolatey install now uses `--version="$version"`;
- added `scripts/installer-toolchain-review.mjs`;
- added `pnpm run toolchain:installer-review`;
- added focused tests;
- normal CI has a named **Installer toolchain review** step;
- release-security acceptance protects the package/CI wiring and executes the same review;
- compiler path major must remain aligned with the pinned Inno Setup major.

## Policy boundary

The deterministic review requires:

1. `.inno-setup-version` is exact `x.y.z`;
2. Desktop Installer contains an Inno Setup Chocolatey install;
3. the install is explicitly versioned;
4. the workflow reads the central version file;
5. the compiler path matches the pinned major version.

This does not claim Chocolatey's package availability forever. That is why closure additionally requires a real Desktop Installer workflow run.

## Closure gate

F6-E07 closes only after:

- exact-head CI PASS;
- named **Installer toolchain review** PASS;
- named **Release security acceptance** PASS;
- Product Eval PASS;
- real Desktop Installer workflow PASS on the exact reviewed branch/head, including the Windows compiler job;
- guarded merge to `main`;
- canonical docs closure sync.

No provider/model call, hosted spend, W18 rerun, VPS/Cloudflare mutation, or production deployment is part of this scope.
