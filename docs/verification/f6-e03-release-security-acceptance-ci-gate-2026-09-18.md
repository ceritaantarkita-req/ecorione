# F6-E03 — Continuous Release-Security Acceptance CI Gate

Date: **2026-09-18**

Status: **IMPLEMENTED / IN REVIEW**

## Scope

F6-E03 follows F6-E02 and closes a concrete continuous-gating gap:

- `scripts/release-security-acceptance.mjs` already protects multiple release/security invariants;
- normal `.github/workflows/ci.yml` did not execute that acceptance directly.

The implementation now:

1. adds a named **Release security acceptance** step to the normal CI `verify` job;
2. executes `node scripts/release-security-acceptance.mjs` on every normal CI run;
3. extends the release-security acceptance itself so manual/release invocation fails if the named CI step or exact command disappears.

## Boundary

This is deterministic repository-side governance only.

It checks existing release-security invariants encoded by the acceptance script, including:

- required release/security files;
- no application Docker socket mount;
- operator Basic Auth on settings path;
- shared auth/rate-limit hardening;
- settings/Flow redirect and SSRF boundaries;
- MCP credential/HTTPS/stdio allowlist boundaries;
- no `:latest` Docker image;
- F6-E02 dependency-review package script and CI wiring;
- F6-E03 release-security acceptance CI wiring.

It does **not** prove:

- live registry/CVE/advisory freshness;
- deployment/public-edge correctness;
- production SLA/SLO;
- provider/model behavior.

## No runtime/provider mutation

F6-E03 makes:

- no model/provider call;
- no hosted spend;
- no W18 rerun;
- no VPS/Cloudflare mutation.

## Closure gate

Closure requires exact-head CI PASS with the new **Release security acceptance** step itself green, Product Eval PASS if triggered, guarded merge, then canonical docs closure sync.
