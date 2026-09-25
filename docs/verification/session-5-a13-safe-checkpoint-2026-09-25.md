# Session 5 — A-13 safe checkpoint — 2026-09-25

Status: **CLOSED / PASS — SAFE RESUME**

## Scope

Session 5 was intentionally limited to audit finding A-13: Space's standalone/default Flow owner URL used port `17029` even though the canonical Flow port is `17028`.

No Flow/Temporal redesign, Project UX implementation, production promotion, provider spend, or unrelated feature work was opened.

## Source correction

PR #312 — `fix: align Space standalone Flow port`:

- exact reviewed head: `51a8a46c33dedd8d92b075b857ab21d47ad10325`;
- merged main: `d8d2a113c917cee87f2d43a5a2243eda2e4d2173`;
- `services/space/src/http.ts` now owns one canonical `DEFAULT_FLOW_URL = "http://127.0.0.1:17028"` plus `resolveSpaceFlowUrl(...)`;
- `services/space/src/main.ts` resolves `ECORIONE_FLOW_URL` through that canonical helper;
- explicit overrides remain supported, including Compose's existing `http://flow:17028`;
- downstream `flow-link` / `ai` resolution logic is otherwise unchanged.

Deterministic regression coverage:

- `services/space/src/http.test.ts` locks the `17028` default and explicit override behavior;
- `test/a13-space-flow-port-contract.test.ts` locks Space, `.env.example`, engine health mapping, desktop Compose, and staging Compose to the canonical owner-port contract;
- existing Space HTTP coverage still resolves Flow-linked/AI-linked owner data on demand and therefore guards the unchanged downstream path.

## Verification

Exact PR head `51a8a46...`:

- CI #2032 — PASS;
- Product Eval #1271 — PASS;
- Product Eval regression matrix: 53 files / 231 tests PASS.

Merged main `d8d2a113...`:

- CI #2033 — PASS;
- Product Eval #1272 — PASS;
- normal suite: 213 files PASS + 1 skipped, 1144 tests PASS + 2 skipped;
- `services/space/src/http.test.ts`: 5/5 PASS;
- `test/a13-space-flow-port-contract.test.ts`: 4/4 PASS;
- Phase 4 real-process acceptance: 2 files / 3 tests PASS;
- format, lint, typecheck, security/toolchain checks, release-security acceptance, and production build PASS.

The first post-merge workflow-run event, Staging Deploy #832, correctly stopped after the gate because the peer CI gate had not finished yet. After both merged-main gates were green, Staging Deploy #833 executed the real deploy job and PASSed.

## Runtime proof — SumoPod staging

Automatic Staging Deploy #833 deployed:

- SHA: `d8d2a113c917cee87f2d43a5a2243eda2e4d2173`;
- image: `staging-d8d2a113c917`;
- previous rollback image retained: `staging-536be0f6b95d`.

Post-deploy evidence:

- auth bootstrap redirects to `/login`;
- protected login/Ops/Settings/Projects/history/Brain/Space reads return HTTP 401 + Basic challenge when unauthenticated;
- chat/forget mutations remain protected;
- MCP protected-resource metadata returns HTTP 200;
- unauthenticated MCP returns HTTP 401 with resource metadata;
- Operations reports `healthy: true`, `serviceCount: 9`, `unhealthyServices: []`;
- exact-host evidence reports `headSha == expectedSha == d8d2a113...`, `expectedShaMatched: true`, and `cleanWorktree: true`;
- no configured service is non-running;
- host evidence measured 27.51 GiB available before final retention cleanup;
- current + rollback staging images were retained, stale `staging-2ee12fd454ad` was removed;
- final stabilized free space: **28.86 GiB**.

Compose behavior did not need a product change because both desktop and staging Compose already inject `ECORIONE_FLOW_URL: http://flow:17028`. The deployed runtime therefore verifies that the A-13 correction does not disturb the proven Compose path; the standalone/default defect itself is locked by deterministic unit/source-contract tests.

## Closure verdict

**A-13 is CLOSED / PASS. Session 5 is CLOSED / PASS.**

The 2026-09-24 audit now has no open CRITICAL/HIGH finding and A-13 is also closed. Remaining product follow-up is intentionally separate from this technical defect closure.

## Safe resume boundary

No implementation is in flight.

Next bounded discussion scope:

1. Project UX — make the virtual `All` project functional rather than an inert aggregate entry.
2. Then reconcile stale persisted Project selection when the previously selected Project no longer exists.
3. Then run the final system audit.
4. Then create the final safe checkpoint.

Do not combine these into a hidden Flow redesign, a second scheduler, a new PE/PCS/Batch label, production cutover, or DR-2 work.
