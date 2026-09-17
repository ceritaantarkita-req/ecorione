# W18 — hosted economic validation preflight

Status: **FORMAL RUN READY / NOT CLOSED**

Original date: **2026-09-17**  
Current synchronization: **2026-09-18**

This document began as the zero-spend W18 preflight specification. It is now updated with the provider-failure chronology, successful Anthropic-only diagnostic, reconciled durable ledger, and the formal-run admission rules that apply next.

## Goal

W18 exists to close the bounded claim that automatic ECX selective context can reduce **real hosted provider billed cost**, not merely local input tokens or a static price-table estimate.

W17 remains authoritative for bounded no-oracle selector behavior on the local four-lane benchmark. W18 narrows the paid comparison to:

- `full-inline`;
- `ecx-selective-auto`.

Formal shape:

```text
5 synthetic extraction tasks
× 2 paired repeats
× 2 hosted lanes
= 20 measured hosted model calls
warm-up calls = 0
```

## Provider, model, routing, and cost authority

```text
provider gateway = OpenRouter
pricing identity = claude-sonnet-4-5-20250929
runtime model = anthropic/claude-sonnet-4.5
provider.only = ["anthropic"]
allow_fallbacks = false
cost authority = OpenRouter usage.cost
```

The Anthropic-only routing policy was introduced after a diagnostic showed the same OpenRouter model route being served through Amazon Bedrock and returning `finishReason=content_filter` with no usable completion.

OpenRouter successful responses must carry usable completion text and valid billing authority. For the pinned paid W18 route, non-positive provider-reported billed cost is rejected for closure evidence. When a rejected response still supplies authoritative cost diagnostics, durable accounting settles to that reported amount before the error is rethrown.

## Synthetic egress boundary

W18 uses only synthetic extraction fixtures. W18 artifacts are marked:

```text
sensitivity = INTERNAL
syncClass = CLOUD_ALLOWED
```

Automatic ECX hydration uses `hostedEligible=true`. Fixture relevance indexes are evaluation-only and are not supplied to the automatic selector.

## Attempt chronology retained

### Attempt 1

- intended 20 calls;
- stopped after 8;
- known billed amount `$0.027000`;
- exposed unusable HTTP-success and zero-cost acceptance defects.

### Attempt 2

- four settled calls billed `$0.019266`;
- fifth intended call failed closed on unusable HTTP-success;
- historical reservation `$0.107157` remains `uncertain` because authoritative historical billing cannot be reconstructed;
- conservative committed ledger became `$0.153423`.

### Attempt 3 diagnostic

```text
responseModel = anthropic/claude-sonnet-4.5
finishReason = content_filter
routingProvider = Amazon Bedrock
inputTokens = 2002
outputTokens = 1
usageCostUsd = 0
```

The explicit provider cost authority was zero, so this diagnostic reservation settled to `$0`. Committed ledger remained `$0.153423`; no new uncertain entry was added.

### Attempt 4 Anthropic-only diagnostic

Request routing:

```text
provider.only = ["anthropic"]
allow_fallbacks = false
```

Result:

```text
quality = 1 (3/3)
inputTokens = 2002
outputTokens = 45
billedCostUsd = 0.006681
settlement = settled
overrun = 0
cacheHit = false
gate.pass = true
```

Postflight committed ledger became `$0.160104`.

## Latest zero-spend postflight

On synchronized `main` `9f95d184c6a59da527fd23454fed06065a5738fe`:

```text
hostedCallsEnabled = false
costKillSwitch = 1
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
effectiveHeadroomUsd = 0.839896
readiness.pass = true
```

The one unsettled entry is the historical Attempt 2 reservation. Known settled provider actual through Attempt 4 is `$0.052947`; `$0.052947 + $0.107157 = $0.160104`.

## Spend safety boundary for the formal run

A fresh authorization has been granted for **one formal W18 attempt, maximum US$0.25**.

This authorization is not standing permission and is not reusable after a partial/failed run.

The durable Connect spend budget is the pre-dispatch hard admission boundary. Because ledger day keys are UTC-based, the operator must derive the **current UTC-day committed value at execution time** and set the temporary daily ceiling to:

```text
currentCommitted + 0.25
```

Do not hardcode `$0.410104` unless current UTC-day committed is still exactly `$0.160104` at execution time.

Formal process requirements before first provider dispatch:

1. synchronized clean `main`, `HEAD == origin/main`;
2. Connect, Hub, Artifact healthy;
3. Connect runtime `hostedProvider=openrouter`;
4. Connect credential vault available with `openrouter/messages`;
5. Connect process started with `ECORIONE_COST_KILL_SWITCH=0`;
6. Connect process started with `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic`;
7. temporary durable daily ceiling equals current UTC-day committed + `0.25`;
8. current shell sets `ECORIONE_W18_ALLOW_SPEND=YES`;
9. current shell sets `ECORIONE_W18_MAX_SPEND_USD=0.25`;
10. runtime hosted calls enabled only for the bounded run;
11. zero-spend preflight PASS;
12. evidence output path is new and cannot overwrite prior evidence.

W18 also retains its absolute internal safety maximum of USD 5; the operator's current `$0.25` authorization is the tighter limit.

## No-spend preflight

```powershell
node .\scripts\w18-hosted-economics.mjs --preflight
```

Preflight checks repository state, service health, runtime provider state, credential inventory, and durable budget state. It does not dispatch hosted inference.

A preflight can pass while `hostedCallsEnabled=false`; formal dispatch requires hosted mode to be deliberately enabled after all admission settings are in place.

## Formal closure gate

For each measured call/task:

- provider gateway `openrouter`;
- pricing model exactly `claude-sonnet-4-5-20250929`;
- no exact-cache hit;
- exact extraction quality score `1`;
- automatic selector recall `1`;
- selected refs remain within `1..3`;
- automatic hydration bytes < full-inline fixture context bytes;
- provider billed cost is finite and `> 0`;
- durable settlement is `settled`;
- budget actual equals recorded billed cost;
- automatic input tokens < full-inline input tokens;
- automatic billed cost < full-inline billed cost.

Aggregate:

```text
taskCount = 5
measuredModelCalls = 20
failedTasks = 0
auto billed cost < full-inline billed cost
actual run spend <= 0.25
closureEligible = true
```

## Evidence discipline

Raw evidence is written under gitignored `.ecorione/evidence/`, with a separate SHA-256 summary. Commit only sanitized verification records.

A failed formal run must not be rerun under the same authorization. Preserve failure evidence, disable hosted mode, stop the engine launched with kill switch `0`, inspect the ledger, diagnose, and obtain fresh explicit authorization before any new provider dispatch.

## Claim boundary

A W18 PASS supports only a bounded statement on the five synthetic extraction fixtures using the pinned OpenRouter/Anthropic route. It does not establish universal workload savings, future provider pricing, OpenRouter credit-purchase fees, local hardware/electricity economics, end-to-end network savings, production SLA/SLO, or public percentage-savings claims.
