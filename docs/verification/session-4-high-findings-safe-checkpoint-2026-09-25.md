# ECORIONE — Session 4 HIGH Findings Safe Checkpoint — 2026-09-25

Status: **SAFE CHECKPOINT / SESSION 4 CLOSED-PASS / NO PENDING RUNTIME MUTATION**

## Purpose

This checkpoint records the exact resumable state after closing the remaining HIGH findings from the 2026-09-24 current-main + staging audit.

It is intentionally a discussion handoff. It does not authorize Session 5 implementation, DR-2 runtime work, production promotion, credential rotation, paid infrastructure, or unrelated product work.

## Exact repository/runtime baseline

Canonical repository main before this documentation-only checkpoint:

`2ee12fd454ade78ce1bf732390334726980e0451`

That commit is the merge of PR #309, **fix: bound internal owner HTTP requests**.

Merged-main gates:

- CI #2027 — PASS;
- Product Eval #1266 — PASS;
- MCP External HTTPS Acceptance #1030 — PASS.

Automatic Staging Deploy run #821 executed the deploy job through the governed restricted-SSH path and PASSed for exact SHA:

`2ee12fd454ade78ce1bf732390334726980e0451`

Final runtime evidence from that deploy:

- public auth bootstrap: PASS;
- representative private Ai reads/mutations: HTTP 401 + Basic challenge;
- MCP protected-resource metadata: HTTP 200;
- unauthenticated MCP: HTTP 401 + resource-metadata challenge;
- authenticated Operations: `healthy=true`;
- `serviceCount=9`;
- `unhealthyServices=[]`;
- exact-host `headSha == expectedSha == 2ee12fd454ade78ce1bf732390334726980e0451`;
- `cleanWorktree=true`;
- all 15 configured staging services running;
- `nonRunningServices=[]`;
- exact-host free disk before retention: `24.05 GiB`;
- capacity stabilization after retention: `25.11 GiB` free;
- current image: `staging-2ee12fd454ad`;
- recorded rollback image: `staging-e4810e0d7980`.

The helper emitted:

`PASS PCS-08 staging deploy sha=2ee12fd454ade78ce1bf732390334726980e0451 tag=staging-2ee12fd454ad`

## Session 4 closure

### A-12 — HIGH — CLOSED / PASS

Finding: owner services could be explicitly configured for non-loopback bind while `ECORIONE_INTERNAL_TOKEN` was absent, creating a latent fail-open direct/self-host configuration outside guarded Compose paths.

PR #308 implemented the closure:

- exact PR head: `50d117517b008c3106222d42c41870a3c438662b`;
- merge: `e4810e0d7980682028be67634fa430090fe9bf92`;
- exact-head CI #2020 — PASS;
- exact-head Product Eval #1259 — PASS;
- exact-head MCP External HTTPS #1023 — PASS;
- exact-head PCS-06 Integrated Browser Acceptance #29 — PASS.

Implementation:

- shared-server now exposes `bindHostForAuthenticatedService(token)`;
- loopback remains allowed without an internal token for local/test use;
- non-loopback owner bind throws before startup when the internal token is absent;
- RnD, Context, Connect, Hub, Artifact, Sandbox, Space and Flow production entrypoints use the fail-closed helper;
- Sync remains intentionally separate because it uses its owner/device authentication boundary;
- deterministic unit and source-contract tests lock the configuration matrix.

Merged-main automatic Staging Deploy #809 PASSed exact `e4810e0d...`, with public/MCP smoke, healthy Operations, exact-host identity, all 15 services running and capacity stabilization to `26.48 GiB`.

### A-01 — HIGH — CLOSED / PASS

Finding: internal owner/service HTTP calls could stall without a deadline because the shared `httpJson` boundary allowed no default timeout and some direct owner calls were also unbounded.

PR #309 implemented the closure:

- exact PR head: `75d17e6d223422a757e1423315ce2083ef0ef211`;
- merge/current runtime: `2ee12fd454ade78ce1bf732390334726980e0451`;
- exact-head CI #2026 — PASS;
- exact-head Product Eval #1265 — PASS;
- exact-head MCP External HTTPS #1029 — PASS;
- exact-head PCS-06 Integrated Browser Acceptance #34 — PASS.

Implementation:

- `httpJson` applies a 10-second default internal HTTP deadline when the caller supplies no signal;
- callers that already provide a tighter explicit `AbortSignal` retain caller-owned timing;
- optional bounded `timeoutMs` is validated for deterministic/specialized calls;
- the remaining raw Brain owner-projection fetch uses the same bounded timeout policy;
- deterministic stalled-upstream tests verify abort behavior;
- source-contract tests lock the audited owner-call paths to the bounded HTTP boundary;
- no retry loop was introduced, so Temporal/application retry semantics remain authoritative.

Merged-main CI/Product Eval/MCP passed and automatic Staging Deploy #821 PASSed exact `2ee12fd...`.

## CRITICAL authentication finding remains closed

A-00 is not reopened by Session 4.

The general Ai human-authentication gap was previously CLOSED / PASS through the private-by-default edge work and canonical closure evidence in:

`docs/verification/ai-human-auth-closure-2026-09-24.md`

Current runtime proof still shows unauthenticated representative Ai reads and mutations failing closed while MCP/OAuth remains a separate protocol boundary.

The current human-auth boundary is the urgent single-credential Basic Auth solution, not final multi-user auth/session/MFA/RBAC.

## Audit status after Session 4

The audit's CRITICAL/HIGH items are now:

| Finding | Severity | Current status |
| --- | --- | --- |
| A-00 human auth boundary | CRITICAL | CLOSED / PASS |
| A-01 internal HTTP timeout coverage | HIGH | CLOSED / PASS |
| A-12 remote bind without owner auth | HIGH | CLOSED / PASS |

There are **no remaining open CRITICAL/HIGH findings from that audit**.

Lower-priority findings remain separately bounded and are not silently authorized by this checkpoint.

## Next discussion scope

The next planned scope is **Session 5 — technical bug fix**, beginning with A-13 only:

- correct Space's standalone/default Flow URL from port `17029` to canonical Flow port `17028`;
- inspect both `services/space/src/main.ts` and `services/space/src/http.ts`;
- add deterministic regression coverage for the canonical port map;
- verify Compose behavior remains unchanged because Compose already injects `http://flow:17028`;
- inspect downstream Flow-linked block effects before claiming closure;
- do not turn this into a Flow scheduler redesign.

After A-13, the previously agreed next product scopes remain:

- Project UX: functional virtual **All**;
- stale persisted Project-selection reconciliation;
- final system audit;
- final safe checkpoint.

Those are future scopes, not active work in this checkpoint.

## Safe resume instructions

A new agent/conversation should start from:

1. repository `main` at or after `2ee12fd454ade78ce1bf732390334726980e0451`;
2. this checkpoint;
3. the canonical current-main audit;
4. current state/work plan;
5. verify no newer main has changed the A-13 baseline before editing.

Do not redo Session 1–4 recovery/security/deployment work unless new evidence invalidates it.

No manual VPS command is pending at this checkpoint.
