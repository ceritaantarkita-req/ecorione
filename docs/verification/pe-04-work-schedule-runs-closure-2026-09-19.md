# PE-04 Work + Schedule + Runs closure — 2026-09-19

Status: **CLOSED / PASS**

PE-04 implements the product-facing Work surface over existing Trigger, Flow, Temporal, Hub, and RnD owners without creating a Task domain or a second execution database.

## Reviewed implementation head

```text
PR                              #173
reviewed implementation head    c2cacbbcbee15f46ac4c5e9e43c955f5c952af43
closure evidence head           94936fa0704991d3536667bb8c947e9d751c813e
CI workflow run                 35435383786 PASS
Product Eval workflow run       35435383936 PASS
MCP External HTTPS workflow run 35435383793 PASS
closure-head CI                 35435554011 PASS
closure-head Product Eval       35435554018 PASS
closure-head MCP HTTPS          35435554042 PASS
merge main                      c08581a00a20dc6016c570a1fbb777d81e391699
```

The CI run passed format, lint, typecheck, full tests, Phase 4 real-process Temporal acceptance, production-operations acceptance, security/release checks, and production build.

## Delivered boundary

- top-level Work surface with Schedule / Flows / Runs;
- Project-scoped time Trigger list/create/edit/enable/disable;
- Temporal Schedule describe as runtime truth for paused state and upcoming occurrences;
- Project-scoped Flow list and exact graph/version deep links to the existing Flow editor;
- unified Run schemas keyed by existing `operationId`;
- Run discovery/detail rebuilt from RnD lifecycle evidence, Temporal/Flow state, Hub audit/approval, Trigger metadata, and cost summary;
- direct graph runs preserve `triggerId = null`;
- manual/time Trigger dispatch preserves Trigger identity into graph execution;
- lifecycle traces preserve Workspace, Project, graph/version, run identity, and Trigger correlation;
- explicit partial-owner availability instead of fabricated state;
- Hub audit parent + child-operation prefix retrieval;
- responsive Work source contract;
- no `runs` table and no competing execution state machine.

## Closure-audit fixes

The PE-04 audit found and fixed:

1. child workflow callers could omit a now-required nullable `triggerId`, causing TypeScript failure; the field is now structurally explicit as an ID or `null`;
2. eight implementation files were not canonical Prettier output; they were formatted using the repository-pinned formatter and temporary capture instrumentation was removed afterward;
3. Run detail originally accepted only `operationId`; a known sibling-Project operation ID could therefore expose detail across the active Project boundary. `GET /v1/runs/:operationId` now requires `workspaceId + projectId`, the projection fails closed on mismatch, the Work UI sends the active scope, and regression tests cover the sibling-Project case;
4. an unavailable `react-hooks/exhaustive-deps` lint directive in the Flow deep-link path blocked CI and was removed without changing hook behavior.

## Ownership remains unchanged

```text
Flow/Temporal -> workflow state and execution runtime
Trigger/Flow  -> Trigger metadata and exact graph/version
Hub           -> policy, approval, audit
RnD           -> lifecycle/trace/cost evidence
Work UI       -> read/control surface only
Run           -> rebuildable projection keyed by operationId
```

## Boundaries preserved

PE-04 does not:

- create a `runs` table;
- create a Task domain;
- create a second scheduler or execution state machine;
- turn browser calendar state into schedule authority;
- enable PE-05 event/webhook Trigger runtime;
- add `FOLLOW_LATEST`;
- create autonomous/LLM polling;
- change VPS/Cloudflare deployment state;
- reopen AutoClick or paid W18 evidence.

## Closure

The implementation head and the closure-evidence head both passed the required gates. PR #173 was then marked ready and merged to `main` as `c08581a00a20dc6016c570a1fbb777d81e391699`.

PE-04 is CLOSED / PASS. PE-05 may proceed under its explicit acceptance contract.
