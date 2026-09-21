# Post-closure maintenance checkpoint 4 — 2026-09-21

Status: **BOUNDED MAINTENANCE CLOSED THROUGH PR #242 / NO NEW ROADMAP OPENED**

## Safety boundary

This checkpoint records the next bounded maintenance defect after the PR #240 checkpoint.

Rules preserved during this slice:

- `main` remains repository source of truth;
- one proven defect scope per implementation PR;
- merge only after exact-head CI/Product Eval and every relevant acceptance gate pass;
- no production promotion;
- no Cloudflare/public-edge activation;
- no paid-provider/W18 rerun;
- no weakening of secret-history, release-security, dependency, toolchain, or acceptance gates;
- historical evidence remains historical and is not rewritten;
- repository merge does not itself prove a newer SumoPod staging deployment.

Implementation checkpoint immediately before this docs convergence:

```text
47cbeaa8760debbfde87cff7cb7a828037a2829b
```

## Closed maintenance PR

| PR | Exact implementation head | Merge commit | Verified boundary | Exact-head gates |
| --- | --- | --- | --- | --- |
| #242 | `db8a8f6068a40e47187a2142e6801e975e749276` | `47cbeaa8760debbfde87cff7cb7a828037a2829b` | Ai server-side forwarding to Flow is timeout-bounded at 10 seconds by default; timeout/network failure keeps the existing sanitized `502 UPSTREAM_UNAVAILABLE` boundary and owner redirects remain fail-closed. | CI #1743 PASS; Product Eval #982 PASS; PCS-06 Integrated Browser Acceptance #18 PASS |

The earlier unmerged candidate head `7b21c96e6a18b46e333e145b8820381234b8c0bf` stopped in CI #1742 at the Prettier format check only. It was not merged. The formatting-only correction produced the exact implementation head above, which reran the full relevant gate set successfully.

No post-merge push-run claim is made in this checkpoint because the available repository connector does not expose those push-triggered runs for this merge SHA.

## Preserved correctness and security invariants

- Workspace and owner authority boundaries are unchanged.
- Hub remains capability/policy/approval authority.
- Flow remains graph/Trigger owner and Temporal remains execution durability/timer/retry owner.
- The Ai proxy still rejects unsafe owner paths and refuses redirects while carrying the internal bearer token.
- Flow HTTP status/body semantics remain unchanged; only stalled transport latency is bounded.
- Timeout/network failure remains a sanitized `502 UPSTREAM_UNAVAILABLE`; internal Flow diagnostics are not surfaced.
- The default timeout is 10 seconds and the internal override is restricted to 1..60000 ms for deterministic tests.
- Release-security acceptance pins the timeout invariant.
- No second scheduler, retry database, graph authority, provider fallback, or new product feature was introduced.
- No release-security, secret-history, dependency, toolchain, or acceptance gate was bypassed.

## Runtime/staging claim boundary

This checkpoint is repository evidence.

It does **not** prove that SumoPod staging is running `47cbeaa8760debbfde87cff7cb7a828037a2829b`. The latest proven staging application evidence remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

A later explicit deployment + runtime verification record is required before changing that claim.

Staging remains distinct from production. Same-host backup evidence remains distinct from off-host disaster-recovery evidence.

## Current boundary after checkpoint

- PE-00..PE-08 — CLOSED / PASS
- PCS-00..PCS-10 — CLOSED / PASS
- bounded maintenance through PR #242 — CLOSED at repository boundary
- active implementation queue — NONE
- production promotion — DEFERRED / separate explicit gate
- Cloudflare named Tunnel/public edge — optional / not implicitly authorized
- paid W18 rerun — closed / not authorized
- AutoClick and L4 autonomy — deferred by design
