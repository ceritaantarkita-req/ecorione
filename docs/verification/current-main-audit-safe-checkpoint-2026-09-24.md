# Current-main audit safe checkpoint — 2026-09-24

Status: **SAFE / AUDIT MERGED / IMPLEMENTATION NOT STARTED / RESUMABLE**

Audit merge on `main`:

```text
audit_merge=da26196071302d3ffc44d3cd5d0ed8d81e9020c2
audit_pr=#286
audit_pr_head=bb872947942ff2cd54d65aabb18c8cb8db54cab1
```

Tracking:
- critical human-auth finding: Issue #287;
- deferred DR-2 physical-independence scope: Issue #277.

## What has been completed

The requested two-track audit is complete:

1. current repository/product architecture, code, UI/UX, reliability, security, maintainability, and operations review;
2. current repository versus proven staging/runtime parity review.

The full evidence is:

- [current-main-staging-audit-2026-09-24.md](current-main-staging-audit-2026-09-24.md).

No implementation fix is included in the audit merge.

## Repository/runtime parity result

Git-tree comparison confirmed exact product-code parity across historical staging, the original DR runtime, and the audit baseline:

```text
apps/     10339ff31ffde5a18c3ed2621b991212ee7281e3
services/ 137cb974fda63d6c6c87d623e0c222079dad5676
packages/ de1f62cfe4e9220d2efc0e2bce31cd4ba0e383b2
```

These trees are identical at:

- historical staging `52046db35e403babdda934881773c46bf2c57b68`;
- original DR runtime `b27c1e5833be0a0fccf3f525d82ae8853cd22113`;
- pre-audit current main `4143adf2185e82d5c8713dc6c148ba828b104d07`;
- audit-merged main `da26196071302d3ffc44d3cd5d0ed8d81e9020c2`.

Therefore there is **no pending user-facing product-code deployment drift** that needs a staging deploy merely to synchronize `apps/`, `services/`, or `packages/`.

Later repository drift is documentation, DR tooling/tests, recovery overlays, and audit evidence.

## Highest-priority findings

### A-00 — CRITICAL — missing human authentication on the general Ai edge

Current Caddy routing protects operator routes:

- `/ops*`;
- `/api/ops*`;
- `/settings*`;
- `/api/settings*`.

The fallback sends other Ai pages/APIs directly to Ai. Ai route handlers then inject `ECORIONE_INTERNAL_TOKEN` server-side when calling owner services.

The existing same-origin middleware is a CSRF boundary, **not user authentication**. Headerless curl/native mutation requests are intentionally allowed.

At the reviewed source/configuration boundary, any network client able to reach the Ai edge can therefore reach Project/history/chat and representative mutation surfaces without proving a human identity.

This finding is tracked in **Issue #287**.

Important boundary: this audit did **not** perform a fresh live SumoPod probe and does not claim current hostname uptime. Desktop Ai remains loopback-bound and is not evidence of internet exposure.

### A-12 — HIGH — remote bind can fail open without internal auth on direct starts

Guarded Compose requires `ECORIONE_INTERNAL_TOKEN`, but service startup code independently permits:

- `ECORIONE_ALLOW_REMOTE_BIND=1` -> `0.0.0.0`;
- missing service token -> bearer authentication disabled.

A direct/manual owner-service launch can therefore combine non-loopback bind with no bearer auth.

This is a latent direct-start/self-host configuration gap, not evidence that the guarded Compose staging topology currently lacks the token.

### A-01 — HIGH — internal HTTP timeout policy is incomplete

The shared internal HTTP client has no default timeout; several owner/service call sites do not provide a signal.

Some paths are already timeout-bounded, so current behavior is inconsistent rather than wholly unbounded.

Future correction should establish one internal-HTTP timeout policy and deterministic stalled-upstream tests.

### A-13 — MEDIUM — standalone Space Flow default uses the wrong port

Canonical Flow port is `17028`.

Standalone Space currently defaults Flow to `127.0.0.1:17029`, while Compose explicitly injects the correct `flow:17028`.

This is a confirmed standalone/default configuration defect, not a proven Compose staging failure.

### A-02 / A-03 — MEDIUM — Project UX/state correctness

Confirmed/bounded findings:

- virtual Project **All** is rendered as an interactive button but has no behavior;
- archived Project selection can leave stale `ecorione.projectId` browser state, which Ai/Work/Brain may reuse later.

### Product gaps recorded for later discussion

The audit also records, without authorizing implementation:

- Project settings/onboarding is thinner than the backend contract;
- Project Sources are reference bindings, not full upload/connector onboarding;
- Schedule backend is real/Temporal-backed but calendar/year/navigation/AI-assisted UX is incomplete;
- Brain graph is deterministic but becomes visually dense at allowed node counts and lacks pan/zoom;
- Brain does not yet show the full intended knowledge/file/memory graph;
- major frontend page modules are large and increasingly concentrated;
- Compose application-service readiness is weaker than the repository acceptance tooling;
- browser product remains intentionally personal-workspace-first.

## Positive audit result

The audit did **not** find evidence requiring an architecture rewrite.

Current owner boundaries remain coherent:

- Hub = policy/orchestration/project authority;
- Context = durable memory/context owner;
- Connect = provider/runtime/credential/MCP boundary;
- Flow + Temporal = automation definition + durable execution;
- Artifact = artifact bytes/metadata owner;
- Sandbox = side-effect execution boundary;
- Space = composition owner;
- Sync = device/ciphertext relay + MCP bridge;
- RnD = trace/evidence/dataset surface.

No cross-service database ownership violation was found in the audited dependency topology.

No new autonomous service, graph database, or scheduler is justified by this audit.

## Safe project state

At this checkpoint:

```text
product implementation from audit findings: NOT STARTED
staging mutation for audit: NONE
fresh live staging probe: NONE
production promotion: DEFERRED
DR-2 checkpoint 2: DEFERRED / SAFE-PAUSED
DR-2 checkpoint 3+: NOT STARTED
current proven original-DR application runtime:
  b27c1e5833be0a0fccf3f525d82ae8853cd22113
  staging-b27c1e5833be
```

Original Off-host DR remains CLOSED / PASS at its documented boundary.

Local backup remains the interim backup posture. Optional encrypted Google Drive remains only a future secondary off-device copy until separately integrated and tested.

## Recommended next discussion boundary

Do **not** start a broad new roadmap automatically.

The next discussion should choose exactly one bounded implementation scope from the audit findings.

Recommended first scope:

> **A-00 — fail-closed human authentication on the general Ai edge.**

A future implementation checkpoint should define, before coding:

1. human-auth model and session/cookie boundary;
2. which Ai routes, if any, are intentionally public;
3. separation from MCP/OAuth protocol authentication;
4. compatibility with desktop loopback use;
5. unauthenticated negative-path tests for Projects/history/chat and representative mutations;
6. browser/CSRF behavior after authentication;
7. staging acceptance required after merge.

Only after that scope is explicitly authorized should implementation begin.

## Merge verification

PR #286 exact head passed:

```text
CI #1954 PASS
Product Eval #1193 PASS
```

Audit-merged main `da26196071302d3ffc44d3cd5d0ed8d81e9020c2` then passed:

```text
CI #1955 PASS
Product Eval #1194 PASS
Staging Deploy #673 gate PASS / deploy SKIPPED
Staging Deploy #674 gate PASS / deploy SKIPPED
```

The skipped deploy jobs are expected because staging deployment activation remains disabled. No application deployment or runtime mutation was introduced by the audit/docs merge.

The safe-checkpoint documentation PR #288 exact head `1133ad1a607927d1a25c98f6027c7bd77f795162` passed CI #1956 and Product Eval #1195, then merged as `76c093e597eba1d09881e2460aae13f5cf26ecbb`.

That merged checkpoint then passed:

```text
CI #1957 PASS
Product Eval #1196 PASS
Staging Deploy #677 gate PASS / deploy SKIPPED
Staging Deploy #678 gate PASS / deploy SKIPPED
```

This document is the safe resume point for the next discussion. Later docs-only bookkeeping may advance GitHub `main`, but it must not be treated as product/runtime mutation unless `apps/`, `services/`, `packages/`, deployment policy, or an explicit staging deployment changes.
