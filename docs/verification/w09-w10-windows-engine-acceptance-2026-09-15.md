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
- no existing ECORIONE fixed owner stack occupying `17021–17028`; the preferred Ai port may be occupied by an unrelated application because startup must auto-fallback safely;
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
| W09-B | cold one-command startup | `pnpm engine:start` reaches an exact ready marker on the resolved Ai port and all eight required Phase 4 owner health endpoints |
| W10-B | doctor while running | Temporal, Ai, RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow all report healthy |
| W09-C | duplicate-start guard | second `pnpm engine:start` detects the already-running ECORIONE Ai identity and fails non-zero without starting another stack |
| W09-D | Windows cleanup | acceptance-owned process tree is terminated and the resolved Ai port plus `17021–17028` are released; unrelated processes on the preferred Ai port are outside cleanup ownership; acceptance-owned Temporal CLI is also stopped |
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


## Operator rerun blocker 2 — Windows cleanup race

The first rerun after the pnpm doctor fix used synchronized `main` at `840814b66ce1ea326b627b970d7002edd599d4a9`. The operator evidence reached W09-B READY, W10-B healthy for the full application fleet, and W09-C duplicate-start fail-closed. Local AI was recorded as `UNAVAILABLE`, which is intentionally outside the core W09/W10 boot gate.

W09-D then failed because Windows `taskkill /T /F` returned exit `255` while one descendant had already exited (`There is no running instance of the task`). This is a process-tree shutdown race in the acceptance harness, not evidence that the ECORIONE runtime failed to boot. The same run also still emitted Node `DEP0190` because the harness itself used `shell: true` for pnpm, even though the engine helper had already been hardened.

Disposition: the harness now reuses the hardened pnpm command resolver and treats `taskkill` status as diagnostic rather than as the sole cleanup verdict. W09-D only passes after the engine root process has exited, every ECORIONE application port is closed, and acceptance-owned Temporal is closed. A non-zero `taskkill` code is retained in the sanitized report and may be tolerated only when those independent shutdown checks pass. W09/W10 remain open until a fresh current-main Windows run reaches the final PASS marker.


## Operator rerun blocker 3 — fixed port collision

The next synchronized Windows rerun used `main` at `b1b3280795fdab95f99f5baa2ff05ea1fd057c42` and stopped in preflight because TCP port `3000` was already occupied by another local application. Port 3000 is a common developer port, so ECORIONE must not require users to stop unrelated software.

Disposition: `ECORIONE_AI_PORT` is now a preferred port rather than a fixed host-port claim. New installs default to `17020`; source startup falls back through `17029–17039` when the preferred port belongs to another application. Ports `17021–17028` remain reserved for the fixed owner fleet and are never selected as Ai fallbacks. The resolved endpoint is stored under gitignored `.ecorione/runtime/engine.json`, allowing doctor and UX evidence to follow the same active URL. Existing ECORIONE instances remain duplicate-start blockers, while unrelated listeners are never killed. Desktop packaging uses a dynamic loopback host port while keeping its container-internal Ai endpoint on port 3000.

One fresh merged-main Windows acceptance run is still required before W09/W10 may close.


## Operator rerun blocker 3 — selected port was not propagated to Next.js

The current-main Windows rerun at `c9e017217533230bbd427057fc1aa0eb6fdde7ab` exposed two remaining integration gaps after the collision-safe port refactor. The operator's historical ignored `.env` still carried the former generated default `ECORIONE_AI_PORT=3000`, and `apps/ai/package.json` still invoked `next dev -p 3000` / `next start -p 3000`, which overrides the engine-selected `PORT`. The engine then declared TCP readiness before Next.js had finished serving the ECORIONE page, so an immediate runtime doctor could miss the Ai identity marker.

Disposition: source startup now performs a one-time migration of the historical generated `3000` default to `17020` while preserving later explicit overrides; the Ai package scripts no longer hardcode a CLI port and therefore honor the selected `PORT`; engine readiness waits for the ECORIONE HTTP identity, not only an open TCP socket; and the Windows acceptance protects port `3000` with a foreign listener (or preserves an existing listener) throughout start and cleanup so regressions cannot silently reintroduce a dependency on that common development port. W09/W10 remain open until a fresh exact-current-main Windows run reaches the final PASS marker.


## Operator rerun blocker 4 — protected-port sentinel socket reset

The exact-current-main Windows rerun at `7b9c49d93fa64051bd6ce8abc0e05f01281f116f` aborted before W09-A with an unhandled `read ECONNRESET`. The newly added foreign listener on port 3000 wrote a small payload to every probe connection, while ECORIONE's reachability probe intentionally connects and closes immediately. On Windows/Node 24 that close can surface as a socket-level reset; because the sentinel connection had no `error` listener, Node treated the expected reset as an uncaught event and terminated the acceptance process.

Disposition: the protected-port sentinel is protocol-free, writes no payload, and explicitly absorbs connection-level reset errors on its disposable accepted sockets. A regression test opens the sentinel on an ephemeral loopback port, immediately resets the client connection, and verifies that the server remains listening. W09/W10 remain open until a fresh merged-main Windows run reaches the final PASS marker.
