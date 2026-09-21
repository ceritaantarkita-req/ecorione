# Latest-main staging convergence checkpoint 2 — 2026-09-21

Status: **ACTIVE / POST-MERGE SOURCE GATES GREEN / CD ACTIVATION STILL OFF**

## Checkpoint boundary

PR #246 opened the bounded latest-main staging-convergence scope and merged as:

```text
merge main: e38d9d8cd5af44b51068100428a321179b1bdcdf
```

PR #246 exact head `fcaaa12ea7f5d2866c056a37f31615730b6ffe73` passed CI #1751 and Product Eval #990 before merge.

The merged `main` revision then passed:

```text
CI            #1752 PASS   run 35623945344
Product Eval  #991  PASS   run 35623945386
```

## Staging deploy evidence

The Product Eval completion triggered Staging Deploy #281 while CI was still running; its deploy job was skipped.

After both exact-main gates were green, CI completion triggered Staging Deploy #282 / run `35624287249`:

```text
gate    PASS
deploy  SKIPPED
```

The gate job verifies exact current `main` and successful CI + Product Eval on the same SHA. The deploy job additionally requires repository variable `ECORIONE_STAGING_CD_ENABLED == 1`. Since the exact-main gate passed and the deploy job was skipped, the governed deployment activation remains disabled at this checkpoint.

## Runtime claim boundary

No new SumoPod runtime deployment is claimed. The latest proven staging application remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

This checkpoint branch/docs may advance GitHub `main` again after merge, but that is documentation-only. The exact deployment target must be resolved by the existing workflow at dispatch time and must equal then-current `main`.

## Remaining action to close

1. set repository variable `ECORIONE_STAGING_CD_ENABLED` to `1`;
2. manually dispatch **Staging Deploy** against current `main`;
3. require deploy PASS;
4. verify public HTTPS smoke, authenticated `/api/ops`, exact-host identity, and release receipt;
5. disable automatic staging CD again if the operator wants the previous frozen behavior;
6. close the convergence scope in canonical docs with the exact proven runtime revision.

The current ChatGPT GitHub connector exposes repository/file/PR/workflow-read and rerun operations but does not expose repository-variable mutation or workflow-dispatch creation, so steps 1–2 remain an operator-side GitHub action. No production promotion or public-edge activation is implied.
