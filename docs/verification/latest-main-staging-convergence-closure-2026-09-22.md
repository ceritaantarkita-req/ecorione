# Latest-main staging convergence closure — 2026-09-22

Status: **CLOSED / PASS AT STAGING RUNTIME BOUNDARY**

## Scope

This closes the bounded operational scope that was opened after post-closure maintenance checkpoint 5 to converge the latest reviewed GitHub `main` onto the already-proven SumoPod staging environment through the existing PCS-08 governed deployment path.

This closure does **not** open PE-09, PCS-11, Batch 13, production promotion, Cloudflare/public-edge activation, paid-provider evidence, or a new product feature batch.

## Reviewed source and repository gates

The deployed source revision is:

```text
52046db35e403babdda934881773c46bf2c57b68
```

That revision is the merge of PR #248. PR #248 exact head `86a72f61373132778c724cac35c44899151a52b9` passed Product Eval #995 and CI #1756 on rerun attempt 2. The first CI #1756 attempt had one Temporal restart acceptance timeout after 1089 tests passed; rerun attempt 2 passed the full CI path, so the failed attempt is preserved as transient evidence rather than rewritten.

## Governed staging deployment

After the operator explicitly set repository variable `ECORIONE_STAGING_CD_ENABLED=1`, Staging Deploy #293 / run `35627920447` was rerun against exact current `main`.

Both jobs passed:

```text
gate    PASS
deploy  PASS
```

The deploy orchestrator recorded:

```text
target_sha:    52046db35e403babdda934881773c46bf2c57b68
target_tag:    staging-52046db35e40
previous_sha:  0f332c73dc7b363bffecdeecae921d805d5ae131
previous_tag:  staging-0f332c73dc7b
```

## Post-deploy acceptance

The runtime readiness loop observed temporary startup `502` responses for the public home while containers were coming up. Attempt 5 reached the required boundary and all reviewed post-deploy gates then passed:

- public home — HTTP 200;
- `/ops` protected — HTTP 401;
- `/settings` protected — HTTP 401;
- MCP protected-resource metadata — HTTP 200;
- MCP unauthenticated challenge — HTTP 401 with `resource_metadata`;
- authenticated operations snapshot — `healthy: true`, `unhealthyServices: []`;
- sanitized exact-host evidence — `headSha == expectedSha == 52046db35e403babdda934881773c46bf2c57b68`;
- final PCS-08 staging deployment assertion — PASS for `staging-52046db35e40`.

The reviewed host orchestrator writes the non-secret release state file `/var/lib/ecorione-staging/deploy-state.env` only after public smoke, authenticated Ops, and exact-host validation succeed, and emits the final `PASS PCS-08 staging deploy` only after that atomic state write. Therefore the successful final PASS also proves the deployment receipt was written for the deployed SHA/tag.

## New proven staging identity

The current proven SumoPod staging application runtime is now:

```text
revision: 52046db35e403babdda934881773c46bf2c57b68
image:    staging-52046db35e40
```

This supersedes the prior application-runtime claim `0f332c73dc7b363bffecdeecae921d805d5ae131` / `staging-0f332c73dc7b`.

## Preserved boundaries and non-claims

- staging remains distinct from production;
- this deployment did not rerun the full PCS-09 VPS-reboot proof;
- this deployment did not create a new same-host cold backup for the new SHA;
- earlier PCS-09 reboot/security/backup evidence remains historical evidence for the host boundary, not a claim that those destructive checks were repeated for this revision;
- off-host DR, total-host-loss recovery, production promotion, and long-term external telemetry retention remain separate non-claims;
- no paid provider call was introduced for this convergence.

## Closure bookkeeping

The runtime convergence itself is complete. Canonical docs may be merged only after automatic staging CD is frozen back to `ECORIONE_STAGING_CD_ENABLED=0`; otherwise the docs-only merge would itself become a newer eligible `main` revision and immediately move the runtime again.
