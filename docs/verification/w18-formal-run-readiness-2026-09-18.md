# W18 formal hosted economics — readiness record (2026-09-18)

Status: **FORMAL RUN READY / NOT YET EXECUTED / NOT CLOSURE EVIDENCE**

This record freezes the verified preconditions before the next formal W18 attempt. It does not itself prove hosted economic savings.

## Current repository lineage

Documentation-sync base `main`:

```text
9f95d184c6a59da527fd23454fed06065a5738fe
```

That baseline contains:

- fail-closed unusable OpenRouter completion handling;
- safe rejected-response billing diagnostics;
- durable settlement from authoritative provider cost when available;
- remaining-headroom W18 authorization checks;
- one-call diagnostic failure evidence persistence;
- safe OpenRouter selected-routing diagnostics;
- Anthropic-only OpenRouter routing support with fallback disabled;
- diagnostic conservative reservation estimation including provider-routing request bytes;
- successful Attempt 4 verification record.

The documentation-only sync containing this file will advance `main`; the operator must run formal evidence only after synchronizing to that merged head.

## Formal experiment profile

```text
provider gateway: OpenRouter
pricing identity: claude-sonnet-4-5-20250929
runtime model request: anthropic/claude-sonnet-4.5
provider routing allowlist: anthropic only
provider fallback: disabled
selector: semantic-v1
selector maxRefs: 3
modes: full-inline, ecx-selective-auto
tasks: 5
paired repeats: 2
measured hosted calls: 20
warmups: 0
cost authority: OpenRouter usage.cost
```

Synthetic fixtures are `INTERNAL` + `CLOUD_ALLOWED`. Relevance indexes are evaluation-only and are not supplied to automatic selection.

## Why the provider is pinned

Attempt 3 produced an unusable HTTP-success response for `procurement-award/full-inline` with:

```text
finishReason = content_filter
routingProvider = Amazon Bedrock
inputTokens = 2002
outputTokens = 1
usageCostUsd = 0
```

The same diagnostic later passed under request-level Anthropic-only routing with OpenRouter fallbacks disabled. Formal W18 therefore keeps that deterministic provider routing policy.

## Diagnostic prerequisite — PASS

Attempt 4:

```text
task/lane = procurement-award/full-inline
provider.only = ["anthropic"]
allow_fallbacks = false
reservation estimate = 0.107374
explicit diagnostic cap = 0.11
inputTokens = 2002
outputTokens = 45
billedCostUsd = 0.006681
settlement = settled
cacheHit = false
quality = 1 (3/3)
gate.pass = true
```

This is diagnostic-only evidence and does not replace the formal run.

## Durable ledger reconciliation before formal authorization

Latest zero-spend postflight:

```text
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
hostedCallsEnabled = false
costKillSwitch = 1
readiness.pass = true
```

Known settled provider actual through Attempt 4:

```text
Attempt 1  0.027000
Attempt 2  0.019266
Attempt 3  0.000000
Attempt 4  0.006681
-------------------
known      0.052947
```

Historical Attempt 2 uncertain reservation:

```text
0.107157
```

Reconciliation:

```text
0.052947 + 0.107157 = 0.160104
```

Therefore the ledger is internally consistent at this checkpoint. The historical uncertain reservation must remain unchanged.

## Formal monetary authorization

The operator explicitly authorized:

```text
one formal W18 attempt
maximum provider spend = US$0.25
```

This authorization is **single-run only**. It is not standing permission, and it is not reusable after a partial or failed formal attempt. Documentation-only synchronization does not consume it because no hosted call is made and no provider/cost logic changes.

## Dynamic durable budget hard stop

Connect reserves conservative spend before provider dispatch. To make the durable boundary enforce the same remaining allowance as the explicit formal authorization, calculate current committed spend for the **current UTC ledger day** before engine startup and use:

```text
ECORIONE_SPEND_DAILY_USD = currentUtcDayCommittedUsd + 0.25
```

Important: the ledger's day key is UTC. The previously observed `$0.160104` may no longer be the current daily committed amount after UTC midnight or unrelated hosted activity. The formal command must calculate rather than assume it.

The monthly budget must also leave at least `$0.25` remaining headroom. The latest observed monthly headroom was `$9.839896`.

## Required formal environment

Connect must be started with:

```text
ECORIONE_COST_KILL_SWITCH=0
ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic
ECORIONE_SPEND_DAILY_USD=<current UTC-day committed + 0.25>
```

Current formal shell/run must set:

```text
ECORIONE_W18_ALLOW_SPEND=YES
ECORIONE_W18_MAX_SPEND_USD=0.25
```

Runtime settings must be explicitly changed to:

```text
hostedProvider = openrouter
hostedCallsEnabled = true
```

Only after all of the above should the zero-spend preflight run.

## Preflight acceptance

Require:

- branch `main`;
- clean worktree;
- `HEAD == origin/main`;
- healthy Connect/Hub/Artifact;
- runtime hosted provider `openrouter`;
- vault available;
- `openrouter/messages` configured;
- cost kill switch `0` in the running Connect process;
- durable effective headroom at least `$0.25`;
- no provider dispatch during preflight.

If any condition fails, do not start the formal command.

## Formal closure gate

For all calls/tasks:

- provider gateway remains OpenRouter;
- pricing identity remains exactly `claude-sonnet-4-5-20250929`;
- no exact-cache hit;
- response usable and task quality score `1`;
- provider-reported billed cost finite and `> 0`;
- durable accounting settlement `settled`;
- budget actual equals billed cost;
- automatic selector recall `1`;
- selected refs within `1..3`;
- automatic hydration bytes lower than full-inline context bytes;
- automatic input tokens lower than full-inline;
- automatic billed cost lower than full-inline.

Aggregate:

```text
taskCount = 5
measuredModelCalls = 20
failedTasks = 0
full/auto comparison valid for every task
auto total billed cost < full-inline total billed cost
actualRunSpendUsd <= 0.25
closureEligible = true
```

## Evidence output

Use a new, non-overwriting path under:

```text
.ecorione/evidence/
```

The runner writes raw JSON plus a SHA-256 summary. Raw evidence is gitignored. After review, commit only sanitized verification facts and hashes needed for closure.

## Mandatory cleanup

Whether formal W18 passes or fails:

1. set runtime `hostedCallsEnabled=false`;
2. clear `ECORIONE_W18_ALLOW_SPEND`;
3. clear `ECORIONE_W18_MAX_SPEND_USD`;
4. clear `ECORIONE_OPENROUTER_PROVIDER_ONLY` from the operator shell after the engine is stopped;
5. return shell `ECORIONE_COST_KILL_SWITCH=1`;
6. stop the engine/Connect process launched with process kill switch `0`;
7. rerun zero-spend preflight/ledger inspection with hosted mode off;
8. preserve formal output and console failure facts if the run fails.

A partial/failed formal run consumes this authorization for the dispatches that occurred. **Do not rerun.** Diagnose first and obtain fresh explicit authorization.

## W20 boundary

W20 remains blocked until formal W18 is both:

- runtime PASS with `closureEligible=true`; and
- represented by a sanitized verification record merged through normal repository gates.

Only then should final current-state/W20 closure documentation be produced.
