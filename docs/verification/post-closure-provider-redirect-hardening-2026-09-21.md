# Post-closure provider redirect fail-closed hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

A follow-up security audit after internal owner redirect hardening found that hosted-provider requests still used Fetch's default redirect-follow behavior while carrying provider credentials.

Affected adapters:

- Anthropic direct API requests carrying `x-api-key`;
- the shared OpenAI-compatible adapter used by OpenAI and OpenRouter, carrying `Authorization: Bearer <api-key>`.

The provider endpoints are fixed ECORIONE constants, but redirect handling still needs to fail closed so credentials are never forwarded through a provider-origin redirect chain.

## Fix boundary

The maintenance patch:

- adds `redirect: "error"` to Anthropic requests;
- adds `redirect: "error"` to the shared OpenAI-compatible provider adapter;
- adds deterministic redirect regressions for Anthropic and OpenRouter/OpenAI-compatible traffic;
- extends release-security acceptance so both provider adapter controls remain continuously gated.

## Non-claims

This change does **not**:

- make a hosted provider call;
- consume W18 authorization or provider spend;
- alter provider/model selection;
- alter budget accounting;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head test and merge status.
