# ECORIONE — Active Work Plan

Last updated: **2026-09-18**

Status: **ACTIVE / canonical execution log**

Current code + current runtime evidence + this document are the source of truth for active work. Historical dated audits and failed attempts remain preserved as evidence snapshots.

## Current repository checkpoint

```text
main at documentation-sync start: fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a
W11 final Windows installer closure: PASS
W17 formal local closure: PASS
W18 one-call Anthropic-only diagnostic: PASS
W18 formal dispatch/routing/cap guard: MERGED / REPO-SIDE PASS
W18 formal operator wrapper: MERGED / REPO-SIDE PASS
W18 formal 20-call run: NOT YET EXECUTED
W20 final sync: BLOCKED ON W18
```

The successful W18 diagnostic source was `a4382135d2d2729546e517b1bc6337542664f4ee`; PR #134 added its sanitized verification record. PR #135 then merged the remaining formal dispatch/routing/cap safety guard into `main` at `fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a`; exact reviewed head `1b6f5d631429eda53be734266a5f47e527390739` passed CI #994 and Product Eval #233.

## Work queue

| ID | Pekerjaan | Status | Boundary |
|---|---|---:|---|
| W01–W02 | Reconcile analysis + test discovery | **DONE** | Repository scope. |
| W03 | UX/Product Validation | **DONE — REAL-LAPTOP VERIFIED** | Rendered/runtime evidence closed at documented boundary. |
| W04–W08 | Runtime/provider/settings foundations | **DONE / REPO SIDE** | Existing limitations remain documented. |
| W09 | One-command startup | **DONE — WINDOWS RUNTIME VERIFIED** | Real Windows harness. |
| W10 | `ecorione doctor` | **DONE — WINDOWS RUNTIME VERIFIED** | Optional local generation canary remains diagnostic-only. |
| W11 | Installer/Launcher | **DONE — WINDOWS INSTALLER VERIFIED** | Clean Windows packaged lifecycle PASS. |
| W12 | Attachment path | **DONE — REPO SIDE** | File/foto → Artifact → Context pointer → hydration. |
| W13 | Immutable local model identity | **DONE WITH LIMITATIONS — RUNTIME VERIFIED** | Reverify when model/runtime changes. |
| W14 | Product eval foundation | **DONE — REPO SIDE** | Deterministic product regressions. |
| W15 | Agentic local-model eval | **DONE — VERIFIED LOCAL MODEL PASS^3** | Bounded eval harness only. |
| W16 | Automatic semantic reference selector | **DONE — REPO SIDE** | `semantic-v1`, `maxRefs=3`. |
| W17 | ECX no-oracle validation | **DONE — VERIFIED LOCAL MODEL PASS** | 5×5×4 = 100 measured calls, 5/5 gates. |
| W18 | Hosted economic validation | **FORMAL RUN READY / NOT CLOSED** | Attempt 4 diagnostic PASS; formal guard merged; formal 20-call evidence remains. |
| W19 | Release/security governance | **DONE — REPO SIDE** | CI history/naming/model-alias gates retained. |
| W20 | Final current-state sync | **BLOCKED ON W18** | Continue immediately after W18 closure. |

## W18 current facts

### Formal shape

```text
5 tasks × 2 repeats × 2 lanes = 20 measured hosted calls
lanes = full-inline, ecx-selective-auto
warmups = 0
provider gateway = OpenRouter
pricing identity = claude-sonnet-4-5-20250929
runtime model = anthropic/claude-sonnet-4.5
provider.only = ["anthropic"]
allow_fallbacks = false
cost authority = OpenRouter usage.cost
```

### Attempt history

```text
Attempt 1: failed after 8/20; known billed = 0.027000
Attempt 2: failed on intended call 5; four settled = 0.019266
Attempt 2 historical uncertain reservation = 0.107157
Attempt 3 diagnostic: content_filter via Amazon Bedrock; provider-reported cost = 0
Attempt 4 diagnostic: PASS; billed = 0.006681; settlement = settled; quality = 1
```

Known settled provider actual through Attempt 4:

```text
0.027000 + 0.019266 + 0 + 0.006681 = 0.052947
```

Latest postflight ledger:

```text
dailyCommittedUsd = 0.160104
monthlyCommittedUsd = 0.160104
unsettledReservations = 1
dailyHeadroomUsd = 0.839896
monthlyHeadroomUsd = 9.839896
hostedCallsEnabled = false
costKillSwitch = 1
```

The one unsettled reservation is historical Attempt 2. Do not rewrite it.

### Repository-side formal guard

```text
PR #135 reviewed head = 1b6f5d631429eda53be734266a5f47e527390739
CI #994 = PASS
Product Eval #233 = PASS
merged main = fcf71cc03f7584e005a490b8d7d3e4c9afdeba1a
```

This guard requires Anthropic-only OpenRouter routing, records successful `routingProvider`, couples the harness reservation estimate to the production OpenRouter estimator, validates durable `reservedUsd`, and blocks a next dispatch before provider execution if cumulative actual spend plus the next reservation would exceed the explicit W18 cap. This repository-side work made no hosted provider call.

## Formal authorization

Operator has explicitly authorized **one formal W18 attempt, maximum US$0.25**.

This authorization is current-run only. It does not authorize retries after a failed/partial formal attempt.

Because the durable budget uses UTC day/month keys, the formal startup wrapper must compute the **current UTC-day committed amount at execution time** and set:

```text
ECORIONE_SPEND_DAILY_USD = currentCommitted + 0.25
```

That makes Connect's pre-dispatch reservation admission the hard spend stop for the authorized remaining allowance. Do not blindly reuse `$0.410104`; that is valid only while current UTC-day committed remains exactly `$0.160104`.

## Formal run checklist

Before first dispatch:

1. local `main` synchronized to the documentation-only merge produced by this update;
2. worktree clean and `HEAD == origin/main`;
3. old engine stopped;
4. current UTC-day committed spend calculated from the durable ledger;
5. Connect process started with `ECORIONE_COST_KILL_SWITCH=0`;
6. Connect process started with `ECORIONE_OPENROUTER_PROVIDER_ONLY=anthropic`;
7. temporary daily durable ceiling set to `currentCommitted + 0.25`;
8. `ECORIONE_W18_ALLOW_SPEND=YES`;
9. `ECORIONE_W18_MAX_SPEND_USD=0.25`;
10. runtime `hostedProvider=openrouter` and `hostedCallsEnabled=true` only for the bounded run;
11. zero-spend preflight PASS;
12. output path new/non-overwriting.

After run, regardless of success/failure:

- disable runtime hosted mode;
- clear W18 spend/routing env from the operator shell;
- set shell kill switch back to `1`;
- stop the engine process that was launched with kill switch `0`;
- inspect durable ledger before any conclusion;
- do not rerun after failure without fresh authorization.

## Formal closure requirements

Every call must be uncached, use the pinned OpenRouter pricing identity, report Anthropic as the selected routing provider, match durable `reservedUsd` to the formal reservation estimate, have positive authoritative provider billed cost, and settle durable accounting. Each task must preserve quality and selector recall while automatic mode reduces input tokens and billed cost versus full-inline.

Aggregate requires:

```text
5 tasks
20 measured calls
0 failed tasks
auto total billed cost < full-inline total billed cost
actual formal spend <= US$0.25
closureEligible = true
```

## Claim boundary

A W18 PASS proves only a bounded hosted-cost comparison on the five synthetic extraction fixtures under the pinned OpenRouter/Anthropic route. It is not a universal savings claim and does not prove future provider pricing or end-to-end network savings.

W17's local automatic-selector evidence remains separate: W17 proved no-oracle local quality/selector behavior; W18 is specifically the hosted billed-cost closure.

## Immediate next action

```text
1. synchronize operator laptop to merged main `05ddd248e90e26b9db2c785d533c55ec817db013` or newer
2. run wrapper --preflight-only (zero spend)
3. execute wrapper --execute-authorized-w18 exactly once (max US$0.25)
4. preserve evidence and postflight ledger state
5. if PASS: document/merge W18 closure
6. continue W20 final current-state sync
7. if FAIL: stop, diagnose, require fresh authorization before retry
```

The wrapper keeps temporary spend/routing overrides out of `.env`, computes the current UTC-day ceiling at runtime, keeps hosted calls disabled during preflight, and restores hosted mode off in `finally`.

Do not reopen already-closed W03/W09/W10/W11/W16/W17 unless a new reproducible regression appears on newer product code.
