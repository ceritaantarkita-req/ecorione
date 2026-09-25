# Session 6 — A-02 safe checkpoint — 2026-09-25

Status: **CLOSED / PASS — SAFE RESUME**

## Scope

Session 6 was intentionally limited to audit finding A-02: the Projects page rendered the virtual **All** entry as an interactive button but the control had no behavior.

This slice did not open stale persisted Project-selection repair, Project settings/source onboarding, Flow/Temporal redesign, production promotion, provider spend, DR-2, or unrelated product work.

## Product correction

PR #314 — `fix: make Projects All aggregate functional`:

- exact reviewed head: `ec8388df4361a94fee7eb63926e580a25e1acd4b`;
- merged main: `591b54131c2d0b53532f33e08b878c15a0617951`;
- Projects now has an explicit virtual `ALL_ID` state with active styling and `aria-pressed`;
- selecting **All** loads workspace-scoped Historical Ledger session metadata by omitting `projectId` from the existing same-origin history route;
- Hub's existing optional-`projectId` history contract remains the owner path; no synthetic Project, parallel history store, or new database was introduced;
- the All detail view shows Project/session aggregate metadata and recent conversations across the workspace;
- Project Sources and memory remain Project-scoped and are never merged into a virtual All chat/memory scope;
- recent conversation links route through the owning real Project;
- legacy/unassigned or unavailable-Project sessions remain visible as metadata but are not opened through a fabricated Project;
- responsive styling covers both clickable Project-owned rows and non-clickable aggregate metadata rows.

## Deterministic regression coverage

Repository coverage now includes:

- `apps/ai/app/api/projects/history/route.test.ts`: Project-scoped query, workspace aggregate query with omitted `projectId`, and invalid explicit Project id;
- `test/a02-projects-all-source-contract.test.ts`: explicit All state, aggregate-history path, isolation wording, and owning-Project routing invariants;
- `scripts/pcs06-browser-acceptance.mjs`: rendered-browser regression clicks **All**, verifies aggregate history is requested without `projectId`, verifies no synthetic **Buka Chat** action appears, and verifies the conversation link points to its owning Project.

## Verification

Exact PR head `ec8388df...`:

- CI #2041 — PASS;
- Product Eval #1280 — PASS;
- PCS-06 Integrated Browser Acceptance #41 — PASS;
- format, lint, typecheck, full tests, Phase 4/production-ops/security/toolchain/release checks, and production build all passed;
- the rendered-browser journey directly exercised the repaired All behavior.

Merged main `591b5413...`:

- CI #2042 — PASS;
- Product Eval #1281 — PASS;
- Staging Deploy #850 gate — PASS;
- Staging Deploy #851 — PASS with the real deploy job executed.

## Runtime proof — SumoPod staging

Automatic Staging Deploy #851 deployed:

- SHA: `591b54131c2d0b53532f33e08b878c15a0617951`;
- image: `staging-591b54131c2d`;
- previous rollback image retained: `staging-d8d2a113c917`.

Post-deploy evidence:

- auth bootstrap redirects to `/login`;
- protected login/Ops/Settings/Projects/history/Brain/Space reads return HTTP 401 + Basic challenge when unauthenticated;
- chat/forget mutations remain protected;
- MCP protected-resource metadata returns HTTP 200;
- unauthenticated MCP returns HTTP 401 with resource metadata;
- Operations reports `healthy: true`, `serviceCount: 9`, `unhealthyServices: []`;
- exact-host evidence reports `headSha == expectedSha == 591b5413...` and `expectedShaMatched: true`;
- `nonRunningServices: []`;
- host evidence measured `26.44 GiB` available before final retention cleanup;
- current + rollback staging images were retained and stale `staging-536be0f6b95d` was removed;
- final stabilized free space: **27.81 GiB**.

## Closure verdict

**A-02 is CLOSED / PASS. Session 6 is CLOSED / PASS.**

The virtual All view is now functional as an aggregate metadata surface while Project memory/source isolation remains unchanged.

## Safe resume boundary

No implementation is in flight.

Next bounded discussion scope:

1. **A-03 only** — reconcile stale persisted `ecorione.projectId` when the selected Project is archived, deleted, or otherwise absent from the active Project list.
2. Add deterministic regression coverage before repair, then verify Ai/Work/Brain converge to an active fallback without cross-Project leakage.
3. After A-03, decide separately whether to open Project settings/source-onboarding product work or proceed to the final system audit.
4. Keep final system audit and final safe checkpoint as explicit later scopes.

Do not combine A-03 with a Flow/Temporal redesign, new scheduler, new graph database, new PE/PCS/Batch label, production cutover, provider spend, or DR-2 work.
