# Session 8 — Brain Product Convergence Closure

Date: **2026-10-02**

Status: **CLOSED / PASS / STAGING VERIFIED**

This checkpoint closes the current Session 8 Brain product-convergence continuation after Session 7 Schedule closure. It is distinct from the historical September “Session 8” source-ingestion work, which remains closed at its own documented boundary.

## Closed product scope

Session 8 aligned the existing Brain runtime with the accepted product design without adding a second graph owner:

- Brain remains first-class at `/brain`;
- the Brain Project control now reuses the searchable owner-backed Project picker used by Schedule;
- inline `+ New Project` is available directly from Brain;
- Project selection continues to reconcile against active owner-backed Projects and persists through the existing Project-selection contract;
- the connected graph remains Project-scoped and preserves the existing deterministic owner projection;
- node/relationship filters, dense-layout safeguards, contained pan, drag-to-pan, zoom, reset, inspector metadata, and canonical owner links remain intact;
- Brain AI is now a persistent bottom composer instead of being nested inside the selected-node inspector;
- the composer remains disabled until a connected dot is selected;
- when a node is selected, the composer shows the selected node context and reuses the existing bounded neighborhood grounding path;
- grounded Brain chat remains local-only and continues through the canonical `/api/chat` path;
- Trigger/Run owner links continue to route through the first-class Schedule surface;
- Flow nodes continue to route to the exact canonical Flow version.

## Authority boundary

Brain remains a rebuildable read-only projection. No persistent graph database, duplicate canonical graph store, or model-authored canonical relationship layer was introduced.

The retained path is:

```text
Brain UI
  -> authorized owner projection
  -> selected connected dot
  -> bounded Brain neighborhood
  -> canonical /api/chat
  -> Hub policy/history
  -> Context authorization + constrained retrieval
  -> Connect local model dispatch
```

Canonical ownership remains unchanged:

- Project -> Hub;
- Source / Artifact / Page -> their existing owners;
- Flow -> Flow owner;
- Trigger / Run -> Flow + Temporal, surfaced through Schedule;
- Fact / retrieval -> Context;
- model dispatch -> Connect.

Brain AI does not call `/v1/complete` directly and does not enable hosted Brain chat in this scope.

## Runtime merge

Runtime PR:

- PR **#425** — `feat: converge Session 8 Brain product surface`
- final reviewed head: `b7698c26e876598b8cb93e914efef2dd9d77d65e`
- merged runtime `main`: `a1b9aa6c85f194fe84d0263c4c42fbc7928b0047`
- staging image: `staging-a1b9aa6c85f1`

Exact-head gates:

| Gate | Result |
|---|---|
| CI #2632 | PASS |
| Product Eval #1871 | PASS |
| PCS-06 Integrated Browser Acceptance #386 | PASS |

Merged-main gates:

| Gate | Result |
|---|---|
| CI #2633 | PASS |
| Product Eval #1872 | PASS |

The final reviewed head includes a hydration-stable Brain assistant session initialization: the client session id starts empty and is assigned after the relevant effect runs, avoiding server/client initial-render drift while retaining per-Project/per-node session reset behavior.

## Staging proof

Staging workflow behavior remained fail-safe:

- Staging Deploy **#2013**: gate-only PASS; deploy skipped while the peer required gate was not yet complete;
- Staging Deploy **#2014**: actual deploy PASS after both merged-main gates were green.

Actual staging evidence for `a1b9aa6c85f194fe84d0263c4c42fbc7928b0047`:

- exact reviewed SHA deployed;
- staging image `staging-a1b9aa6c85f1`;
- `headSha` matched the expected SHA;
- clean worktree;
- public/auth smoke PASS;
- MCP protected-resource/challenge smoke PASS;
- Operations `healthy: true`;
- `unhealthyServices: []`;
- 15 configured compose services / 15 running / 0 non-running;
- rollback-set cleanup preserved the current and previous staging images;
- capacity stabilized at **25.34 GiB free**.

SumoPod remains staging, not production.

## Explicit non-claims

This closure does **not** claim:

- production cutover;
- a new graph database;
- model-created canonical graph relationships;
- hosted Brain chat;
- autonomous action execution;
- a replacement for Project, Schedule, Flow, Context, or Temporal ownership;
- any automatically opened Session 9 scope.

## Safe resume

Session 8 Brain product convergence is **CLOSED / PASS / STAGING VERIFIED**.

Future work should resume from this checkpoint and preserve these compatibility requirements:

1. Brain stays Project-aware and owner-backed;
2. Brain remains a rebuildable derived projection;
3. the Project picker remains searchable and supports inline Project creation;
4. the connected graph keeps contained pan/zoom/filter behavior;
5. Brain AI remains a persistent bottom composer;
6. a selected connected dot remains required for grounded Brain chat;
7. grounded Brain chat remains constrained through canonical Hub/Context/Connect local paths;
8. Schedule and Flow deep links must not regress;
9. production cutover and autonomous non-time-trigger execution remain separate future scopes.
