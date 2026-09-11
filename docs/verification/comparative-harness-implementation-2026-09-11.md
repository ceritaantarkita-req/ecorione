# Comparative ECX harness implementation verification — 2026-09-11

Status: **PASS / HARNESS IMPLEMENTATION CLOSED; REAL GEMMA COMPARATIVE EVIDENCE PENDING**

This note closes only the repository implementation/harness portion of the Comparative ECX workstream. It does **not** close the comparative efficiency evidence itself.

## Scope

Merged implementation:

- PR #38 — `rnd: add comparative ECX evidence harness`
- squash merge on `main`: `c1849cd0c67712e40ea4e5c90587283900859cdb`
- final verified PR head: `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`

The merged scope adds:

- `scripts/comparative-evidence.mjs`;
- `test/comparative-evidence.test.mjs`;
- root `evidence:comparative` and `evidence:comparative:smoke` commands;
- `docs/comparative-ecx-evidence.md` protocol;
- reconciled local-first execution order and operator-deferred VPS/Cloudflare status across current docs.

## Benchmark boundary

Three paired lanes are implemented:

1. `full-inline` — full synthetic fixture context sent directly to the same local model;
2. `ecx-all` — real Artifact refs -> Hub ECX plan -> hydrate all refs -> same semantic document set;
3. `ecx-selective-oracle` — same ECX packet but only fixture-declared relevant refs are hydrated.

The third lane is explicitly an **oracle** control. Current ECX hydration receives caller-supplied `refIndexes`; this implementation does not prove an autonomous semantic reference selector.

## Repository verification

Final PR-head evidence at `d3f1cbf4d0acbb2c92f340b952f2c42e6c9bef4a`:

- CI `34557147546`: **PASS**
  - Naming
  - Format
  - Lint
  - Typecheck
  - Test
  - Phase 4 real-process acceptance
  - Production Operations acceptance
  - Secret Scan
  - Production Build
- MCP External HTTPS Acceptance `34557147583`: **PASS**

Two implementation hygiene defects were found and fixed before the final head:

- Prettier differences in the new harness and regression test;
- Node `performance` was used without an explicit Node import under the repository ESLint environment. The final script imports `performance` from `node:perf_hooks`.

Temporary formatter/lint-fixer workflows were removed before the final verified tree. They are not present in the merged PR diff.

## Merge and post-merge verification

PR #38 was squash-merged with expected-head protection as:

`c1849cd0c67712e40ea4e5c90587283900859cdb`

Post-merge `main` evidence on that exact SHA:

- CI `34557297702`: **PASS** all repository gates;
- MCP External HTTPS Acceptance `34557297803`: **PASS**.

## What is now closed

Closed:

- comparative harness implementation;
- deterministic helper/gate regression coverage;
- repository formatting/lint/type/build/release gates;
- documentation reconciliation for the local-first execution direction;
- merge + post-merge verification.

Still pending:

- synchronize the operator laptop to `c1849cd0c67712e40ea4e5c90587283900859cdb` or the later docs-only closure SHA;
- run `pnpm evidence:comparative:smoke` against the real Phase 4 + Gemma runtime;
- inspect/fix any runtime defect;
- run the 5× paired closure-grade benchmark;
- create a sanitized measured-result verification note;
- update current state with the actual benchmark verdict.

## Claim boundary

This verification proves that the comparative harness is implemented, tested, merged, and repository-verified. It does **not** prove that ECX reduces tokens/latency in real local traffic, does not prove automatic selection, does not prove universal optimizer effectiveness, and does not establish hosted-provider cost savings.

Protocol for the next checkpoint: `docs/comparative-ecx-evidence.md`.
