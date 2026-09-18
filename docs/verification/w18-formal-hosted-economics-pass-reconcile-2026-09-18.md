# W18 Formal Hosted Economics — PASS with Ledger Reconciliation Hold

Date: **2026-09-18**

Status: **FORMAL RUNTIME PASS / CLOSURE HOLD**

This verification note records the operator-provided formal W18 runtime executed from synchronized clean `main` at `f249d9c0681462253bff21ca30354892ca4ce60f`. The formal harness itself passed every encoded W18 closure gate and produced `closureEligible=true`. W18 is not marked CLOSED yet because the durable spend ledger at formal-run start contains an unexplained US$0.091596 increase relative to the immediately preceding zero-spend preflight transcript. That provenance must be reconciled before final closure.

Repository recording status:

```text
PR = #140
exact reviewed head = 7118e9e4887438ddbea3e56a787a9f4f910ec1b1
CI #1005 = PASS
Product Eval #244 = PASS
merged main = eba6cbf5b53ad9af4f61e4519ae1e3400f4fdf53
```

This documentation merge made no hosted provider call and did not modify the local durable spend ledger.

## Runtime identity

```text
repository branch = main
HEAD = f249d9c0681462253bff21ca30354892ca4ce60f
origin/main = f249d9c0681462253bff21ca30354892ca4ce60f
worktree clean = true
provider gateway = OpenRouter
provider.only = anthropic
fallback = disabled
formal max spend = US$0.25
```

The wrapper preflight inside the formal execution passed with `hostedProvider=openrouter`, `hostedCallsEnabled=false` before activation, vault available, OpenRouter credential configured, `costKillSwitch=0` for the bounded child process, and all readiness failures empty.

## Formal measured result

```text
tasks = 5
paired repeats = 2
lanes = full-inline, ecx-selective-auto
measured model calls = 20
failed tasks = 0
aggregate pass = true
closureEligible = true

full-inline billed cost = US$0.059106
automatic ECX billed cost = US$0.032610
actual formal run spend = US$0.091716
saved vs full-inline = US$0.026496
saved percentage = 44.827936250126896%
median task saved percentage = 44.4913020558777%
median task input-token reduction = 50.629874025194965%
```

The aggregate PASS means the formal harness accepted all per-call/per-task gates encoded for W18, including the pinned hosted identity/routing, uncached measured calls, positive authoritative billed cost, settled durable accounting, exact extraction quality, selector recall/bounds, and automatic-lane token/cost reduction requirements.

Raw local evidence remains gitignored:

```text
path = .ecorione/evidence/w18-hosted-economics-2026-09-18T02-18-51-339Z.json
sha256 = cadb920047a27eb4e3db38cb53e63192af3ea7857617d8f125c7056bd6c162da
bytes = 29536
summary = .ecorione/evidence/w18-hosted-economics-2026-09-18T02-18-51-339Z.summary.json
```

## Cleanup and postflight

```text
hostedCallsEnabled = false
costKillSwitchForFutureProcess = 1
engineStopped = true

dailyCommittedUsd = 0.183312
monthlyCommittedUsd = 0.343416
unsettledReservations = 0
monthlyHeadroomUsd = 9.656584
```

The formal run increased durable committed spend by exactly US$0.091716, matching the formal aggregate actual run spend.

## Reconciliation hold

The immediately preceding zero-spend wrapper preflight reported:

```text
dailyCommittedUsd = 0
monthlyCommittedUsd = 0.160104
unsettledReservations = 0
```

The formal execution then began with:

```text
dailyCommittedUsd = 0.091596
monthlyCommittedUsd = 0.251700
unsettledReservations = 0
```

Therefore an additional **US$0.091596** of durable committed hosted spend appeared between those two checkpoints. The formal transcript supplied here does not establish the provenance of that earlier spend. It must not be silently attributed to the current formal run.

Required reconciliation before W18 closure:

1. inspect `data/connect-spend-budget.json` locally;
2. identify entries contributing the US$0.091596 delta, including timestamps, status, reserved/actual cost, provider/model/request identifiers where present;
3. confirm whether the delta came from a prior formal invocation, another hosted workflow, or another documented source;
4. preserve the ledger as-is; do not rewrite historical entries;
5. commit only a sanitized reconciliation summary.

## Current conclusion

- formal W18 harness: **PASS**;
- formal measured run spend: **US$0.091716**, within the US$0.25 cap;
- automatic ECX lane billed cost: **lower than full-inline** on all aggregate acceptance logic;
- cleanup: **PASS**;
- raw evidence hash: preserved above;
- W18 overall closure: **HOLD pending US$0.091596 spend-provenance reconciliation**;
- W20: **still blocked until W18 is formally closed**.

Claim boundary remains unchanged: these measurements are bounded to the five synthetic extraction fixtures on the pinned OpenRouter/Anthropic route and are not a universal or future-pricing savings claim.
