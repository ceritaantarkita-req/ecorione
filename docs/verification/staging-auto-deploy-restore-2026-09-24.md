# ECORIONE — Staging Auto-Deploy Restore — 2026-09-24

Status: **SESSION 2 IN PROGRESS / OPS-READINESS FIX MERGED / HELPER REFRESHED / CONTROLLED CONVERGENCE PASS / FINAL AUTOMATIC PROOF PENDING**

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

## Automatic workflow_run attempt — FAILED SAFE / rollback PASS

PR #301 merged as current main:

`a12094a45ee15339f4005e33bb30c2d27dc205bc`

Merged-main gates passed:

- CI #1992 — PASS;
- Product Eval #1231 — PASS.

The first workflow-run trigger after Product Eval completed before CI and therefore correctly produced a gate-only Staging Deploy run with deploy skipped.

After CI completed, automatic Staging Deploy run `36000222819` / #751 started for exact main `a12094a45ee15339f4005e33bb30c2d27dc205bc`. The gate passed and the deploy job executed through the restricted SSH path.

The image build and container recreation succeeded, and public/private boundary smoke passed. However the first authenticated Operations snapshot was taken immediately after startup and reported only `space` unhealthy:

- `healthy: false`;
- `serviceCount: 9`;
- `unhealthyServices: ["space"]`.

The deploy helper therefore correctly refused to record the release and rolled the runtime back to known-good `fad170645ba612b746453487dc97cc0e03cb05e7` / `staging-fad170645ba6`. Basic public-boundary rollback verification passed.

Because the new main is documentation-only relative to the previously healthy application runtime and the failing service had only just started, this is treated as an operations-readiness race in the deployment acceptance path, not as authorization to ignore health failures.

## Bounded fix in progress

The governed deploy helper now adds a bounded authenticated Operations readiness loop:

- up to 20 attempts;
- 3 seconds between attempts;
- every attempt still runs the canonical `production-ops-snapshot.mjs`;
- success requires the full snapshot to be healthy;
- timeout still fails the deployment and triggers rollback.

This preserves fail-closed behavior while avoiding rollback on a single transient post-startup health sample.

The source contract test now requires this bounded readiness loop. The installed privileged helper must be refreshed from the reviewed merged fix before Session 2 resumes automatic deployment proof.

## Ops-readiness fix convergence — PASS

PR #302 merged as reviewed main:

`bd31ab7d64c0579f752fb225ed78b1dab94eed2a`

Before merging, automatic CD was intentionally disabled again to prevent the still-installed pre-fix privileged helper from handling the new SHA.

The installed privileged deploy helper was then refreshed directly from exact reviewed main. SHA-256 matched between repository source and `/usr/local/sbin/ecorione-staging-deploy`:

`1342ee0cc45f8b1d385f20200867b0adf76a5d69c64af1656ff007cc1df8b4f3`

Controlled convergence of exact main `bd31ab7d64c0579f752fb225ed78b1dab94eed2a` then passed.

Observed release identity:

- current SHA: `bd31ab7d64c0579f752fb225ed78b1dab94eed2a`;
- current tag: `staging-bd31ab7d64c0`;
- previous known-good SHA: `fad170645ba612b746453487dc97cc0e03cb05e7`;
- previous tag: `staging-fad170645ba6`.

Validation passed:

- public auth bootstrap and all representative private Ai routes;
- MCP protected-resource metadata and unauthenticated OAuth challenge;
- authenticated Operations: `healthy: true`, `serviceCount: 9`, `unhealthyServices: []`;
- bounded readiness path emitted `Operations healthy on attempt 1/20`;
- exact host evidence: `expectedShaMatched=true`, `cleanWorktree=true`;
- all 15 configured services running;
- `nonRunningServices=[]`;
- `availableDiskGiB=22.66`;
- deployment env mode 0600, non-symlinked, no placeholders.

The helper emitted:

`PASS PCS-08 staging deploy sha=bd31ab7d64c0579f752fb225ed78b1dab94eed2a tag=staging-bd31ab7d64c0`

This proves the bounded Operations-readiness fix is installed and the current reviewed main is healthy on staging.

## Final Session 2 proof pending

Automatic CD remains temporarily disabled while this final proof checkpoint is prepared.

The only remaining Session 2 proof is:

1. keep only the current and recorded rollback ECORIONE images if disk headroom needs widening;
2. set `ECORIONE_STAGING_CD_ENABLED=1`;
3. merge this docs-only checkpoint to create one new reviewed main SHA;
4. require merged-main CI and Product Eval PASS;
5. require the automatic `workflow_run` Staging Deploy to execute its deploy job rather than skip;
6. require the refreshed helper to pass private-edge smoke, bounded Operations health, exact-host identity, and release receipt for that exact new main;
7. record that run and close Session 2.

## Explicit non-claims

This checkpoint does not yet claim:

- GitHub -> staging auto-deploy is restored;
- production readiness;
- final multi-user authentication/RBAC;
- DR-2 physical independence;
- closure of remaining HIGH audit findings.

Those remain separately bounded.
