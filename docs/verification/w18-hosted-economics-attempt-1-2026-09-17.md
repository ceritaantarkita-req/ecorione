# W18 hosted economics — Attempt 1 failure record (2026-09-17)

Status: **NOT CLOSED**. Do not reuse this attempt as closure evidence and do not rerun it unchanged.

## Canonical source

- repository: `ceritaantarkita-req/ecorione`
- branch: `main`
- source revision: `982d08b1b7d230d47723e9ef50f9fcbc20bf15ba`
- provider: `openrouter`
- pricing identity: `claude-sonnet-4-5-20250929`
- explicit operator cap: `US$1`
- durable daily/monthly budget: `US$1 / US$10`
- formal shape: 5 tasks × 2 repeats × 2 lanes = 20 intended model calls

The zero-spend preflight passed before the formal run with `hostedProvider=openrouter`, a configured `openrouter/messages` vault credential, `hostedCallsEnabled=true` only for the bounded run, and the process cost kill switch explicitly opened for the authorized attempt.

## Observed paid execution

The run stopped after 8 of the intended 20 hosted calls. Console-reported billed cost before the stop was:

- `incident-triage` full-inline pair 1: `$0.006021`
- `incident-triage` ECX-auto pair 1: `$0.003711`
- `incident-triage` full-inline pair 2: `$0.006021`
- `incident-triage` ECX-auto pair 2: `$0.003711`
- `procurement-award` full-inline pair 1: `$0.000000`
- `procurement-award` ECX-auto pair 1: `$0.003768`
- `procurement-award` full-inline pair 2: `$0.000000`
- `procurement-award` ECX-auto pair 2: `$0.003768`

Observed cumulative billed amount: **`$0.027000`**.

The `incident-triage` task gate passed because execution advanced to the next task. `procurement-award` failed with both full-inline repetitions reporting quality score != 1 and billed cost `0`, while both ECX-auto calls returned positive billed cost. The task therefore also failed the requirement that automatic billed cost be lower than full-inline.

The harness terminated immediately at that task gate. No closure-eligible W18 evidence or summary file was emitted. The operator wrapper then set runtime `hostedCallsEnabled=false` in its `finally` block.

## Diagnosis

The failure exposed a provider-boundary integrity gap rather than valid economic evidence. The OpenAI-compatible adapter accepted an HTTP 200 response even when its completion content was empty/unusable, and the OpenRouter path accepted `usage.cost = 0` although the current OpenRouter mapping is restricted to pinned paid Claude models. Such a response could therefore be cached and settled as though it were a valid completion, producing a misleading zero-cost/zero-quality measurement.

## Required fix before another paid attempt

1. Treat HTTP-success responses without usable completion text as provider failures.
2. For current pinned paid OpenRouter models, reject provider-reported billed cost `<= 0` fail-closed.
3. Regression-test both boundaries with mocked provider responses; no paid calls are needed for these tests.
4. Merge only after normal CI/Product Eval gates pass.
5. Before any later paid attempt, return the operator process to `ECORIONE_COST_KILL_SWITCH=1`, inspect the durable spend ledger, synchronize local `main`, and obtain a fresh explicit spend authorization/cap for the new run.

W18 remains open until a later bounded real-provider run produces closure-eligible evidence.
