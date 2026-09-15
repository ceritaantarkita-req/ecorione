# W09/W10 — Windows engine acceptance

Date: **2026-09-15**

Status: **HARNESS READY / OPERATOR RUN PENDING**

Scope:

- W09 — one-command full local source-runtime startup;
- W10 — `ecorione doctor` / `pnpm engine:doctor` diagnostics;
- Windows source-workstation acceptance only.

W11 remains the separate end-user installer/launcher acceptance. W09/W10 do **not** claim that a brand-new Windows machine can launch ECORIONE without source-development prerequisites.

## Closure boundary

For W09/W10, “clean Windows” means a synchronized source checkout on Windows with:

- Node.js `>=22`;
- pnpm available;
- repository dependencies already installed;
- either Temporal already reachable, Temporal CLI installed for the default path, or the explicit Docker Temporal mode configured with Docker reachable;
- no existing ECORIONE application stack occupying ports `3000` or `17021–17028`;
- clean tracked worktree and exact `HEAD == origin/main`.

The acceptance harness never prints `ECORIONE_INTERNAL_TOKEN` or Vault secrets. It forces `ECORIONE_COST_KILL_SWITCH=1` and `ECORIONE_ENGINE_NO_OPEN=1` in the child environment.

Local-model availability is intentionally recorded separately from the core engine boot gate. W09 requires the ECORIONE application fleet and Ai surface to become ready; immutable local-model/runtime proof is already governed separately by W13/W15.

## Canonical command

After this harness is merged to `main`, run from PowerShell in the repository root:

```powershell
node scripts/windows-engine-acceptance.mjs
```

For a non-mutating description of the matrix on any platform:

```powershell
node scripts/windows-engine-acceptance.mjs --plan
```

The real run writes a sanitized JSON report under:

```text
traces/w09-w10-windows-acceptance-<timestamp>.json
```

Raw report data stays local until reviewed. Commit only sanitized closure findings; never commit `.env` or secrets.

## Acceptance matrix

| ID | Check | Required result |
|---|---|---|
| W09-A | current-main preflight | Windows; clean tracked worktree; `HEAD == origin/main`; Node >=22; pnpm available; valid Temporal launch/reuse path |
| W10-A | doctor before startup | doctor completes and describes prerequisite + stopped/degraded runtime state without exposing secrets |
| W09-B | cold one-command startup | `pnpm engine:start` reaches exact ready marker, Ai port 3000, and all eight required Phase 4 owner health endpoints |
| W10-B | doctor while running | Temporal, Ai, RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow all report healthy |
| W09-C | duplicate-start guard | second `pnpm engine:start` fails non-zero with the actionable occupied-port-3000 message |
| W09-D | Windows cleanup | acceptance-owned process tree is terminated and application ports `3000`, `17021–17028` are released; acceptance-owned Temporal CLI is also stopped |
| W10-C | doctor after shutdown | doctor remains usable and reports the stopped runtime state rather than crashing |

If Temporal was already reachable before the matrix, the harness treats it as externally owned and must leave it running after cleanup.

## Automated repository evidence

Repository tests cover the platform-independent contract of the harness:

- all seven W09/W10 phases remain present;
- runtime doctor acceptance requires Temporal, Ai, and every required Phase 4 owner;
- missing a required owner fails the readiness contract;
- Local AI availability is recorded separately instead of being silently conflated with full-stack process readiness.

The real Windows process behavior cannot be closed by Linux GitHub Actions alone. CI proves syntax/contracts; the operator run supplies the remaining platform evidence.

## First operator run — blocker found

The first synchronized Windows run was executed on exact `main` commit `7380bb83073648717370b92901279652602f6692` with Node `24.19.0`. W09-A preflight passed, but W10-A failed because `engine:doctor` printed `pnpm tidak tersedia` even though pnpm was installed and had launched the command.

Root cause: the doctor path resolved pnpm to `pnpm.cmd` and passed that `.cmd` file directly to `spawnSync`. Modern Node on Windows rejects direct `.cmd` spawning on the hardened child-process path. The fix routes trusted Windows pnpm invocations through explicit `cmd.exe /d /s /c`, keeps non-Windows invocation direct, and rejects unsafe shell metacharacters before interpolation. The acceptance matrix must be rerun after the fix is merged; the original failure remains evidence of a real Windows defect, not an operator-setup failure.

The failed run wrote a sanitized local report under `traces/w09-w10-windows-acceptance-2026-09-15T15-53-16-778Z.json`. That raw report remains operator-local and is not committed because closure evidence should only record sanitized findings.

## Closure rule

W09 and W10 may be marked **DONE — WINDOWS RUNTIME VERIFIED** only when all of the following are true:

1. harness PR is merged and exact post-merge `main` CI + Product Eval are green;
2. operator synchronizes to that exact current `origin/main`;
3. `node scripts/windows-engine-acceptance.mjs` finishes with `PASS W09/W10 Windows engine acceptance`;
4. generated report has `result: "PASS"`;
5. no orphan ECORIONE process/application port remains after cleanup;
6. sanitized result is recorded in canonical docs.

Any harness failure remains a W09/W10 blocker until reproduced, fixed or explicitly scoped out with evidence.
