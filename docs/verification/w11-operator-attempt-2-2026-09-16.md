# W11 operator attempt 2 — packaged Doctor image probe defect

Date: **2026-09-16**

Status: **FAILED BEFORE FIRST START / REBUILD REQUIRED**

The second real Windows W11 attempt used the checksum-verified `ECORIONE-Setup-0.1.0.exe` whose `RELEASE-MANIFEST.sourceRevision` is pinned to `d6b2f7f58f5a6af26e91ee026536e39fcf11d227`.

The harness-side fresh-image probe defect from attempt 1 was already fixed: checksum verification passed, Setup installed the isolated end-user bundle, and the acceptance PATH successfully hid host Node.js, pnpm, and Git while preserving Docker.

The run then failed in the installed `Doctor-ECORIONE.cmd` before first Start. Root cause was the packaged `desktop/ecorione.ps1` helper `Test-DockerImage`, which used `docker image inspect <image>` while `$ErrorActionPreference = "Stop"`. On a true fresh install, Docker's expected `No such image: ecorione:desktop` stderr became a terminating PowerShell error instead of the intended `false` result.

The packaged launcher now probes image presence with `docker image ls --quiet --filter reference=<image>`, treats an empty result as the normal first-start state, and still fails closed if the image-list command itself fails. A regression test prevents the raw `docker image inspect` probe from returning.

Because `desktop/ecorione.ps1` is embedded inside the installer bundle, the `d6b2f7f...` Setup artifact cannot be used for W11 closure after this fix. A new Setup artifact must be built from the merged launcher-fix revision, with a new checksum and exact `RELEASE-MANIFEST.sourceRevision`, before the next real Windows acceptance attempt.
