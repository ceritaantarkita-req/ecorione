# W18 hosted economics — Attempt 2 failure record (2026-09-17)

Status: **NOT CLOSED**. Do not reuse this attempt as closure evidence and do not rerun it unchanged.

## Canonical source

- repository: `ceritaantarkita-req/ecorione`
- branch: `main`
- source revision: `b9e837c91eddbf23eeb5c5468d4982013ca54363`
- provider: `openrouter`
- pricing identity: `claude-sonnet-4-5-20250929`
- explicit operator cap: `US$0.25`
- formal shape: 5 tasks × 2 repeats × 2 lanes = 20 intended model calls

A first authorization check for Attempt 2 stopped before any provider call because the harness compared the cumulative durable ceiling (`US$1`) directly against the per-run authorization (`US$0.25`). The operator then temporarily set the daily durable ceiling to `US$0.25`; preflight passed with `effectiveCeilingUsd=0.25`, `hostedCallsEnabled=true`, OpenRouter credential present, and process kill switch explicitly opened for the authorized run.

## Observed paid execution

The paid execution stopped on the fifth intended call. Four `incident-triage` calls completed and settled:

- full-inline pair 1: `$0.005814`
- ECX-auto pair 1: `$0.003714`
- full-inline pair 2: `$0.006024`
- ECX-auto pair 2: `$0.003714`

Known settled provider-billed amount from Attempt 2 before the failure: **`$0.019266`**.

The next call, `procurement-award` full-inline pair 1, reached OpenRouter and returned an HTTP-success response without usable completion text. The Connect boundary introduced after Attempt 1 correctly rejected that response as `502 UPSTREAM_UNAVAILABLE` rather than accepting/caching it as a zero-quality completion. The operator wrapper then set runtime `hostedCallsEnabled=false` in `finally`.

No closure-eligible W18 evidence or summary file was emitted.

## Durable ledger after Attempt 2

The post-run ledger inspection reported:

- total entries for 2026-09-17: `13`
- settled: `12`
- uncertain: `1`
- conservative committed amount: `$0.153423`
- daily limit after the operator returned to the normal configuration: `$1`
- remaining conservative daily headroom: `$0.846577`

The single uncertain reservation is the rejected `procurement-award` provider call and retains its pre-dispatch reservation of **`$0.107157`**. This reservation must not be manually rewritten: the historical response body is no longer available to reconstruct a trustworthy provider-billed amount.

Across Attempt 1 and the four settled calls from Attempt 2, known settled provider-reported actual cost is **`$0.046266`**. The larger `$0.153423` ledger committed amount is conservative admission accounting because the uncertain `$0.107157` reservation is counted at its full reserved amount; it is not evidence that OpenRouter billed that amount.

## Diagnosis

Attempt 2 proves the Attempt 1 fail-closed response validation works, but it exposed a second accounting/diagnostic ordering issue:

1. the OpenAI-compatible adapter rejected the empty completion before propagating safe response diagnostics/billing authority to the completion pipeline;
2. the completion pipeline therefore had no authoritative provider cost available in the thrown error and conservatively marked the reservation `uncertain`;
3. the W18 authorization guard also conflated a cumulative durable ceiling with a per-run authorization instead of checking the authorization against remaining durable headroom.

## Required fix before another paid call

1. Capture only safe HTTP-success diagnostics before rejecting an unusable completion: response model, finish reason, aggregate input/output token counts, and provider-reported `usage.cost` when valid. Never persist or expose prompts, document content, API keys, or the raw provider body.
2. When a rejected provider response still carries authoritative billed cost, settle its reservation to that cost before rethrowing the provider error. Keep `uncertain` only when billing outcome is genuinely unavailable/ambiguous.
3. Preserve the current rule that a pinned paid OpenRouter success with `usage.cost <= 0` is not acceptable closure evidence; if the provider explicitly reported that value, it may still be used solely to reconcile accounting for the rejected response.
4. Change W18 authorization so the per-run cap is checked against **remaining durable headroom**, not against the cumulative configured ceiling itself.
5. Regression-test all of the above using mocked providers only and merge through normal CI/Product Eval gates.
6. Only after the merged source is synchronized locally and a zero-spend preflight passes may a separate one-call `procurement-award/full-inline` diagnostic be considered. That call requires a new explicit spend authorization.

W18 remains open.
