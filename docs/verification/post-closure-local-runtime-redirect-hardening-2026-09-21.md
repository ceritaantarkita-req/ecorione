# Post-closure local-runtime redirect fail-closed hardening — 2026-09-21

Status: **BOUNDED MAINTENANCE SECURITY FIX / PR IS THE EXACT-HEAD MERGE AUTHORITY**

## Finding

ECORIONE already restricts `localBaseUrl` to loopback/private targets by default, with a separate explicit public-host override. The local completion request and local provenance request still used Fetch's default redirect-follow behavior.

That leaves a redirect escape: a loopback/private runtime could return a 30x to another host, causing local prompt/context data or provenance traffic to leave the validated base URL boundary.

## Fix boundary

The maintenance patch:

- adds `redirect: "error"` to local OpenAI-compatible completion requests;
- adds `redirect: "error"` to local-model provenance `/api/tags` requests;
- adds deterministic regression coverage proving local completion redirects are not followed;
- asserts provenance fetches are explicitly issued in fail-closed redirect mode;
- extends release-security acceptance so both local-runtime redirect controls remain continuously gated.

## Non-claims

This change does **not**:

- change local-runtime URL allow/deny policy;
- make Ollama mandatory;
- change model identity semantics or digest verification;
- change local/hosted route selection;
- make a hosted provider call or consume provider spend;
- mutate staging or production;
- open a new PE, PCS, F6, Batch, or W-series scope.

PR checks are the authority for exact-head test and merge status.
