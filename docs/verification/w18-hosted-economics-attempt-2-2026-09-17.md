# W18 hosted economics — Attempt 2 failure record (2026-09-17)

Status: **HISTORICAL FAILED ATTEMPT / NOT CLOSURE EVIDENCE**.

Do not reuse this attempt as closure evidence and do not manually rewrite its historical uncertain reservation.

## Canonical source

- source revision: `b9e837c91eddbf23eeb5c5468d4982013ca54363`
- provider: `openrouter`
- pricing identity: `claude-sonnet-4-5-20250929`
- explicit operator cap: `US$0.25`
- formal shape: 5 tasks × 2 repeats × 2 lanes = 20 intended model calls

## Observed execution

Four `incident-triage` calls completed and settled:

- full-inline pair 1: `$0.005814`
- ECX-auto pair 1: `$0.003714`
- full-inline pair 2: `$0.006024`
- ECX-auto pair 2: `$0.003714`

Known settled provider-billed amount from Attempt 2: **`$0.019266`**.

The next intended call, `procurement-award` full-inline pair 1, reached OpenRouter and returned HTTP-success without usable completion text. The fail-closed boundary added after Attempt 1 correctly converted this into `502 UPSTREAM_UNAVAILABLE`. No closure-eligible W18 evidence was emitted.

## Durable ledger after Attempt 2

Post-run inspection reported:

```text
total entries = 13
settled = 12
uncertain = 1
conservative committed = 0.153423
daily limit = 1
remaining conservative daily headroom = 0.846577
```

The single uncertain reservation is the rejected `procurement-award` call and retains its pre-dispatch reservation of **`$0.107157`**. The historical response did not leave enough trustworthy billing information to reconstruct an actual charge, so this entry must remain conservative.

Across Attempt 1 and the four settled Attempt 2 calls, known settled provider actual was **`$0.046266`**. The larger committed value was admission accounting, not a claim that OpenRouter billed `$0.153423`.

## Failure diagnosis

Attempt 2 proved the Attempt 1 completion validation was working, but exposed two additional issues:

1. safe billing/response diagnostics were not yet propagated through the thrown provider error, so the rejected reservation had to remain `uncertain`;
2. the initial W18 authorization guard compared a per-run cap with a cumulative ceiling instead of remaining durable headroom.

Later fixes preserved safe response model/finish reason/token/cost diagnostics, settled rejected responses when authoritative provider cost exists, and changed W18 authorization to compare against remaining durable headroom.

## Current disposition — 2026-09-18

The historical uncertain `$0.107157` reservation remains intentionally untouched.

Subsequent diagnostics established:

- Attempt 3: same task/lane failed with `finishReason=content_filter`, `routingProvider=Amazon Bedrock`, `inputTokens=2002`, `outputTokens=1`, provider-reported cost `$0`; that diagnostic reservation settled to `$0`.
- Attempt 4: after OpenRouter provider routing was pinned Anthropic-only with fallback disabled, the same diagnostic passed with quality `1`, billed `$0.006681`, and durable settlement `settled`.
- Latest postflight committed ledger: `$0.160104`.
- Known settled provider actual through Attempt 4: `$0.052947`.
- `$0.052947 + $0.107157 = $0.160104`, reconciling the current committed ledger exactly.

Formal W18 is now **FORMAL RUN READY / NOT CLOSED**. See `docs/verification/w18-formal-run-readiness-2026-09-18.md`.
