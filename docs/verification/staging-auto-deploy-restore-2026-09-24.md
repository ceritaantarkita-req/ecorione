# ECORIONE — Staging Auto-Deploy Restore — 2026-09-24

Status: **SESSION 2 IN PROGRESS / CONTROLLED CONVERGENCE PASS / AUTO-DEPLOY ENABLED / AUTOMATIC WORKFLOW_RUN PROOF PENDING**

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

## Auto-deploy enablement and least-privilege path — PASS

Repository variable:

`ECORIONE_STAGING_CD_ENABLED=1`

was restored by the operator and read back as `1`.

A governed manual `workflow_dispatch` of Staging Deploy then executed as run `35999280717` / run number `743`.

Results:

- workflow conclusion: `success`;
- gate job: PASS;
- deploy job: PASS, not skipped;
- least-privilege SSH identity installation: PASS;
- exact reviewed main deploy command: PASS.

The restricted host helper recognized the exact current SHA as already recorded and performed full revalidation rather than rebuilding unnecessarily:

`Revalidating already-recorded staging deployment sha=fad170645ba612b746453487dc97cc0e03cb05e7 tag=staging-fad170645ba6`

The revalidation again passed private-edge smoke, MCP/OAuth behavior, authenticated Operations, exact-host identity, all 15 configured services, and `availableDiskGiB=27.51`.

The workflow ended with:

`PASS PCS-08 staging deploy already recorded and revalidated sha=fad170645ba612b746453487dc97cc0e03cb05e7`

This proves the repository variable is active and the governed least-privilege GitHub -> host deploy path is functional.

## Remaining Session 2 proof

One final automatic-path proof remains before Session 2 is declared CLOSED:

1. merge this checkpoint PR to create a new reviewed `main` SHA;
2. require CI and Product Eval PASS on that merged main;
3. require the `workflow_run`-triggered Staging Deploy gate to PASS;
4. require its deploy job to execute, not skip, with `ECORIONE_STAGING_CD_ENABLED=1`;
5. require exact-host/private-edge/Ops validation PASS for that new main SHA;
6. record that automatic run in the final closure.

Until that proof is captured, the least-privilege path is restored and enabled, but end-to-end automatic post-merge behavior is not yet the final closure claim.

## Explicit non-claims

This checkpoint does not yet claim:

- GitHub -> staging auto-deploy is restored;
- production readiness;
- final multi-user authentication/RBAC;
- DR-2 physical independence;
- closure of remaining HIGH audit findings.

Those remain separately bounded.
