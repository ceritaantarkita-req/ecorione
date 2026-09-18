# W18 formal guard — repository merge verification (2026-09-18)

Status: **REPO-SIDE PASS / FORMAL RUNTIME NOT YET EXECUTED / NOT CLOSURE EVIDENCE**

This record captures the repository-side safety/audit gate that must exist before the single authorized formal W18 hosted-economics run. It does **not** claim that the 20-call formal runtime experiment has run or passed.

## Merge lineage

PR #135:

```text
title = fix(w18): guard formal dispatch cap and routing evidence
exact reviewed head = 1b6f5d631429eda53be734266a5f47e527390739
merged main = fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a
changed files = 4
```

Net changed files:

- `scripts/w18-hosted-economics.mjs`
- `services/connect/src/complete.ts`
- `services/connect/src/providers/hosted.ts`
- `test/w18-hosted-economics.test.mjs`

The temporary branch-only Prettier diagnostic used during CI diagnosis was fully removed before the reviewed head. It is not part of the final PR diff.

## Exact-head repository gates

On PR head `1b6f5d631429eda53be734266a5f47e527390739`:

```text
CI #994 = SUCCESS
Product Eval #233 = SUCCESS
```

CI #994 passed the repository verify path including formatting, lint, typecheck, tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, production build, naming, and full-history secret scan.

## Formal W18 guard now merged

The merged formal runner/runtime boundary now:

- requires `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic` for formal W18;
- records the sanitized successful `routingProvider` result and requires Anthropic routing in formal evidence;
- uses the same conservative OpenRouter reservation estimator as the production provider boundary;
- checks `budget.reservedUsd` against that formal reservation estimate;
- checks durable settlement and authoritative billed cost;
- rejects the **next** hosted dispatch before provider execution when cumulative actual spend plus the next conservative reservation would exceed the explicit W18 run cap;
- preserves the existing durable Connect reservation as the hard cumulative admission boundary.

No acceptance gate was weakened.

## Spend boundary

PR #135, its CI/Product Eval runs, the merge, and this documentation sync made **no hosted W18 provider dispatch**. They therefore consumed none of the single formal-run authorization.

The existing authorization remains:

```text
one formal W18 attempt
maximum provider spend = US$0.25
```

It remains single-run only. A partial or failed formal run cannot be retried without fresh explicit authorization.

## Remaining runtime boundary

Formal W18 remains **NOT CLOSED**. The operator runtime must still:

1. synchronize local `main` to the final merged documentation head;
2. confirm a clean worktree and `HEAD == origin/main`;
3. calculate current UTC-day committed spend from the durable ledger;
4. start Connect with kill switch open only for the bounded run and Anthropic-only OpenRouter routing;
5. set the temporary daily durable ceiling to current committed + US$0.25;
6. run the zero-spend preflight;
7. execute exactly the authorized formal experiment;
8. disable hosted mode, restore the safe environment, stop the special engine process, and reconcile the ledger afterward.

W20 remains blocked until formal W18 returns `closureEligible=true` and a sanitized runtime closure record is merged.
