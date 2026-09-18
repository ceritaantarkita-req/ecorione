# F6-E05 — Fixed GitHub-hosted Runner OS Labels

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E05 removes mutable GitHub-hosted runner aliases from tracked workflows and adds a continuous fail-closed review.

Pinned labels:

```text
Linux jobs   -> ubuntu-24.04
Windows jobs -> windows-2025
```

These labels were verified against the current GitHub-hosted runners reference before implementation.

## Repository changes

- added `scripts/github-actions-runner-review.mjs`;
- added `pnpm run actions:runner-review`;
- added focused runner-review tests;
- normal CI has a named **GitHub Actions runner review** step;
- release-security acceptance protects the package/CI wiring and executes the same repo-wide review;
- `.github/workflows/ci.yml` uses `ubuntu-24.04`;
- `.github/workflows/product-eval.yml` uses `ubuntu-24.04`;
- `.github/workflows/mcp-external-acceptance.yml` uses `ubuntu-24.04`;
- Desktop Installer bundle remains `ubuntu-24.04`;
- Desktop Installer Windows job uses `windows-2025`.

## Policy

Tracked workflow YAML fails closed when a literal GitHub-hosted runner alias uses:

```text
ubuntu-latest
windows-latest
macos-latest
```

Fixed GitHub-hosted labels and self-hosted/custom labels remain allowed.

The scanner checks scalar `runs-on:` values and literal block/array content. Dynamic expressions are not interpreted as GitHub-hosted labels and remain outside this bounded policy.

## Closure gate

F6-E05 closes only when:

- exact-head CI passes;
- the named **GitHub Actions runner review** CI step passes;
- release-security acceptance passes;
- Product Eval passes;
- any workflow-specific acceptance triggered by the changed workflow files passes;
- guarded merge lands on `main`;
- canonical docs record closure.

No provider/model call, hosted spend, VPS/Cloudflare mutation, or W18 rerun is part of this scope.
