# Post-closure W18 cleanup model preservation — 2026-09-21

Status: **BOUNDED MAINTENANCE FIX / PR #222 IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

The formal W18 operator wrapper deliberately forces `hostedCallsEnabled=false` during cleanup and restores the prior hosted provider when available.

The persisted runtime-settings contract also resets `hostedModel` to `governed` whenever `hostedProvider` changes without an explicit hosted model. The wrapper previously restored only the provider. Therefore a zero-spend preflight or formal-run cleanup could unintentionally erase a previously selected provider-compatible hosted model.

This is a state-preservation defect. It is not authorization to reopen W18 or make another paid provider call.

## Fix boundary

PR #222:

- keeps cleanup fail-safe with `hostedCallsEnabled=false`;
- restores the prior `hostedProvider + hostedModel` pair when the prior runtime snapshot contains both;
- leaves unrelated runtime settings untouched;
- adds deterministic unit regression coverage for the cleanup patch;
- requires no hosted call, provider credential, W18 authorization, staging mutation, or production mutation.

## Non-claims

This maintenance fix does **not**:

- rerun W18;
- refresh hosted-economics evidence;
- consume provider spend;
- enable Hosted after cleanup;
- change W18 authorization limits;
- open a new W-series, F6, PE, PCS, or Batch scope.

## Verification

PR #222 is the authoritative record for exact-head CI, Product Eval, review, and merge outcome. The repository's normal gates must pass without weakening any existing security/release check.
