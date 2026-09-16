# W11 operator attempt 3 — 2026-09-16

Status: FAIL / defect identified.

The rebuilt installer from source revision `dcf12762c6a3466e0d2beadcbadc27179072c347` passed:

- installer SHA-256 verification;
- isolated Setup installation;
- host Node/pnpm/Git isolation;
- installed Doctor pre-start.

The first Start then failed as soon as Docker Compose emitted normal progress on stderr:

`Network ecorione-desktop_internal Creating`

Root cause: the packaged PowerShell launcher runs with `$ErrorActionPreference = "Stop"`; native `docker compose up -d` progress written to stderr can therefore surface as a terminating PowerShell error even when Docker has not returned a failing exit code.

Disposition: `Invoke-Compose` must tolerate native Compose progress stderr, restore the caller error preference afterwards, and continue to fail closed on the actual Docker process exit code. The Setup artifact must be rebuilt because the launcher is embedded in the installer.

Regression coverage now locks the native Compose stderr handling so normal progress output cannot silently reintroduce this Windows PowerShell failure mode.
