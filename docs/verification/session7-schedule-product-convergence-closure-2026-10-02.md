# Session 7 — Schedule Product Convergence Closure

Date: **2026-10-02**

Status: **CLOSED / PASS / STAGING VERIFIED**

This checkpoint closes the bounded Session 7 Schedule product-convergence scope opened after Session 6. It records the current reviewed runtime, exact-head verification, merged-main verification, and staging proof. It does not open a new session automatically.

## Closed product scope

Session 7 converged the existing time-trigger product into the requested first-class Schedule surface without creating a second scheduler:

- global navigation now exposes **Schedule** at `/schedule`;
- legacy `/work` remains a compatibility route over the same implementation;
- Schedule remains Project-aware through the existing searchable Project picker and inline `+ New Project` path;
- list/day/week/month/year calendar views remain backed by real Temporal schedule projections;
- Schedule entries retain exact Flow-version links plus Runs visibility;
- the natural-language Schedule AI composer is persistently available at the bottom of the Schedule surface;
- an AI-generated create/edit draft opens the existing human review editor;
- explicit **Save schedule** remains the only mutation step;
- Brain Trigger/Run owner links now route to `/schedule`;
- browser/UX evidence was updated to exercise the first-class Schedule route while still covering the `/work` compatibility path.

## Authority boundary

No scheduler backend, browser timer authority, task database, or duplicate execution owner was added.

The closed authority path remains:

```text
Schedule UI
  -> Hub schedule-assist (draft only)
  -> explicit human Save
  -> Flow Trigger owner
  -> Temporal durable schedule truth
```

The AI assistant remains local/draft-only at the existing Hub -> Connect boundary. It does not directly create or execute schedules. Existing Project, Flow, Temporal, provider, spend, security, and approval boundaries remain authoritative.

## Runtime merge

Runtime PR:

- PR **#423** — `feat: converge Session 7 Schedule product surface`
- final reviewed head: `3530412ea7c238338b102db44d0f9ee8f01226c1`
- merged runtime `main`: `ebf52f190eeded99e4ee68881fd6925f2f0f6523`
- staging image: `staging-ebf52f190eed`

Exact-head gates:

| Gate | Result |
|---|---|
| CI #2620 | PASS |
| Product Eval #1859 | PASS |
| PCS-06 Integrated Browser Acceptance #377 | PASS |

Merged-main gates:

| Gate | Result |
|---|---|
| CI #2621 | PASS |
| Product Eval #1860 | PASS |

The final exact-head CI includes format, lint, typecheck, full tests, Phase 4 real-process acceptance, production-operations acceptance, secret scan, dependency/action/runner/toolchain/container reviews, release-security acceptance, and production build.

## Staging proof

Staging workflow behavior remained fail-safe:

- Staging Deploy **#1989**: gate-only PASS; deploy skipped while the peer required gate was not yet complete;
- Staging Deploy **#1990**: actual deploy PASS after both merged-main CI and Product Eval were green.

Actual staging evidence for `ebf52f190eeded99e4ee68881fd6925f2f0f6523`:

- exact reviewed SHA deployed;
- `headSha` matched `expectedSha`;
- host branch state `DETACHED`;
- host worktree clean;
- public/auth smoke PASS;
- MCP protected-resource/challenge smoke PASS;
- Operations `healthy: true`;
- Operations `unhealthyServices: []`;
- 15 configured compose services / 15 running / 0 non-running;
- rollback-set cleanup preserved the current and previous staging images;
- capacity stabilized at **29.91 GiB free** after bounded BuildKit-cache pruning.

SumoPod remains staging, not production.

## Correction trace

Two pre-final-head regressions were found and corrected before merge:

1. Product Eval caught an old UX evidence guard that still expected the navigation label `Work`; the guard was updated to the intentional `Schedule` contract.
2. PCS-06 caught an ambiguous browser heading selector after both the page `h1` and Schedule section `h2` used the same visible label; the acceptance selector was tightened to heading level 1.

Both corrections were re-run on final exact head `3530412e...` and passed before merge.

## Explicit non-claims

This checkpoint does **not** claim:

- production cutover;
- a second autonomous scheduler;
- browser timers as durable execution authority;
- direct AI mutation of scheduling state;
- a new hosted-provider or spend path;
- a new Project/Flow/Temporal ownership model;
- any next Session 8 scope.

## Safe resume

Session 7 Schedule product convergence is **CLOSED / PASS / STAGING VERIFIED**.

Future work should resume from this checkpoint and treat the following as compatibility requirements:

1. `/schedule` is the first-class Schedule product surface;
2. `/work` remains a compatibility route unless a separately reviewed migration removes it;
3. Project selection and owner-scoped schedule data remain authoritative;
4. AI assistance remains draft-only until explicit Save;
5. Flow owns Trigger definitions and Temporal remains durable schedule truth;
6. list/day/week/month/year views, Flow deep links, Runs, and Brain Schedule links must not regress;
7. production cutover and any new autonomous/non-time-trigger execution are separate future scopes.
