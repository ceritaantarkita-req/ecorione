# W11 operator attempt 5 — closure — 2026-09-16

Status: **PASS / W11 CLOSED — WINDOWS INSTALLER VERIFIED**

## Provenance

- source revision: `8cb665ff25682e683b284c896ec3a2e77bf716ba`
- release: `ECORIONE-Setup-0.1.0.exe`
- installer SHA-256: `ab3a9d11584f0b0073c2f30be374f7455cb39365a6c5b17fbb360bb59433187c`
- operator platform: real Windows PowerShell + Docker Desktop
- sanitized report path printed by the harness: `traces/w11-windows-installer-acceptance-2026-09-16T16-54-50-970Z.json`

The operator synchronized local `main` to the exact source revision, verified the Setup hash against `SHA256SUMS`, and confirmed the fresh-install boundary before execution:

```text
docker compose project containers: none
docker compose project networks: none
docker compose project volumes: none
ecorione:desktop cached image: none
```

This ensured the first packaged Start had to load the bundled desktop image rather than reuse a previous W11 runtime.

## Final operator result

The acceptance harness returned:

```text
[W11] Installer SHA-256 verified
[W11] Setup installed isolated end-user bundle
[W11] Host Node/pnpm/Git hidden; launcher limited to Windows + Docker prerequisites
[W11] Installed Doctor pre-start PASS
[W11] First Start PASS at fallback port 17029 with full compose fleet
[W11] Installed Doctor runtime PASS
[W11] Second Start reused existing desktop instance
[W11] Stop PASS; runtime containers removed and data volumes retained
[W11] Installed Doctor post-stop PASS
[W11] Uninstall PASS

PASS W11 Windows installer/launcher acceptance
```

## Gate disposition

- W11-A real Setup install: **PASS**
- W11-B no host Node/pnpm/Git dependency: **PASS**
- W11-C installed Doctor pre-start: **PASS**
- W11-D first Start + bundled runtime load + collision-safe port: **PASS**
- W11-E runtime Doctor + second Start reuse: **PASS**
- W11-F Stop semantics / retained data volumes: **PASS**
- W11-G post-stop Doctor + uninstall: **PASS**

The fallback port `17029` proves the preferred-port collision path remained functional in the packaged launcher. The full Compose fleet started successfully, including Context after the production migration-asset packaging fix merged through PR #123.

## Defect history retained

Earlier W11 attempts were not hidden or reclassified. They identified real issues in sequence, including fresh-image probing, packaged launcher behavior, and the Context production-image migration asset omission. Attempt 4 specifically failed because `services/context/dist/migrations/` was absent from the packaged image. PR #123 fixed the root build/runtime-asset contract and added a fail-closed Docker build guard.

## Closure boundary

W11 is now **DONE — WINDOWS INSTALLER VERIFIED** for the exact release/source revision above. This evidence establishes the packaged Windows installer/launcher path under the current Docker Desktop prerequisite. It does not change W18 hosted-economic evidence requirements and does not create a universal claim for other future release revisions without their own release validation.
