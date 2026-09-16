# W11 — Windows installer/launcher acceptance

Status: **HARNESS READY / REAL INSTALLER RUN PENDING**

Date: **2026-09-16**

Current handoff baseline before W11 execution: `62e0d4b64b41cfa0b3038461bc376d67b1a2cbb8` (`main`, PR #117 merged; post-merge CI #922 and Product Eval #161 SUCCESS).

## Scope

W11 is deliberately separate from W09/W10. W09/W10 proved the synchronized source-workstation engine path on real Windows. W11 must prove that an end user can install and operate the packaged ECORIONE desktop surface without relying on the source checkout, host Node.js, host pnpm, or host Git.

Docker Desktop remains an explicit desktop prerequisite in the current product boundary. The installer does not silently install or configure Docker Desktop.

The post-W17 source-workstation `pnpm engine:doctor` local generation canary can exceed its current 20-second diagnostic timeout after benchmark-only generation limits are removed. That behavior is explicitly **not** a W11 blocker: W11 validates the packaged launcher surface and uses the packaged Doctor behavior defined below. It also does not reopen W09/W10 or W17.

## Repository-side packaging already present

The desktop release path consists of:

- `scripts/desktop-bundle.mjs` — builds `ecorione:desktop`, exports `runtime/ecorione-image.tar`, writes `RELEASE-MANIFEST.json`, and writes `SHA256SUMS`;
- `desktop/installer.iss` — per-user Inno Setup package under `%LOCALAPPDATA%\Programs\ECORIONE`;
- `desktop/Start-ECORIONE.cmd`, `Doctor-ECORIONE.cmd`, and `Stop-ECORIONE.cmd` — user-facing launcher wrappers;
- `desktop/ecorione.ps1` — Docker prerequisite checks, first-run config, bundled image loading, collision-safe Ai port selection, start/doctor/stop/open behavior;
- `desktop/compose.yml` — packaged runtime topology;
- `.github/workflows/desktop-installer.yml` — explicit manual release workflow that builds the Linux Docker runtime bundle and compiles the Windows Setup executable with Inno Setup.

Repo-side packaging tests remain part of normal Vitest/CI.

## W11 acceptance harness

`scripts/windows-desktop-installer-acceptance.ps1` accepts a real `ECORIONE-Setup-*.exe` and performs an isolated end-user-style install. It writes only sanitized phase/result metadata to `traces/w11-windows-installer-acceptance-*.json`.

The harness is fail-closed around fresh-install evidence:

1. Windows is required.
2. Docker Desktop CLI, engine, and Compose must be reachable.
3. No existing `ecorione-desktop` compose containers may exist.
4. `ecorione:desktop` must not already exist, so first Start must prove loading the bundled `runtime/ecorione-image.tar` rather than reusing a developer cache.
5. When `SHA256SUMS` is supplied, the Setup executable hash must match.
6. When `-ExpectedSourceRevision` is supplied, installed `RELEASE-MANIFEST.json` must match that exact source revision.

## Acceptance matrix

### W11-A — real Setup install

Pass when the real Inno Setup executable installs into an isolated per-user directory and the installed bundle contains the launcher wrappers, PowerShell launcher, compose file, release manifest, checksums, and bundled runtime image tar.

### W11-B — no host development-tool dependency

The harness temporarily sanitizes `PATH` so host Node.js, pnpm, and Git are not visible while Docker remains visible. Installed launcher behavior must continue to work in that boundary.

### W11-C — installed Doctor before startup

`Doctor-ECORIONE.cmd` must return success when Docker Desktop + Compose are reachable, while accurately reporting that Ai is not running yet. The wrapper preserves the PowerShell doctor exit code and supports noninteractive acceptance without changing normal double-click behavior.

### W11-D — first Start + bundled runtime load + collision-safe port

The harness protects preferred port `17020` with a foreign listener. `Start-ECORIONE.cmd` must:

- create isolated `%LOCALAPPDATA%\ECORIONE\desktop.env`;
- choose a fallback in `17029–17039`;
- preserve the foreign listener;
- load `ecorione:desktop` from the installed runtime tar;
- bring the packaged compose fleet up;
- make Ai reachable on the resolved fallback port.

The launcher supports `ECORIONE_DESKTOP_NO_OPEN=1` only for automation; ordinary double-click Start still opens ECORIONE in the browser.

### W11-E — runtime Doctor + second Start reuse

While running, Doctor must follow the resolved Ai port. A second Start must recognize the existing desktop stack, keep the same port, and not create a parallel instance.

### W11-F — Stop semantics

`Stop-ECORIONE.cmd` must remove runtime containers, release the resolved Ai port, preserve the protected foreign listener, and retain ECORIONE data volumes. It must not use destructive `down -v` behavior.

### W11-G — Doctor post-stop + uninstall

Doctor must remain usable after Stop and report Ai stopped. The real Inno Setup uninstaller must then remove the installed launcher surface successfully. User data retention is recorded rather than silently destroyed.

## Execution order from the current handoff

1. Build a real Setup artifact from the exact intended merged source revision.
2. Retain the generated `SHA256SUMS` alongside the Setup executable.
3. Confirm Docker Desktop is reachable on the real Windows operator machine.
4. Run the isolated acceptance harness with both checksum and exact expected source revision supplied.
5. Treat any harness failure as a real W11 defect unless the failure is an explicitly external prerequisite failure (for example Docker Desktop unavailable).
6. Close W11 only after the sanitized report records `result: "PASS"`.

## Operator command

After a Setup artifact and its checksum file are available locally, run from synchronized source `main`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-desktop-installer-acceptance.ps1 `
  -InstallerPath "C:\path\to\ECORIONE-Setup-0.1.0.exe" `
  -ChecksumPath "C:\path\to\SHA256SUMS" `
  -ExpectedSourceRevision "<release source revision>"
```

Expected final marker:

```text
PASS W11 Windows installer/launcher acceptance
```

The generated sanitized report path is printed immediately afterwards.

## Closure boundary

W11 may become **DONE — WINDOWS INSTALLER VERIFIED** only when all of the following are true:

- the W11 harness/launcher hardening is merged and exact post-merge CI + Product Eval are green;
- a real Setup executable built from the intended merged source revision is used;
- checksum verification is supplied for closure evidence, not skipped;
- `RELEASE-MANIFEST.json` matches the exact expected source revision;
- W11-A through W11-G pass on real Windows;
- final output is `PASS W11 Windows installer/launcher acceptance`;
- generated sanitized report has `result: "PASS"`;
- no existing desktop instance or cached `ecorione:desktop` image was reused to weaken the fresh-install claim.

Until that operator run exists, W11 remains **STARTED — HARNESS READY / REAL INSTALLER RUN PENDING**.
