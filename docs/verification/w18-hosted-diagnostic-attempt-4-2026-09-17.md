# W18 hosted diagnostic attempt 4 — 2026-09-17

## Status

PASS as diagnostic evidence only. This is not W18 closure evidence and does not authorize the formal 20-call run.

## Repository and routing profile

- branch: `main`
- source revision: `a4382135d2d2729546e517b1bc6337542664f4ee`
- provider: `openrouter`
- runtime model response: `anthropic/claude-sonnet-4.5`
- pricing identity: `claude-sonnet-4-5-20250929`
- routing request policy: `provider.only=["anthropic"]`
- routing fallbacks: disabled
- diagnostic task/lane: `procurement-award/full-inline`
- measured hosted calls: exactly 1
- explicit operator cap: `US$0.11`

## Admission and spend evidence

Pre-dispatch conservative reservation estimate was `US$0.107374`, below the explicit `US$0.11` cap. Durable headroom at start was `US$0.846577`.

The successful provider call reported:

- input tokens: `2002`
- output tokens: `45`
- billed cost authority (`OpenRouter usage.cost`): `US$0.006681`
- durable reservation: `US$0.107374`
- durable settlement actual: `US$0.006681`
- settlement: `settled`
- overrun: `US$0`
- exact cache hit: `false`

The prior committed ledger state before this call was `US$0.153423`; therefore the expected committed total after successful settlement is `US$0.160104`, subject to the next zero-spend preflight verification against the durable ledger.

## Quality gate

The returned JSON matched all three expected procurement fields exactly:

- supplier: `Boreal Systems`
- lead time: `12` days
- maximum first batch: `320` units

Quality score was `1` (`3/3` matched), and the diagnostic gate reported `pass=true` with no failures.

## Evidence path

Local diagnostic evidence was written to:

```text
.ecorione/evidence/w18-hosted-diagnostic-2026-09-17T15-32-55-247Z.json
```

The raw local evidence remains diagnostic-only and `closureEligible=false`.

## Interpretation

Attempts 2 and 3 failed at `procurement-award/full-inline` when OpenRouter produced an unusable HTTP-success completion. Attempt 3 exposed `finishReason=content_filter` with `routingProvider=Amazon Bedrock`, one output token, and authoritative billed cost `US$0`.

After W18 routing was pinned to Anthropic-only with provider fallback disabled, the same diagnostic task produced a usable completion, authoritative positive billing evidence, exact extraction quality `1`, and a settled durable spend record.

This supports proceeding toward the formal W18 experiment, but does not replace it. The formal 20-call run still requires a fresh explicit monetary authorization, a clean zero-spend preflight, sufficient durable headroom, and the Anthropic-only OpenRouter routing policy on the Connect process.