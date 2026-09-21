# Latest-main staging convergence checkpoint 3 — 2026-09-21

Status: **ACTIVE / FINAL REPOSITORY GATES GREEN / CD ACTIVATION REQUIRED**

## Repository checkpoint

Checkpoint-2 documentation PR #247 merged to `main` as:

```text
7e2130094fc9e3ea85dd9b0a3a5236a88c41a2c8
```

PR #247 exact head `cd306c1bf7cb9f8c282a9aba13b07e6a1d6c4755` passed CI #1753 and Product Eval #992 before merge.

For merged `main`, GitHub concurrency cancelled the earlier duplicate push runs CI #1754 and Product Eval #993. The surviving authoritative runs completed:

```text
CI            #1755 PASS
Product Eval  #994  PASS
```

The final Staging Deploy trigger for the same exact `main` revision was:

```text
Staging Deploy #288
gate    PASS
deploy  SKIPPED
```

The exact-current-main gate is therefore healthy. The deploy job remains intentionally inert because governed staging CD activation is still disabled.

## Runtime claim boundary

No newer SumoPod deployment is proven. The latest verified runtime remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

Repository `main` and remote runtime remain separate evidence boundaries.

## Required next operator action

1. set repository variable `ECORIONE_STAGING_CD_ENABLED=1`;
2. manually run **Staging Deploy** on current `main`;
3. require deploy PASS;
4. verify public HTTPS smoke, authenticated `/api/ops`, exact-host identity, and release receipt;
5. after successful verification, optionally return `ECORIONE_STAGING_CD_ENABLED` to `0` if staging CD should remain frozen by default;
6. close this convergence scope and update the proven staging revision in canonical docs.

This remains staging-only. Production promotion, public-edge activation, paid-provider evidence, PE-09, PCS-11, and Batch 13 are not authorized by this checkpoint.
