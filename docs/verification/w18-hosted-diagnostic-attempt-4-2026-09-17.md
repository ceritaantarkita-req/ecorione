# W18 hosted diagnostic attempt 4 — 2026-09-17

## Status

**PASS as diagnostic evidence only.** This is not W18 closure evidence.

A fresh, separate formal-run authorization was later granted on 2026-09-18 for one formal W18 attempt up to `US$0.25`; that later authorization must not be confused with the `US$0.11` diagnostic authorization recorded here.

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
- explicit diagnostic cap: `US$0.11`

## Admission and spend evidence

Pre-dispatch conservative reservation estimate was `US$0.107374`, below the explicit `US$0.11` diagnostic cap. Durable headroom at start was `US$0.846577`.

The successful provider call reported:

- input tokens: `2002`
- output tokens: `45`
- billed cost authority (`OpenRouter usage.cost`): `US$0.006681`
- durable reservation: `US$0.107374`
- durable settlement actual: `US$0.006681`
- settlement: `settled`
- overrun: `US$0`
- exact cache hit: `false`

## Quality gate

The returned JSON matched all three expected procurement fields exactly:

- supplier: `Boreal Systems`
- lead time: `12` days
- maximum first batch: `320` units

Quality score was `1` (`3/3` matched), and the diagnostic gate reported `pass=true` with no failures.

## Local diagnostic evidence

```text
.ecorione/evidence/w18-hosted-diagnostic-2026-09-17T15-32-55-247Z.json
```

The raw local artifact is diagnostic-only and `closureEligible=false`.

## Postflight verification

A later zero-spend preflight on synchronized `main` `9f95d184c6a59da527fd23454fed06065a5738fe` confirmed the expected settlement and safe runtime state:

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

The pre-Attempt-4 committed value was `$0.153423`; adding the settled Attempt 4 actual `$0.006681` gives exactly `$0.160104`.

Known settled provider actual across W18 Attempts 1–4 is:

```text
Attempt 1 = 0.027000
Attempt 2 = 0.019266
Attempt 3 = 0
Attempt 4 = 0.006681
----------------------
known actual = 0.052947
```

The current committed `$0.160104` reconciles exactly as:

```text
known settled actual 0.052947
+ historical Attempt 2 uncertain reservation 0.107157
= committed 0.160104
```

Therefore Attempt 4 created no extra uncertain reservation and no accounting leak.

## Interpretation

Attempts 2 and 3 failed at `procurement-award/full-inline` when OpenRouter produced an unusable HTTP-success completion. Attempt 3 exposed `finishReason=content_filter` with `routingProvider=Amazon Bedrock`, one output token, and authoritative billed cost `US$0`.

After W18 routing was pinned Anthropic-only with provider fallback disabled, the same diagnostic task produced a usable completion, authoritative positive billing evidence, exact extraction quality `1`, and a settled durable spend record.

Success evidence proves the request policy was Anthropic-only and the response model was `anthropic/claude-sonnet-4.5`. The current success response surface does not persist a separate routed-provider metadata field, so this document does not claim an independently recorded success-path `routingProvider` value beyond the enforced request policy.

## Formal-run handoff — 2026-09-18

Formal W18 remains **NOT CLOSED** until the 20-call experiment passes.

A fresh authorization has been granted for **one formal W18 attempt, maximum US$0.25**. Because Connect's spend ledger uses UTC day keys, formal startup must derive current UTC-day committed spend at execution time and set the temporary daily ceiling to:

```text
currentCommitted + 0.25
```

Do not hardcode `$0.410104` after UTC rollover or unrelated hosted spend.

See `docs/verification/w18-formal-run-readiness-2026-09-18.md` for the complete admission/cleanup boundary.
