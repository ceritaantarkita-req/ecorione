# Post-closure maintenance checkpoint 3 — 2026-09-21

Status: **BOUNDED MAINTENANCE CLOSED THROUGH PR #240 / NO NEW ROADMAP OPENED**

## Safety boundary

This checkpoint closes the third bounded maintenance slice after the earlier PR #237 checkpoint.

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
eb4ac86da19bc006009e1a2260f14c119e7997e5
```

## Closed maintenance PRs

| PR | Exact implementation head | Merge commit | Verified boundary | Exact-head gates |
| --- | --- | --- | --- | --- |
| #239 | `273b27d33992048bb6227d478999991122fc0df4` | `ccffb65a37643551fd492d6979181d612151748c` | Sandbox Hub/RnD control-plane calls are timeout-bounded so a stalled owner service cannot hold one idempotency lease indefinitely. | CI #1735 PASS; Product Eval #974 PASS |
| #240 | `fa431b1072b48f6ec5dca1364e43bb29c659bff1` | `eb4ac86da19bc006009e1a2260f14c119e7997e5` | Verified Connect webhook forwarding to Flow is timeout-bounded; transport/timeout failures become sanitized `502 UPSTREAM_UNAVAILABLE`, while stable `deliveryId` + Flow dedupe preserve safe caller retry. | CI #1738 PASS; Product Eval #977 PASS |

PR #240 had an earlier unmerged candidate head `d29af46ae26344f4745ff4d36692f46656ae356e` whose CI #1737 stopped at Prettier format check. That candidate was not merged. The formatted exact head shown above reran the full gates and is the merge authority.

## Preserved correctness and security invariants

- Workspace and owner authority boundaries are unchanged.
- Hub remains capability/policy/approval authority.
- Connect remains credential/provider/MCP/webhook ingress owner.
- Flow remains Trigger/dedupe owner and Temporal remains execution durability/timer/retry owner.
- Sandbox still leases an idempotency key before authority/effect execution; bounded control-plane latency only prevents indefinite lease occupation.
- Public webhook callers still cannot choose Workspace, Project, Flow, version, capability, or autonomy.
- Webhook retry must reuse the provider-stable `deliveryId`; Flow dedupe resolves the same Trigger + delivery identity to one logical dispatch.
- No second scheduler, retry database, graph authority, or provider fallback was introduced.
- No release-security, secret-history, dependency, toolchain, or acceptance gate was bypassed.

## Runtime/staging claim boundary

This checkpoint is repository evidence.

It does **not** prove that SumoPod staging is running `eb4ac86da19bc006009e1a2260f14c119e7997e5`. The latest proven staging application evidence remains:

```text
revision: 0f332c73dc7b363bffecdeecae921d805d5ae131
image:    staging-0f332c73dc7b
```

A later explicit deployment + runtime verification record is required before changing that claim.

Staging remains distinct from production. Same-host backup evidence remains distinct from off-host disaster-recovery evidence.

## Current boundary after checkpoint

- PE-00..PE-08 — CLOSED / PASS
- PCS-00..PCS-10 — CLOSED / PASS
- bounded maintenance through PR #240 — CLOSED at repository boundary
- active implementation queue — NONE
- production promotion — DEFERRED / separate explicit gate
- Cloudflare named Tunnel/public edge — optional / not implicitly authorized
- paid W18 rerun — closed / not authorized
- AutoClick and L4 autonomy — deferred by design
