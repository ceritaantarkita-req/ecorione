# Post-closure maintenance checkpoint 2 — 2026-09-21

Status: **BOUNDED MAINTENANCE CLOSED THROUGH PR #237 / NO NEW ROADMAP OPENED**

## Safety boundary

This checkpoint closes the second bounded maintenance slice after the earlier PR #232 checkpoint.

Rules preserved during this slice:

- `main` remains repository source of truth;
- one proven defect scope per implementation PR;
- merge only after exact-head CI/Product Eval and every relevant acceptance gate pass;
- no production promotion;
- no Cloudflare/public-edge activation;
- no paid-provider/W18 rerun;
- no weakening of secret-history, release-security, or MCP external HTTPS gates;
- historical evidence remains historical and is not rewritten;
- repository merge does not itself prove a newer SumoPod staging deployment.

Implementation checkpoint immediately before this docs convergence:

```text
443ed254f7b4c5c3880387872e882e954602452b
```

## Closed maintenance PRs

| PR | Exact implementation head | Merge commit | Verified boundary | Exact-head gates |
| --- | --- | --- | --- | --- |
| #234 | `df17085886e544091a1e38c8dab32e34047386f5` | `c6b083e38f5843ccc37f51247f59b8f7ff345264` | Sync public MCP forwarding is timeout-bounded and redirect-fail-closed; malformed JSON/network failures map to sanitized explicit upstream errors. | CI #1726 PASS; Product Eval #965 PASS; MCP External HTTPS #912 PASS |
| #235 | `ac826333798fd72a63f63b486aaaca54fd9ffb91` | `45b4deeb3d6caa23b8f9a98ae184b59ad48f44df` | Connect credential-vault mutations use an exclusive filesystem lock; active contention returns retryable `503 CREDENTIAL_VAULT_BUSY`. | CI #1722 PASS; Product Eval #961 PASS |
| #236 | `71a6b282ef0690c4dff9054a436332e5fb2186bc` | `b618d2877bdb38d61a1d46dcf5983602c26a40d2` | Sandbox idempotency execution acquires an exclusive per-key lease before authority/effect execution; concurrent duplicate execution returns `409 SANDBOX_EXECUTION_BUSY`. | CI #1727 PASS; Product Eval #966 PASS |
| #237 | `942937c4cd33ec8731ad6ad5e5af9c4ffafba841` | `443ed254f7b4c5c3880387872e882e954602452b` | Default MCP JWKS retrieval has a bounded 10s timeout while preserving redirect fail-closed behavior and `502` dependency-failure semantics. | CI #1730 PASS; Product Eval #969 PASS; MCP External HTTPS #914 PASS |

## Preserved correctness and security invariants

- Workspace and owner authority boundaries are unchanged.
- Hub remains capability/policy/approval authority.
- Connect remains credential/provider/MCP owner.
- Temporal remains the durability/timer/retry owner for Flow.
- No second scheduler, retry database, graph authority, or provider fallback was introduced.
- Public MCP OAuth issuer/audience/signature/scope validation semantics remain unchanged.
- Credential-bearing and trust-root redirects remain fail-closed.
- No release-security, secret-history, dependency, toolchain, or external-MCP acceptance gate was bypassed.

## Runtime/staging claim boundary

This checkpoint is repository evidence.

It does **not** prove that SumoPod staging is running `443ed254f7b4c5c3880387872e882e954602452b`. The latest proven staging application evidence remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

A later explicit deployment + runtime verification record is required before changing that claim.

Staging remains distinct from production. Same-host backup evidence remains distinct from off-host disaster-recovery evidence.

## Current boundary after checkpoint

- PE-00..PE-08 — CLOSED / PASS
- PCS-00..PCS-10 — CLOSED / PASS
- bounded maintenance through PR #237 — CLOSED at repository boundary
- active implementation queue — NONE
- production promotion — DEFERRED / separate explicit gate
- Cloudflare named Tunnel/public edge — optional / not implicitly authorized
- paid W18 rerun — closed / not authorized
- AutoClick and L4 autonomy — deferred by design
