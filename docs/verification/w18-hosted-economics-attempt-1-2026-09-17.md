# W18 hosted economics — Attempt 1 failure record (2026-09-17)

Status: **HISTORICAL FAILED ATTEMPT / NOT CLOSURE EVIDENCE**.

Do not reuse this attempt as closure evidence and do not rerun it unchanged. This document preserves the failure that led to later provider-boundary hardening.

## Canonical source

- repository: `ceritaantarkita-req/ecorione`
- branch: `main`
- source revision: `982d08b1b7d230d47723e9ef50f9fcbc20bf15ba`
- provider: `openrouter`
- pricing identity: `claude-sonnet-4-5-20250929`
- explicit operator cap: `US$1`
- durable daily/monthly budget: `US$1 / US$10`
- formal shape: 5 tasks × 2 repeats × 2 lanes = 20 intended model calls

The zero-spend preflight passed before the formal run with the OpenRouter vault credential present, runtime hosted calls enabled only for the bounded run, and the process cost kill switch explicitly opened.

## Observed paid execution

The run stopped after 8 of 20 intended calls:

- `incident-triage` full-inline pair 1: `$0.006021`
- `incident-triage` ECX-auto pair 1: `$0.003711`
- `incident-triage` full-inline pair 2: `$0.006021`
- `incident-triage` ECX-auto pair 2: `$0.003711`
- `procurement-award` full-inline pair 1: `$0.000000`
- `procurement-award` ECX-auto pair 1: `$0.003768`
- `procurement-award` full-inline pair 2: `$0.000000`
- `procurement-award` ECX-auto pair 2: `$0.003768`

Observed cumulative provider-billed amount: **`$0.027000`**.

`incident-triage` passed its task gate. `procurement-award` failed because both full-inline repetitions had quality score != 1 and billed cost `0`; the automatic-cost comparison also became invalid. The harness stopped and emitted no closure-eligible W18 evidence.

## Failure diagnosis

Attempt 1 exposed a provider-boundary integrity gap: an HTTP 200 OpenRouter response could be accepted despite empty/unusable completion content, and `usage.cost=0` could be treated as a valid paid-model completion. That could create misleading zero-cost/zero-quality evidence.

The required fixes were subsequently implemented and tested:

1. reject HTTP-success without usable completion text;
2. reject non-positive billed cost for pinned paid OpenRouter closure evidence;
3. preserve safe provider diagnostics on rejection;
4. settle rejected-response accounting when authoritative cost exists;
5. keep unknown historical billing conservative rather than inventing a value.

## Current disposition — 2026-09-18

Later work did **not** rewrite this failed evidence.

- Attempt 2 confirmed the unusable-completion boundary now failed closed.
- Attempt 3 isolated a `content_filter` response served through `routingProvider=Amazon Bedrock` with provider-reported cost `$0`.
- OpenRouter routing was then pinned to `provider.only=["anthropic"]` with fallback disabled.
- Attempt 4 repeated `procurement-award/full-inline` and passed with exact quality `1`, positive billed cost `$0.006681`, durable settlement `settled`, and no cache hit.
- Latest postflight committed ledger is `$0.160104`, including the historical Attempt 2 uncertain reservation.
- Formal W18 remains open until a fresh 20-call closure run passes.

Current formal-run readiness is documented in `docs/verification/w18-formal-run-readiness-2026-09-18.md`.
