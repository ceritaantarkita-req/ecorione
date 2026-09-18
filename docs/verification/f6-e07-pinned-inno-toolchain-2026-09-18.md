# F6-E07 — Pinned Inno Setup Installer Toolchain

Date: **2026-09-18**

Status: **CLOSED / REPO-SIDE PASS**

## Scope

F6-E07 removes mutable Windows installer compiler resolution from the Desktop Installer workflow.

Canonical installer-toolchain pin:

```text
.inno-setup-version = 6.7.1
```

The Chocolatey community package currently publishes Inno Setup 6.7.1 as an approved package. The repository pin is now explicit and reviewable rather than resolving whatever version Chocolatey serves at runtime.

## Repository changes

- added `.inno-setup-version` with exact semver `6.7.1`;
- Desktop Installer reads the version file and installs `innosetup` with Chocolatey `--version`;
- Desktop Installer now runs automatically on pull requests that touch its workflow/toolchain inputs;
- PR acceptance uses deterministic fallback release version `0.1.0` while `workflow_dispatch` keeps the operator-provided release version;
- added `scripts/installer-toolchain-review.mjs`;
- added `pnpm run toolchain:installer-review`;
- added focused tests;
- normal CI has a named **Installer toolchain review** step;
- release-security acceptance protects the package/CI/workflow wiring and executes the same policy.

## Policy boundary

The review requires:

1. `.inno-setup-version` is exact `x.y.z`;
2. Desktop Installer has a pull-request acceptance trigger;
3. the version pin file itself is in the workflow path filter;
4. the workflow reads the pin file;
5. Chocolatey installation uses `--version`;
6. PR builds have a deterministic fallback version.

This scope pins the compiler package version. It does not claim Chocolatey repository immutability beyond that version identifier.

## Closure gate

F6-E07 closes only after:

- exact-head CI PASS;
- named **Installer toolchain review** PASS;
- named **Release security acceptance** PASS;
- Product Eval PASS;
- real **Desktop Installer** PR workflow PASS including the Windows compiler/install/build job;
- guarded merge to `main`;
- canonical docs closure sync.

No provider/model call, hosted spend, W18 rerun, or infrastructure deployment mutation is part of this scope.


## Closure evidence

```text
PR = #160
exact reviewed head = 472819b3a7c875246ce76daee8212a7aed8fc8c9
CI #1072 = initial verify timeout in Phase 4 Temporal; same-head failed-job rerun PASS
Product Eval #311 = PASS
MCP External HTTPS Acceptance #498 = PASS
Desktop Installer #41 = PASS
merged main = 9362419a9e2766750237e30792a50494d39c9b17
```

The first CI verify attempt timed out only in the pre-existing Phase 4 Temporal restart acceptance. No E07 unit or installer-toolchain test failed. The failed verify job was rerun on the exact same reviewed head with no source change and passed the full sequence, including **Installer toolchain review**, **Release security acceptance**, and production build.

Desktop Installer #41 passed the Linux bundle job and real Windows installer job using the repository-pinned Inno Setup version. No provider/model call, hosted spend, W18 rerun, or infrastructure deployment mutation was made.

## Next scope

F6-E08 addresses the remaining tag-only container identities in the Dockerfile and deployment compose surfaces. Exact tags remain human-readable, but repository-reviewed digests are required for immutable build/runtime image identity.
