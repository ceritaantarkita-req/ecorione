# ECORIONE — Session 4 remaining HIGH security closure — 2026-09-24

Status: **SESSION 4 CLOSED / PASS**

## Scope

Session 4 closes the two HIGH findings that remained from the 2026-09-24 current-main + staging parity audit after the CRITICAL public Ai human-authentication defect had already closed:

- **A-01 — HIGH — internal HTTP timeout coverage is incomplete**;
- **A-12 — HIGH — remote bind can fail open without an internal bearer token outside guarded Compose paths**.

This scope does not include the Space default-port defect, Project UX defects, DR-2, production promotion, or broader product evolution.

## A-12 — owner remote bind authentication — CLOSED / PASS

PR #308 introduced a fail-closed owner-service bind helper.

Behavior now enforced:

- loopback-only owner service startup remains allowed without an internal token for local/test usage;
- when `ECORIONE_ALLOW_REMOTE_BIND=1`, RnD, Context, Connect, Hub, Artifact, Sandbox, Space, and Flow refuse startup unless `ECORIONE_INTERNAL_TOKEN` is present;
- Sync is intentionally unchanged because it uses its separate owner/device authentication boundary;
- deterministic tests cover loopback/no-token, remote-bind/no-token rejection, remote-bind/token success, and source contracts for all guarded production entrypoints.

PR #308 exact reviewed head:

`50d117517b008c3106222d42c41870a3c438662b`

Exact-head gates:

- CI #2020 — PASS;
- Product Eval #1259 — PASS;
- MCP External HTTPS Acceptance #1023 — PASS;
- PCS-06 Integrated Browser Acceptance #29 — PASS.

Merged main:

`e4810e0d7980682028be67634fa430090fe9bf92`

Merged-main gates:

- CI #2021 — PASS;
- Product Eval #1260 — PASS;
- MCP External HTTPS Acceptance #1024 — PASS.

Automatic Staging Deploy run #809 passed through the governed restricted-SSH path. Runtime evidence:

- exact-host `headSha == expectedSha == e4810e0d7980682028be67634fa430090fe9bf92`;
- clean worktree;
- all 15 configured services running;
- `nonRunningServices=[]`;
- public/private Ai smoke PASS;
- MCP metadata + unauthenticated OAuth challenge PASS;
- Operations `healthy=true`, `unhealthyServices=[]`;
- bounded readiness PASS on attempt 1/20;
- capacity stabilization PASS at 26.48 GiB free;
- helper emitted `PASS PCS-08 staging deploy`.

## A-01 — bounded internal HTTP calls — CLOSED / PASS

PR #309 established one default timeout policy for shared internal owner/service HTTP calls.

Behavior now enforced:

- `httpJson` applies a 10-second deadline whenever the caller does not provide its own `AbortSignal`;
- existing caller-owned tighter signals remain authoritative;
- an explicit `timeoutMs` override is validated to 1..120000 ms;
- a deterministic stalled-upstream test proves a stalled request is aborted;
- Brain owner projection's raw owner fetch has its own explicit 10-second deadline;
- source-contract coverage locks Hub Project Source verification, Flow Trigger HTTP authorization, scheduled Trigger activities, and Brain owner projection to bounded HTTP behavior;
- no automatic retry loop was added, preserving existing application/Temporal retry ownership.

PR #309 exact reviewed head:

`75d17e6d223422a757e1423315ce2083ef0ef211`

Exact-head gates:

- CI #2026 — PASS;
- Product Eval #1265 — PASS;
- MCP External HTTPS Acceptance #1029 — PASS;
- PCS-06 Integrated Browser Acceptance #34 — PASS.

Merged main:

`2ee12fd454ade78ce1bf732390334726980e0451`

Merged-main gates:

- CI #2027 — PASS;
- Product Eval #1266 — PASS;
- MCP External HTTPS Acceptance #1030 — PASS.

Automatic Staging Deploy run #821 passed. Runtime evidence:

- image `staging-2ee12fd454ad`;
- exact-host `headSha == expectedSha == 2ee12fd454ade78ce1bf732390334726980e0451`;
- clean worktree;
- all 15 configured services running;
- `nonRunningServices=[]`;
- public/private Ai smoke PASS;
- MCP metadata + unauthenticated challenge PASS;
- Operations `healthy=true`, `unhealthyServices=[]`;
- bounded readiness PASS on attempt 1/20;
- exact-host free space 24.05 GiB before retention;
- retention kept current + rollback and removed stale staging image;
- final capacity stabilization PASS at 25.11 GiB free;
- helper emitted `PASS PCS-08 staging deploy sha=2ee12fd454ade78ce1bf732390334726980e0451 tag=staging-2ee12fd454ad`.

## Session 4 result

The CRITICAL public Ai auth finding plus both HIGH findings from the 2026-09-24 audit are now closed at the reviewed-source and SumoPod staging-runtime boundaries.

Remaining prioritized audit work is lower severity/product scope:

1. Space standalone Flow default-port defect (`17029 -> 17028`);
2. Project UX/state defects: inert virtual **All** and stale persisted Project selection;
3. remaining bounded product/maintainability gaps.

## Non-claims

This closure does not claim:

- production readiness or production cutover;
- DR-2 physical independence;
- multi-user/MFA/RBAC human authentication;
- closure of MEDIUM/product findings;
- paid-provider quality or spend evidence.
