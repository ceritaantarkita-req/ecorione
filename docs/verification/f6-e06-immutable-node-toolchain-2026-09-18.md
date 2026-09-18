# F6-E06 — Immutable Node Toolchain

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E06 removes mutable Node major-version selection from repository build/acceptance workflows.

Canonical build-toolchain pin:

```text
.node-version = 22.20.0
```

The existing production Docker baseline already used `node:22.20.0-bookworm-slim`; this scope makes GitHub Actions consume the same exact version and continuously rejects drift.

## Repository changes

- added `.node-version` with exact semver `22.20.0`;
- added `scripts/node-toolchain-review.mjs`;
- added `pnpm run toolchain:node-review`;
- added focused tests;
- all tracked workflows using `actions/setup-node` now use `node-version-file: ".node-version"`;
- MCP External acceptance path filters include `.node-version`, so a Node pin change triggers that acceptance;
- normal CI has a named **Node toolchain review** step;
- release-security acceptance protects the package/CI wiring and executes the same review;
- Dockerfile Node base must match the exact `.node-version` pin.

## Policy boundary

The review requires:

1. `.node-version` is exact `x.y.z`;
2. every tracked workflow using `actions/setup-node` consumes `.node-version` rather than a direct selector;
3. the Dockerfile Node base begins with the same exact version;
4. normal CI and release-security acceptance preserve the review wiring.

`package.json#engines.node` remains the supported-runtime compatibility range, not the build-toolchain identity. F6-E06 does not narrow package compatibility solely to manufacture reproducibility.

Chocolatey/Inno Setup version pinning is outside F6-E06 and remains a separate later toolchain scope.

## Closure gate

F6-E06 closes only after:

- exact-head CI PASS;
- named **Node toolchain review** PASS;
- named **Release security acceptance** PASS;
- Product Eval PASS;
- MCP External HTTPS Acceptance PASS when triggered by workflow/`.node-version` changes;
- guarded merge to `main`;
- canonical docs closure sync.

No provider/model call, hosted spend, W18 rerun, or infrastructure mutation is part of this scope.
