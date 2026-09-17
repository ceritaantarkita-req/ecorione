# W18 — bounded one-call provider diagnostic harness

Status: **HARNESS READY / DIAGNOSTIC SPEND NOT AUTHORIZED**

Date: **2026-09-17**

This harness exists only to perform the follow-up required by the W18 Attempt 2 failure record: one `procurement-award` / `full-inline` call against the pinned OpenRouter route after the provider-diagnostic and settlement fixes have merged.

It is deliberately separate from the 20-call formal W18 closure runner.

## Scope

The diagnostic shape is fixed:

```text
task = procurement-award
mode = full-inline
measured hosted calls = 1
closureEligible = false
```

The diagnostic cannot establish W18 closure. Its only purpose is to verify that the previously failing provider path now returns a usable completion with authoritative provider-reported billed cost and settled durable accounting.

## Zero-spend preflight

After this harness is merged to `main`, synchronized locally, and the normal ECORIONE runtime is up:

```powershell
node .\scripts\w18-hosted-diagnostic.mjs --preflight
```

Preflight requires a clean synchronized `main`, healthy Connect, OpenRouter as the configured hosted provider, an available credential vault, `openrouter/messages` configured, and a durable spend budget. It makes no hosted provider call.

## Paid diagnostic authorization

A paid diagnostic requires a new, diagnostic-specific current-process opt-in:

```text
ECORIONE_W18_DIAGNOSTIC_ALLOW_SPEND=YES
ECORIONE_W18_DIAGNOSTIC_MAX_SPEND_USD=<positive USD cap>
```

The diagnostic cap must also:

- fit within remaining durable spend headroom;
- not exceed the diagnostic absolute safety ceiling of **US$0.25**;
- run with `ECORIONE_COST_KILL_SWITCH=0`;
- run only while runtime `hostedCallsEnabled=true`.

The formal-run variables `ECORIONE_W18_ALLOW_SPEND` and `ECORIONE_W18_MAX_SPEND_USD` do **not** authorize this diagnostic. This prevents a diagnostic authorization from accidentally authorizing the full 20-call closure runner, and vice versa.

## Diagnostic pass gate

The single response passes only when all of the following are true:

- task is exactly `procurement-award`;
- mode is exactly `full-inline`;
- provider is `openrouter`;
- pricing identity is exactly `claude-sonnet-4-5-20250929`;
- provider `responseModel` is present;
- exact cache was not hit;
- exact extraction quality score is 1;
- provider-billed cost is finite and greater than zero;
- durable spend settlement is `settled`;
- durable `actualUsd` matches the completion billed cost;
- actual billed cost does not exceed the explicit diagnostic cap.

A pass is printed as:

```text
PASS W18 one-call provider diagnostic (NOT closure evidence)
```

A rejected OpenRouter response still fails closed. The HTTP error surfaced by Connect may include only the safe provider diagnostics introduced by the W18 provider-diagnostic fix; prompts, fixture contents, API keys, and raw provider bodies must not be persisted or printed by this harness.

## Next boundary

Only after this one-call diagnostic passes may the normal 20-call W18 hosted economics run be considered. That later formal run requires its own separate explicit spend authorization and remains subject to all existing W18 closure gates.
