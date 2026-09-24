# ECORIONE — Staging Auto-Deploy Restore — 2026-09-24

Status: **SESSION 2 IN PROGRESS / CONTROLLED CONVERGENCE PASS / AUTO-DEPLOY ENABLE PENDING**

## Scope

This record follows the completed staging-capacity recovery session and covers only:

1. controlled convergence of SumoPod staging to current reviewed `main`;
2. restoration of the governed GitHub -> staging deployment path;
3. proof that the restored path revalidates or deploys the exact current reviewed SHA.

It does not authorize production promotion, DR-2 runtime work, or unrelated audit fixes.

## Preconditions

Session 1 closed with:

- recovered disk headroom;
- clean host checkout;
- current privileged deploy helper matching reviewed repository source;
- private edge fail-closed;
- authenticated Operations healthy;
- automatic staging deployment intentionally disabled.

Current reviewed main before controlled convergence:

`fad170645ba612b746453487dc97cc0e03cb05e7`

Required repository gates for that SHA passed:

- CI #1988 — PASS;
- Product Eval #1227 — PASS.

The Staging Deploy workflow gate also passed while its deploy job remained skipped because:

`ECORIONE_STAGING_CD_ENABLED=0`

## Controlled convergence — PASS

The operator invoked the reviewed privileged host deploy helper directly for exact current main:

`fad170645ba612b746453487dc97cc0e03cb05e7`

The helper accepted the target only after fetching current `origin/main`, confirmed the exact reviewed SHA, detached the host checkout to that SHA, and ran preflight/build/upgrade/validation.

Observed deployment identity:

- target SHA: `fad170645ba612b746453487dc97cc0e03cb05e7`;
- target image tag: `staging-fad170645ba6`;
- previous SHA: `b73e885d51e82716d5b29b3b31d207aae5ec95d0`;
- previous image tag: `staging-b73e885d51e8`.

The Docker build completed and the staging Compose project recreated the reviewed application services successfully.

## Public/private boundary validation

Post-deploy public smoke passed:

- unauthenticated `/` -> HTTP 302 to `/login`;
- `/login` -> HTTP 401 + Basic challenge;
- `/ops` -> HTTP 401 + Basic challenge;
- `/settings` -> HTTP 401 + Basic challenge;
- `/api/ops` -> HTTP 401 + Basic challenge;
- `/api/settings` -> HTTP 401 + Basic challenge;
- `/api/projects` -> HTTP 401 + Basic challenge;
- `/api/projects/history` -> HTTP 401 + Basic challenge;
- `/api/brain` -> HTTP 401 + Basic challenge;
- `/api/space/pages` -> HTTP 401 + Basic challenge;
- POST `/api/chat` -> HTTP 401 + Basic challenge;
- POST `/api/forget` -> HTTP 401 + Basic challenge;
- MCP protected-resource metadata -> HTTP 200;
- unauthenticated MCP -> HTTP 401 + resource-metadata challenge.

## Operations validation

Authenticated Operations passed:

- `healthy: true`;
- `serviceCount: 9`;
- `unhealthyServices: []`;
- `traceGroups: 8`.

## Exact host evidence

Post-deploy exact-host evidence passed:

- `headSha=fad170645ba612b746453487dc97cc0e03cb05e7`;
- `expectedSha=fad170645ba612b746453487dc97cc0e03cb05e7`;
- `expectedShaMatched=true`;
- branch: `DETACHED`;
- `cleanWorktree=true`;
- `availableDiskGiB=27.51`;
- all 15 configured staging services were running;
- `nonRunningServices=[]`;
- expected project volumes remained present;
- deployment env remained mode 0600, non-symlinked, with no placeholders.

The deploy helper emitted:

`PASS PCS-08 staging deploy sha=fad170645ba612b746453487dc97cc0e03cb05e7 tag=staging-fad170645ba6`

This proves controlled convergence to the reviewed current main.

## Remaining Session 2 step

Automatic staging deployment is not yet claimed restored.

Before Session 2 can close:

1. set repository variable `ECORIONE_STAGING_CD_ENABLED=1`;
2. trigger the governed `Staging Deploy` workflow against current `main`;
3. require gate PASS;
4. require deploy job PASS through the least-privilege SSH forced-command path;
5. require the helper to revalidate the already-recorded exact current main deployment;
6. verify the workflow is no longer skipping deploy because of the repository variable;
7. preserve the resulting workflow run as closure evidence.

Until those steps pass, automatic deployment remains deliberately disabled.

## Explicit non-claims

This checkpoint does not yet claim:

- GitHub -> staging auto-deploy is restored;
- production readiness;
- final multi-user authentication/RBAC;
- DR-2 physical independence;
- closure of remaining HIGH audit findings.

Those remain separately bounded.
