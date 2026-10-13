# ECORIONE — Codespaces full-runtime fix closure evidence

Date: **2026-10-13**

Status: **PASS — bounded development runtime acceptance**

## Scope

PR #464, `fix: make Codespaces start the full governed runtime`, fixes the initial development-profile startup mismatch without modifying production runtime ownership or Session 12D Google Drive acceptance.

## Cause and resolution

- Prior Codespaces wrapper used raw `pnpm dev`, which omitted Sandbox and did not perform canonical generated-secret startup.
- Switched `.devcontainer/start.sh` to canonical `pnpm engine:start`, using the existing Compose Temporal path and explicit Ai preview port 3000.
- After that change, Connect startup failed because a nonempty **example** localhost OAuth redirect with empty Google client ID/secret was misinterpreted as a partially enabled integration.
- Connect now treats the sample redirect alone as inert when neither a client ID nor a client secret exists. Partially supplied credentials remain fail-closed; configured OAuth still runs through the existing redirect validation schema.
- Added regression tests and clarified Codespaces/Google Drive configuration documentation.

## Exact-head repository checks

Reviewed runtime-fix code head before this evidence commit: `ce43e59a070926d347c2bbe36282c92464e7e545`.

- CI #2848: **PASS** (`verify`, `secret-history`, and `naming`).
- Product Eval #2087: **PASS**.
- `verify` covered formatting, lint, typecheck, test suite, Phase 4 real-process acceptance, production-operations acceptance, secret scan, security/policy reviews, release-security, and production build.

GitHub checks must also pass on the **final PR head including this documentation commit** before merge.

## Operator-observed Codespaces proof

Operator shared screenshots on 2026-10-13 from Codespace `probable carnival`, branch `fix/codespaces-full-runtime-20261008`, after fetching the latest branch and running:

```bash
bash .devcontainer/start.sh
```

Observed in terminal:

- `ECORIONE ready: http://127.0.0.1:3000`.
- Existing Temporal/Flow worker was running.
- Nonblocking CSS/autoprefixer and webpack cache warnings appeared; the app remained ready.

Observed in the browser at the forwarded **port 3000** `/ops` page:

- Fleet status **Healthy**.
- All eight required services **UP**: RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow.
- All eight required services showed zero request errors in the captured view.
- `sync` remained **OPTIONAL / DOWN** with `fetch failed`, which is excluded from the fleet's required-health decision.

The images were inspected during the operator-controlled conversation. This record summarizes the observed evidence; the screenshots are not themselves committed artifacts.

## Boundaries and non-claims

- Evidence is an operator-controlled GitHub Codespaces **development** runtime acceptance, not external staging, production, DR-2 independence, or durable storage acceptance.
- No real Google OAuth/Picker authorization was performed; Session 12D retains its separate real-local Google acceptance gate.
- No hosted-model credential or actual paid inference completion was proven.
- Observed browser status is a point-in-time health check, not a continuous uptime claim.
- Codespaces preview should stay Private outside brief deliberately authorized review; internal ports, Temporal, Vault, and databases must not be publicly forwarded.

## Accepted next step

Close PR #464 after final-head checks pass. Continue regular ECORIONE development/audit on `main` in Codespaces, while preserving all existing owner/service and production/staging boundaries.
