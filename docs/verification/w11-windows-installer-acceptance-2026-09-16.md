# W11 — Windows installer/launcher acceptance

Status: **DONE — WINDOWS INSTALLER VERIFIED**

Date: **2026-09-16**

Final verified runtime/release baseline: `8cb665ff25682e683b284c896ec3a2e77bf716ba` (`main`, PR #123 merged).

Final Setup artifact:

- `ECORIONE-Setup-0.1.0.exe`
- SHA-256: `ab3a9d11584f0b0073c2f30be374f7455cb39365a6c5b17fbb360bb59433187c`

Detailed final operator evidence: `docs/verification/w11-operator-attempt-5-closure-2026-09-16.md`.

## Scope

W11 is deliberately separate from W09/W10. W09/W10 proved the synchronized source-workstation engine path on real Windows. W11 proves that an end user can install and operate the packaged ECORIONE desktop surface without relying on the source checkout, host Node.js, host pnpm, or host Git.

Docker Desktop remains an explicit desktop prerequisite in the current product boundary. The installer does not silently install or configure Docker Desktop.

The source-workstation `pnpm engine:doctor` local generation canary may exceed its diagnostic timeout under normal unbounded local-model behavior. That is not a W11 blocker: W11 validates the packaged launcher/Doctor lifecycle and does not reopen W09/W10 or W17.

## Packaged release path

The verified desktop release path consists of:

- `scripts/desktop-bundle.mjs` — builds `ecorione:desktop`, exports `runtime/ecorione-image.tar`, writes `RELEASE-MANIFEST.json`, and writes `SHA256SUMS`;
- `desktop/installer.iss` — per-user Inno Setup package under `%LOCALAPPDATA%\Programs\ECORIONE`;
- `desktop/Start-ECORIONE.cmd`, `Doctor-ECORIONE.cmd`, and `Stop-ECORIONE.cmd` — user-facing launcher wrappers;
- `desktop/ecorione.ps1` — Docker prerequisite checks, first-run config, bundled image loading, collision-safe Ai port selection, start/doctor/stop/open behavior;
- `desktop/compose.yml` — packaged runtime topology;
- `scripts/windows-desktop-installer-acceptance.ps1` — fail-closed real-Windows end-user acceptance harness.

PR #123 additionally fixed the Context production runtime-asset contract so SQL migrations are copied into `dist/migrations`, and Docker production build now fails closed if the migration assets are absent.

## Acceptance matrix

### W11-A — real Setup install

**PASS.** The real Inno Setup executable installed into an isolated per-user directory and the installed bundle contained the launcher surface, compose file, release manifest, checksums, and bundled runtime image.

### W11-B — no host development-tool dependency

**PASS.** The harness hid host Node.js, pnpm, and Git while retaining Windows + Docker prerequisites. The installed launcher continued to operate.

### W11-C — installed Doctor before startup

**PASS.** Installed Doctor succeeded before first Start while accurately handling the not-yet-running packaged runtime.

### W11-D — first Start + bundled runtime load + collision-safe port

**PASS.** The fresh-state boundary contained no existing `ecorione-desktop` containers/networks/volumes and no cached `ecorione:desktop` image. First Start loaded the bundled image and brought up the full Compose fleet at fallback Ai port `17029`, proving the preferred-port collision path.

### W11-E — runtime Doctor + second Start reuse

**PASS.** Runtime Doctor succeeded and a second Start reused the existing desktop instance instead of creating a parallel stack.

### W11-F — Stop semantics

**PASS.** Stop removed runtime containers while retaining ECORIONE data volumes.

### W11-G — Doctor post-stop + uninstall

**PASS.** Installed Doctor remained usable after Stop and the Inno Setup uninstaller completed successfully.

## Final operator run

The operator synchronized local `main` to:

```text
8cb665ff25682e683b284c896ec3a2e77bf716ba
```

The Setup hash matched `SHA256SUMS` exactly:

```text
ab3a9d11584f0b0073c2f30be374f7455cb39365a6c5b17fbb360bb59433187c  ECORIONE-Setup-0.1.0.exe
```

The acceptance harness then returned:

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

Sanitized report path printed by the run:

```text
traces/w11-windows-installer-acceptance-2026-09-16T16-54-50-970Z.json
```

## Retained defect history

Earlier attempts remain part of the evidence trail rather than being erased. They surfaced real defects in the fresh-image probe, packaged launcher path, and Context production-image packaging. Attempt 4 failed because `/app/services/context/dist/migrations/` did not exist in the packaged production image. PR #123 corrected that build contract before the successful Attempt 5 artifact was produced.

Related records include:

- `docs/verification/w11-operator-attempt-3-2026-09-16.md`;
- `docs/verification/w11-operator-attempt-4-2026-09-16.md`;
- `docs/verification/w11-operator-attempt-5-closure-2026-09-16.md`.

## Closure boundary

W11 is **DONE — WINDOWS INSTALLER VERIFIED** because all closure requirements now exist simultaneously:

- merged packaging/launcher hardening and green post-merge checks;
- a real Setup executable built from the intended source revision;
- checksum verification supplied and matched;
- release manifest/source revision pinned to the intended baseline;
- W11-A through W11-G passed on real Windows;
- final marker `PASS W11 Windows installer/launcher acceptance` returned;
- fresh-install state proved that no existing desktop stack or cached `ecorione:desktop` image weakened the claim.

This closure applies to the exact release/source revision recorded above. Future packaged releases still require their own release validation. W18 hosted-economic validation remains separate and open.
