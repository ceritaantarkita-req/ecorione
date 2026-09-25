# Session 7 — A-03 safe checkpoint — 2026-09-25

Status: **CLOSED / PASS — SAFE RESUME**

## Scope

Session 7 was intentionally limited to audit finding A-03: stale persisted Project selection in `ecorione.projectId` across Ai, Work, and Brain.

This slice did not open Project settings/source onboarding, Schedule UX, Brain expansion, Flow/Temporal redesign, production promotion, provider spend, DR-2, or unrelated product work.

## Product correction

PR #316 — `fix: reconcile stale Project selection`:

- exact reviewed head: `5d72d7455f1a8f945c904b4847659233e2240003`;
- merged main: `8bbaf855b4f415afbe09eb9b6d16f9c1df6e1f8e`;
- one shared client-side Project-selection contract now owns candidate validation and active-Project reconciliation;
- a persisted/query Project candidate is accepted only when it exists in the active Project list;
- archived or missing candidates fall back to active Personal, or to the first active Project when Personal is unavailable;
- when no active Project exists, owner reads remain blocked instead of sending the stale Project id;
- Ai resolves the Project before session/history binding and drops an explicit session binding when the Project candidate had to be corrected;
- Work and Brain wait for Project reconciliation before owner-state loading;
- Ai, Work, and Brain persist the reconciled active Project back to `ecorione.projectId`;
- no Project memory/source data is merged across Projects.

## Deterministic regression coverage

Repository coverage now includes:

- `apps/ai/lib/project-selection.test.ts`: active stored Project, archived Project fallback, missing Personal fallback, no-active-Project behavior, malformed candidate rejection, and active filtering;
- `test/a03-stale-project-selection-source-contract.test.ts`: shared resolver use across Ai/Work/Brain, readiness guards, Ai session rebinding order, and removal of the old syntax-only localStorage acceptance;
- `scripts/pcs06-browser-acceptance.mjs`: browser starts with `ecorione.projectId=prj_archived`, independently opens Ai, Work, and Brain, verifies storage converges to `prj_personal`, and fails if the stale Project reaches an owner API.

## Verification

Exact PR head `5d72d745...`:

- CI #2050 — PASS;
- Product Eval #1289 — PASS;
- PCS-06 Integrated Browser Acceptance #47 — PASS;
- normal suite: **216 test files passed + 1 skipped; 1157 tests passed + 2 skipped**;
- Phase 4 real-process acceptance: **2 files / 3 tests PASS**;
- Product Eval regression matrix: **53 files / 232 tests PASS**;
- format, lint, typecheck, normal tests, Phase 4, production-ops, dependency/action/runner/toolchain/image reviews, release-security acceptance, and production build passed;
- rendered browser explicitly reported `PASS stale Project selection reconciliation across Ai/Work/Brain`.

Merged main `8bbaf855...`:

- pre-documentation code checkpoint: `checkpoint/session7-a03-code-20260925` -> exact `8bbaf855b4f415afbe09eb9b6d16f9c1df6e1f8e`;
- CI #2051 — PASS;
- Product Eval #1290 — PASS;
- Staging Deploy #868 gate — PASS with deploy job skipped on the first peer-gate completion;
- Staging Deploy #869 — PASS with the real deploy job executed after both merged-main peer gates were green.

## Runtime proof — SumoPod staging

Automatic Staging Deploy #869 deployed:

- SHA: `8bbaf855b4f415afbe09eb9b6d16f9c1df6e1f8e`;
- image: `staging-8bbaf855b4f4`;
- previous rollback image retained: `staging-485970785cba`;
- stale image `staging-591b54131c2d` removed after successful convergence.

Post-deploy evidence:

- auth bootstrap redirects to `/login`;
- protected login/Ops/Settings/Projects/history/Brain/Space reads return HTTP 401 + Basic challenge when unauthenticated;
- chat/forget mutations remain protected;
- MCP protected-resource metadata returns HTTP 200;
- unauthenticated MCP returns HTTP 401 with resource metadata;
- Operations reports `healthy: true`, `serviceCount: 9`, `unhealthyServices: []`;
- exact-host evidence reports `headSha == expectedSha == 8bbaf855...` and `expectedShaMatched: true`;
- `nonRunningServices: []`;
- host evidence measured `24.03 GiB` available before final retention cleanup;
- final stabilized free space: **25.10 GiB**.

## Closure verdict

**A-03 is CLOSED / PASS. Session 7 is CLOSED / PASS.**

Persisted Project selection now converges to an active Project before Ai/Work/Brain bind owner state. The repair does not create a synthetic Project, cross-Project memory scope, new data owner, or alternate persistence layer.

## Safe resume boundary

No implementation is in flight.

Next bounded discussion should decide between:

1. opening **Project settings + source onboarding** as a new product scope covering the remaining A-04/A-05 gaps; or
2. proceeding directly to the **final system audit** before authorizing more product work.

If Project settings/source onboarding is opened, keep it separate from Schedule calendar/AI interaction, Brain expansion, frontend decomposition, Compose-readiness work, production cutover, provider spend, and DR-2.

Do not open a new autonomous service, graph database, scheduler, or cross-service database path to solve the remaining product gaps.
