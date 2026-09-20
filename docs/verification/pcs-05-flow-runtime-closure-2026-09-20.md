# PCS-05 — Flow Runtime Defect Closure

Date: **2026-09-20**

Status: **CLOSED / PASS**

## Scope

PCS-05 closes the real-browser Flow query/authority failures recorded after the post-closure product walkthrough, without changing the established owner boundaries.

## Delivered behavior

- `graphRunState` and graph signal handlers are registered before the workflow's first awaited activity, removing the immediate-query registration race after `startGraph()`.
- A real Temporal regression test immediately queries run state while the first lifecycle activity is intentionally blocked.
- Graph Run performs an exact `node.execute` authority preflight before Temporal start.
- Missing standing authority returns explicit `403 FLOW_NODE_AUTHORITY_DENIED`; Temporal is not started on the denied path.
- Runtime execution still re-authorizes each node, so later revocation remains fail-closed.
- Flow exposes an explicit governed authority-preparation path for the exact graph version and unique node definitions.
- Missing grants use Hub's existing `POLICY_ADMIN` durable approval flow; there is no auto-grant or broad family grant.
- Explicit Approve retries the exact deterministic grant and verifies that the grant became active; Reject leaves Run blocked.
- Flow UI exposes **Prepare authority**, pending exact grants, explicit Approve/Reject actions, and version-bound readiness.
- Draft/save/load changes invalidate stale authority readiness.
- Run remains disabled until the same saved graph version is authority-ready.

## Preserved boundaries

- Temporal remains Flow durability, timer, retry, signal, state, and recovery owner.
- Hub remains capability, approval, policy, and audit authority.
- Node declaration remains distinct from authority grant.
- No auto-approval, auto-grant, second execution database, or second authority plane was added.
- Integrated rendered-browser acceptance remains PCS-06.
- SumoPod staging and production/public-edge work remain outside PCS-05.

## Regression coverage

PCS-05 adds coverage for:

- immediate `graphRunState` query readiness in a real Temporal test environment;
- authorized graph start;
- denied graph start proving `startGraph` is untouched;
- explicit Hub approval -> exact grant retry -> verification -> Temporal start;
- source-contract ordering for query registration, authority preflight, explicit approval, and UI Run gating.

Product Eval includes the PCS-05 regressions.

## Closure evidence

```text
implementation PR          #199
reviewed exact head        d7eb37e8b5e97da07895fcd050621e563a47359b
CI                         #1537 PASS
Product Eval               #776 PASS
merge main                 f58923b8261104c8aec331f506a68f8cf5fe5e7e
```

CI #1537 passed format, lint, typecheck, the full normal test suite, Phase 4 real-process acceptance, production-operations acceptance, secret/dependency/toolchain/container/release-security gates, and production build.

## Acceptance

PCS-05 acceptance is satisfied at the repository/runtime-regression boundary:

1. immediate graph-state query no longer races handler registration;
2. graph execution cannot begin before exact node standing authority is present;
3. missing authority is actionable and explicit to the user;
4. authority activation uses the existing durable Hub approval path;
5. negative authorization remains fail-closed;
6. exact-head CI and Product Eval passed.

The next roadmap scope is **PCS-06 — Integrated browser/regression acceptance**.
