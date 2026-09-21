# Post-closure multimodal redirect fail-closed hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

The Connect HTTP multimodal adapter can be configured with a hosted endpoint and a bearer credential reader. Its Fetch call still used default redirect-follow behavior, so a hosted adapter redirect could carry a credential-bearing request into a redirect chain.

## Fix boundary

The maintenance patch:

- adds `redirect: "error"` to the HTTP multimodal adapter;
- adds deterministic hosted-adapter regression coverage proving a 302 target is not followed;
- extends release-security acceptance so the multimodal redirect control remains continuously gated.

The same fail-closed redirect behavior also applies to local HTTP multimodal adapters, which avoids redirect-based endpoint escape even when no bearer is present.

## Non-claims

This change does **not**:

- make a hosted multimodal call;
- consume provider spend;
- change route selection, sync-class policy, cost kill switches, or spend accounting;
- change hosted credentials or models;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head test and merge status.
