# PE-04 acceptance contract

Last updated: **2026-09-19**

Status: **CLOSED / SATISFIED — PR #173**

PE-04 exposes existing Flow/Trigger/Temporal execution as the product-facing **Work** surface. It must not create a Task domain or a second execution database.

## Product surface

Work V1 contains three linked views:

```text
Schedule -> Trigger definitions + Temporal schedule runtime
Flows    -> existing Flow graphs / versions / editor links
Runs     -> operationId-keyed read projection
```

Every view is scoped by Workspace + Project. The default personal UX resolves to `ws_personal + prj_personal`, while explicit Project selection must not leak sibling Project data.

## Schedule

Schedule is a UI/read surface over PE-03 Trigger definitions.

Required behavior:

1. list time Triggers by active Project;
2. create a time Trigger against an exact pinned Flow version;
3. edit name, exact graph/version target, requested autonomy, cron expression, IANA timezone, catch-up window, and `SKIP | QUEUE_ONE`;
4. enable/disable through Trigger API;
5. show Temporal runtime availability and paused state;
6. show bounded upcoming occurrence timestamps from Temporal when available;
7. link Schedule -> Trigger identity -> exact Flow version -> related Runs.

Rules:

- no browser timer or calendar state may become scheduling authority;
- Temporal remains runtime truth for occurrence timing;
- Trigger metadata remains Flow-owned control metadata;
- `FOLLOW_LATEST` remains forbidden;
- schedule mutation continues through Hub policy via PE-03 API.

## Flows

Work/Flows is a navigation/read surface, not a competing Flow editor.

Required:

- list Project-scoped Flow graphs;
- show current version and metadata;
- link into the existing visual Flow editor;
- deep-link may select an exact graph/version;
- editing graph content remains owned by the existing Flow surface.

## Run projection

ADR-37 remains binding.

Stable Run key:

```text
operationId
```

No `runs` table or second execution state machine may be created.

Run discovery/read model may aggregate only owner evidence:

- **Flow/Temporal** — workflow identity, lifecycle/status, graph state/output/error;
- **Trigger/Flow metadata** — Trigger identity/reason and exact graph/version;
- **Hub audit** — policy/action/approval chronology;
- **RnD trace** — lifecycle evidence, trace chronology and cost summary.

Minimum Run view:

```text
operationId
workspaceId
projectId
triggerId?
graphId
graphVersion
temporalWorkflowId
startedAt
finishedAt?
status
cost?
approvals[]
actions[]
output?
errors[]
availability
```

Missing owner evidence must produce explicit partial availability. The projection must never fabricate a status, output, approval, cost, Trigger, or timestamp.

## Correlation contract

All PE-04 graph runs must preserve enough evidence to rebuild the projection:

- graph-run lifecycle trace carries parent `operationId`;
- trace attributes carry `workspaceId`, `projectId`, `graphId`, exact `graphVersion`, workflow/run id, and nullable `triggerId`;
- manual/time Trigger dispatch passes its Trigger identity into graph execution;
- direct Flow execution leaves `triggerId = null`;
- Hub audit queries can return the parent operation and child node-operation events without cross-operation leakage.

## Run status

Product status is derived, never manually written.

Preferred precedence:

1. current Temporal/Flow state when reachable;
2. terminal graph-run lifecycle trace;
3. explicit `UNKNOWN` / partial availability when neither is sufficient.

Allowed product statuses:

```text
RUNNING
WAITING
COMPLETED
FAILED
CANCELLED
TERMINATED
TIMED_OUT
UNKNOWN
```

## Project Activity

PE-04 may expose bounded Project Activity assembled from Trigger/Run/Audit evidence. It must remain a read projection and must not copy Ledger or Audit into a new owner database.

## API boundary

Minimum new read API:

```text
GET /v1/runs?workspaceId=...&projectId=...&limit=...
GET /v1/runs/:operationId
GET /v1/triggers/:id/schedule
```

Existing Trigger mutation endpoints remain authoritative for Schedule edits.

## UI / responsive acceptance

Required:

- top-level Work navigation is reachable from the shared product shell;
- Schedule / Flows / Runs are usable at desktop and narrow/mobile widths;
- loading, empty, partial-owner, and error states are explicit;
- long IDs/errors do not create page-level horizontal overflow;
- direct links to Flow editor and Run detail work;
- mutation controls serialize repeat clicks and surface owner errors.

## Required tests

```text
Run schema validation
run lifecycle trace correlation
direct run -> triggerId null
manual Trigger run -> triggerId preserved
time Trigger run -> triggerId preserved
Run list Project A/B isolation
Run detail owner-partial behavior
Temporal status mapping
Hub audit parent + child operation filtering
cost summary mapping
Schedule Temporal describe / next occurrences
Schedule edit through Trigger PATCH
Schedule enable/disable
Flow deep link
responsive Work source contract
normal CI
Product Eval
Phase 4 / Temporal runtime acceptance
```

Historical sequencing gate: PE-05 could not begin until the exact reviewed PE-04 head was green and merged. That gate was satisfied; PE-05 through PE-08 and PCS-00..PCS-10 subsequently closed.
