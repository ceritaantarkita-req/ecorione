# ECORIONE — Execution Progress & Remaining Roadmap

Last updated: **2026-09-18**

Status: **ACTIVE — canonical execution tracker**

Start from `docs/current-state-and-next-steps.md`, then this file. Historical Batch 1–12 chronology remains in `docs/archive/`; dated audits and failed-attempt records are evidence snapshots and must not be rewritten into current status.

## Status legend

| Status | Meaning |
|---|---|
| `CLOSED` | Implementation/evidence boundary satisfied and documented. |
| `PASS WITH LIMITATIONS` | Gates passed with bounded limitations retained. |
| `REPO SIDE DONE` | Repository implementation/gates complete; runtime evidence may remain external. |
| `FORMAL RUN READY` | Prerequisites and bounded diagnostic passed; final runtime evidence not yet executed. |
| `BLOCKED` | Intentionally waiting on an earlier workstream. |
| `DEFERRED` | Explicitly postponed by operator/design. |
| `OPEN-ENDED` | Evidence-driven hardening, never permanently finished. |

## Current closure map

| ID / area | State | Current boundary |
|---|---:|---|
| Batch 1–12 | **12/12 CLOSED** | Defined implementation roadmap. |
| Historical Ledger + ECX | **CLOSED / PASS** | Local chronology/hash-chain + pointer/hydration evidence. |
| Historical Comparative ECX | **CLOSED / PASS WITH LIMITATIONS** | Oracle-control local benchmark; not automatic selector or hosted-dollar proof. |
| W03 | **CLOSED — REAL-LAPTOP VERIFIED** | UX/product runtime boundary completed. |
| W09/W10 | **CLOSED — WINDOWS RUNTIME VERIFIED** | Startup/doctor bounded Windows evidence. |
| W11 | **CLOSED — WINDOWS INSTALLER VERIFIED** | Packaged installer lifecycle passed. |
| W12–W15 | **CLOSED at documented boundaries** | Attachment path, immutable identity, product eval, bounded agentic local eval. |
| W16 | **REPO SIDE DONE** | Automatic `semantic-v1` selector, `maxRefs=3`. |
| W17 | **CLOSED — VERIFIED LOCAL MODEL PASS** | 100 measured calls, 5/5 task gates, no-oracle automatic lane. |
| W18 | **FORMAL RUN READY / NOT CLOSED** | Diagnostic passed and formal routing/reservation/pre-dispatch cap guard is merged; 20-call hosted economics still required. |
| W19 | **REPO SIDE DONE** | Release/security governance gates retained. |
| W20 | **BLOCKED ON W18** | Final current-state closure follows formal W18. |
| Compute-host/VPS + Cloudflare | **DEFERRED BY OPERATOR** | Not a W18 blocker. |
| AutoClick | **DEFERRED BY DESIGN** | No implicit activation. |
| Fase 6+ | **OPEN-ENDED** | Evidence-driven only. |

## W16/W17 transition retained

W16 removed the caller/oracle requirement from the automatic selector by adding `selection: { mode: "semantic-v1", maxRefs: 3 }`. W17 then closed the bounded local no-oracle validation over:

```text
5 tasks × 5 repeats × 4 lanes = 100 measured calls
cache hits = 0
passed task gates = 5/5
median automatic selector recall = 1.0
```

W17 proves local model-context/input-token and selected-hydration reductions at the tested boundary. It does not prove hosted provider billed-cost savings or universal end-to-end network savings.

## W18 chronology

### Attempt 1 — failed formal run

- intended: 20 calls;
- stopped after: 8;
- known provider-billed amount: `$0.027000`;
- exposed unusable HTTP-success/zero-cost acceptance;
- fail-closed response validation was added afterward.

### Attempt 2 — failed formal run

- four successful `incident-triage` calls settled for `$0.019266` total;
- fifth intended call failed on unusable OpenRouter HTTP-success response;
- one historical reservation remains `uncertain` at `$0.107157` because authoritative billing was unavailable at that time;
- post-Attempt-2 conservative committed ledger: `$0.153423`.

### Attempt 3 — one-call diagnostic failure

The same `procurement-award/full-inline` diagnostic reached OpenRouter and failed closed with:

```text
responseModel = anthropic/claude-sonnet-4.5
finishReason = content_filter
routingProvider = Amazon Bedrock
inputTokens = 2002
outputTokens = 1
usageCostUsd = 0
```

The provider explicitly reported zero cost, so the reservation settled to `$0`; the durable committed ledger stayed `$0.153423` and no new uncertain entry was added.

### Attempt 4 — one-call Anthropic-only diagnostic PASS

Request policy:

```text
provider.only = ["anthropic"]
allow_fallbacks = false
```

Observed:

```text
responseModel = anthropic/claude-sonnet-4.5
inputTokens = 2002
outputTokens = 45
billedCostUsd = 0.006681
settlement = settled
cacheHit = false
quality = 1 (3/3)
gate.pass = true
```

Postflight durable state:

```text
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
hostedCallsEnabled = false
costKillSwitch = 1
```

Known settled provider actual across Attempts 1–4 is `$0.052947`; the difference to committed `$0.160104` is exactly the historical uncertain reservation `$0.107157`.

### Formal guard merge — repository PASS

PR #135 merged the formal dispatch/routing/cost guard to `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`. Exact reviewed head `1b6f5d631429eda53be734266a5f47e527390739` passed CI #994 and Product Eval #233.

The merged formal path now requires Anthropic-only OpenRouter routing, records `routingProvider`, couples the harness reservation estimate to the production OpenRouter estimator, checks durable `reservedUsd`, and rejects the next dispatch before provider execution when cumulative actual spend plus the next reservation would exceed the explicit run cap.

No hosted provider call was made by this repository-side work, so the single US$0.25 formal authorization remains unconsumed.

## W18 formal run readiness

Formal shape remains:

```text
5 synthetic tasks
× 2 paired repeats
× 2 lanes (full-inline, ecx-selective-auto)
= 20 measured hosted calls
warm-up calls = 0
```

Pinned profile:

```text
provider gateway = openrouter
pricing identity = claude-sonnet-4-5-20250929
runtime model = anthropic/claude-sonnet-4.5
OpenRouter provider-only = anthropic
fallback = disabled
cost authority = OpenRouter usage.cost
```

A fresh operator authorization is present for **one formal W18 run with maximum provider spend US$0.25**. This is not standing permission for retries.

The durable budget is the pre-dispatch hard stop. At formal engine startup, derive the **current UTC-day committed amount** from the ledger and set temporary `ECORIONE_SPEND_DAILY_USD = currentCommitted + 0.25`. Do not hardcode a historical ceiling across a UTC-day rollover or after unrelated spend.

Formal process requirements:

- clean synchronized `main`;
- Connect/Hub/Artifact healthy;
- `hostedProvider=openrouter`;
- vault available with `openrouter/messages`;
- Connect process starts with `ECORIONE_COST_KILL_SWITCH=0`;
- Connect process starts with `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic`;
- current run sets `ECORIONE_W18_ALLOW_SPEND=YES`;
- current run sets `ECORIONE_W18_MAX_SPEND_USD=0.25`;
- runtime hosted mode enabled only for the bounded run;
- evidence output must be new/non-overwriting;
- cleanup must return hosted mode off and stop the engine opened with kill switch `0`.

## W18 formal closure gate

Each call/task must preserve:

- OpenRouter gateway + pinned pricing identity;
- `routingProvider` remains Anthropic for every measured call;
- `budget.reservedUsd` equals the formal conservative reservation estimate;
- the pre-dispatch cap guard remains active;
- no exact-cache hit;
- positive authoritative provider billed cost;
- durable settlement `settled`;
- exact extraction quality `1`;
- automatic selector recall `1`;
- selected ref count within `1..3`;
- automatic hydrated bytes < full context bytes;
- automatic input tokens < full-inline input tokens;
- automatic billed cost < full-inline billed cost.

Aggregate:

```text
taskCount = 5
measuredModelCalls = 20
failedTasks = 0
actualRunSpendUsd <= 0.25
closureEligible = true
```

If any gate/provider/cost/accounting condition fails, stop. Do not rerun under the same authorization.

## Canonical W18 docs

- `docs/verification/w18-hosted-economics-preflight-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-1-2026-09-17.md`
- `docs/verification/w18-hosted-economics-attempt-2-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-3-2026-09-17.md`
- `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md`
- `docs/verification/w18-formal-run-readiness-2026-09-18.md`
- `docs/verification/w18-formal-guard-merge-2026-09-18.md`
- `docs/verification/w18-formal-operator-wrapper-2026-09-18.md`

## Immediate execution order

1. merge the formal operator wrapper and its repository-side tests/docs;
2. synchronize operator laptop to the resulting `main`;
3. run `node .\\scripts\\w18-formal-operator.mjs --preflight-only`;
4. run `node .\\scripts\\w18-formal-operator.mjs --execute-authorized-w18` exactly once;
5. if PASS, commit sanitized closure verification and close W18;
6. continue W20 final current-state sync;
7. if FAIL, preserve evidence and diagnose before any new authorization.

The wrapper is repository-side preparation only until merged and executed from synchronized `main`; its implementation made no hosted provider call.

## Persistent evidence rules

- Historical Ledger and Context L0 remain semantic ground truth.
- Memory is untrusted data, never instructions.
- No cross-service DB access.
- Hub remains policy/approval authority; Connect remains provider/credential/MCP authority; Artifact owns L3 bytes.
- No silent provider fallback.
- Hosted dispatch obeys kill switch and durable cumulative budget.
- Exact-cache hits cannot contaminate comparative model-compute evidence.
- Local USD `0` is not hosted billed-cost evidence.
- Provider-reported billed cost is authoritative for W18.
- Valid failed evidence is preserved after fixes.
- Raw private runtime evidence remains local/gitignored; commit only sanitized summaries.
- Historical dated audits are not silently rewritten into current status.
