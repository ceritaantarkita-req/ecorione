# Latest-main staging convergence checkpoint 1 — 2026-09-21

Status: **ACTIVE / SOURCE GATES GREEN / DEPLOYMENT NOT YET PROVEN**

## Scope

The operator explicitly resumed ECORIONE work after post-closure maintenance checkpoint 5. This opens one bounded operational scope: converge the latest reviewed GitHub `main` revision onto the already-proven SumoPod staging environment using the existing PCS-08 governed deployment path.

This is **not** PE-09, PCS-11, Batch 13, a production-promotion scope, Cloudflare/public-edge activation, paid-provider evidence, or a new product feature batch.

## Target source revision

```text
main: de8d5d510d07ce06ece21368e4305148a2b587c9
```

Exact-main repository gates are green:

```text
CI            #1750 PASS   run 35622583550
Product Eval  #989  PASS   run 35622583553
```

## Staging-deploy observation

The exact target SHA triggered the existing Staging Deploy workflow twice, once from each required peer gate:

```text
Staging Deploy #277 / run 35622676214  gate PASS  deploy SKIPPED
Staging Deploy #278 / run 35622933910  gate PASS  deploy SKIPPED
```

The workflow source requires both an exact-current-main green gate and repository variable `ECORIONE_STAGING_CD_ENABLED == 1` before the deploy job can run. Because the gate job succeeded while the deploy job was skipped, this checkpoint does **not** claim a runtime mutation.

## Runtime claim boundary

The latest proven SumoPod staging runtime remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

A successful governed deploy plus runtime verification is required before that claim changes.

## Acceptance required to close this scope

1. deploy the exact then-current reviewed `main` SHA through the existing Staging Deploy workflow;
2. require the workflow's public HTTPS smoke to pass;
3. require authenticated `/api/ops` health to pass;
4. require sanitized exact-host evidence to match the deployed SHA/image;
5. require the release receipt to match the deployed revision;
6. preserve rollback behavior and existing PCS-08/09 security boundaries;
7. update canonical current-state, active-work, documentation-map, and verification docs with the proven runtime revision.

Until all seven are evidenced, this scope remains **ACTIVE** and staging must not be described as running the latest `main`.
