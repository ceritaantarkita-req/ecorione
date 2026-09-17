# W18 hosted diagnostic attempt 3 — 2026-09-17

## Status

**FAIL / diagnostic evidence only.** Not closure evidence. The one-call authorization was consumed by exactly one provider dispatch.

## Repository and authorization

- branch: `main`
- source revision: `217b7a69927e57be3478af3800a0ef6c1e0913df`
- provider: `openrouter`
- pricing identity: `claude-sonnet-4-5-20250929`
- diagnostic task/lane: `procurement-award/full-inline`
- measured provider dispatches: exactly 1
- explicit operator cap: `US$0.11`
- conservative pre-dispatch reservation estimate: `US$0.107157`
- durable headroom at start: `US$0.846577`

## Provider failure

Connect rejected an OpenRouter HTTP-success response before usable completion:

```text
HTTP 502 UPSTREAM_UNAVAILABLE
responseModel = anthropic/claude-sonnet-4.5
finishReason = content_filter
routingProvider = Amazon Bedrock
inputTokens = 2002
outputTokens = 1
usageCostUsd = 0.00000000
```

No quality score could be produced because there was no usable completion.

## Accounting result

The provider explicitly reported authoritative billed cost `US$0`. The completion pipeline therefore settled the pre-dispatch reservation to `$0` rather than creating a second uncertain reservation.

Post-run durable state remained:

```text
dailyCommittedUsd = 0.153423
monthlyCommittedUsd = 0.153423
unsettledReservations = 1
effectiveHeadroomUsd = 0.846577
```

The one unsettled entry remained the historical Attempt 2 reservation only.

## Evidence behavior at this source revision

The diagnostic harness at this revision still threw on the 502 before it could persist a structured local diagnostic evidence document. The console output above is therefore the authoritative Attempt 3 operator evidence. Later PR #131 added sanitized failure-evidence persistence so subsequent diagnostic failures cannot disappear at this stage.

## Interpretation

The response model slug alone was insufficient to identify the actual routed backend. Attempt 3 showed that OpenRouter served the request through **Amazon Bedrock**, and that route returned `content_filter` on the synthetic procurement fixture.

This did not prove that Amazon Bedrock was universally responsible for earlier failures, but it supplied a concrete routed-provider fact for this diagnostic and justified testing deterministic provider routing before another paid attempt.

## Follow-up

Repository work then:

1. added safe OpenRouter routing-provider diagnostics;
2. added request-level OpenRouter provider pinning;
3. configured W18 diagnostic routing as `provider.only=["anthropic"]` with `allow_fallbacks=false`;
4. included routing policy bytes in the conservative reservation estimator;
5. regression-tested the pin and estimator without hosted spend.

Attempt 4 then repeated the same `procurement-award/full-inline` diagnostic under Anthropic-only routing and passed with quality `1`, billed cost `$0.006681`, and durable settlement `settled`.

Current status is **FORMAL RUN READY / NOT CLOSED**. See `docs/verification/w18-hosted-diagnostic-attempt-4-2026-09-17.md` and `docs/verification/w18-formal-run-readiness-2026-09-18.md`.
