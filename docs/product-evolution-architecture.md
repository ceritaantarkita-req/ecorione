# ECORIONE — Product Evolution Architecture

Last updated: **2026-09-19**

Status: **CANONICAL DESIGN / PE-03 ACTIVE**

This document defines the next ECORIONE product model after the previous Batch 1–12 / W / F6 baseline closed. It is intentionally built on the architecture already present in the repository. It does **not** authorize a new service, scheduler, graph database, autonomous engine, paid provider run, or production deployment unless a later batch explicitly requires and approves it.

Implementation batches live in [product-evolution-roadmap.md](product-evolution-roadmap.md). Agent execution rules live in [product-evolution-agent-guide.md](product-evolution-agent-guide.md).

## 1. Product model

Use this mental model everywhere:

```text
Project = WHERE / context boundary
Brain   = WHAT IS KNOWN / derived context graph
Trigger = WHEN / WHY work starts
Flow    = HOW work happens
Agent   = WHO/WHAT executes inside existing policy/runtime boundaries
Run     = WHAT ACTUALLY HAPPENED
```

Target relationship:

```text
                         ECORIONE
                            |
                         Project
                            |
          +-----------------+-----------------+
          |                 |                 |
        Brain              Work              Chat
          |          Trigger -> Flow           |
          |                 |                  |
          |              Temporal              |
          |                 |                  |
          +-----------> Execution <------------+
                            |
                           Run
                            |
                   +--------+--------+
                   |                 |
                 Ledger            Context
                   |                 |
                   +-------> Brain <-+
```

The model is product-facing. It does not replace owner-service boundaries already accepted by the repository.

## 2. Product surfaces

Target primary navigation:

```text
Ai
Projects
Work
  - Schedule
  - Flows
  - Runs
Brain
Space
Operations
Settings
```

A Project page should eventually expose:

```text
Project
  - Chat
  - Work
  - Sources
  - Memory
```

### V1 does not create a first-class Task domain

For the first product-evolution implementation, **Work** is a UI grouping over Trigger, Flow, Schedule, and Run. Do not invent a separate Task database/model until a concrete product requirement cannot be represented by those objects. If a Task domain is later needed, open a separate ADR and migration plan.

## 3. Workspace vs Project

**Workspace and Project are not the same thing.**

- `Workspace` remains the security/ownership/authority namespace already used by Hub, Flow, Space, MCP, capability grants, and settings.
- `Project` is a product/context grouping **inside one Workspace**.
- A Project must never weaken or bypass Workspace authorization.
- Cross-workspace Project bindings are forbidden.
- `All` is a **virtual aggregate view**, not a database Project.
- `Personal` is the real default Project for the current personal workspace.

Initial Project metadata should be owned by **Hub** because Hub is already the cross-owner control plane for policy, authority, audit, History, and orchestration. Keep this ownership narrow: Hub owns Project metadata and bindings, not copies of Artifact/Space/Flow/Context data. If Project logic later becomes large enough to justify a separate service, require measured evidence + ADR before splitting it.

Proposed control-plane shape:

```text
Project
- id
- workspaceId
- name
- description
- instruction
- memoryPolicy
- autonomyCeiling
- createdAt
- updatedAt
- archivedAt
```

`ProjectId` already exists in `packages/shared-schema/src/ids.ts`; do not create a competing ID type.

## 4. Project linkage strategy

Use a **mixed strategy**, not one generic relation table for everything.

### Direct `projectId`

Core high-volume semantic/execution records should carry `projectId` directly where project scoping is fundamental:

- Historical Ledger session;
- Chat request/session;
- Context episodes/facts/project memory;
- Flow graph/definition where ownership is project-specific;
- Trigger definition.

This makes authorization and retrieval explicit and prevents accidental cross-project context.

### Project bindings

Use a small Hub-owned binding registry for optional/shared resources:

```text
project_bindings
- project_id
- resource_type
- resource_id
- owner
- role
- created_at
```

Typical bindings:

- Artifact as Project source;
- Space page linked into a Project;
- Flow linked/reused by a Project when not directly owned;
- Connector/source reference.

Do not turn `project_bindings` into an untyped source of truth for every domain object.

## 5. Project memory rules

Project creation must have an explicit memory policy.

Minimum semantics:

```text
projectId = null
  -> global user/personal memory

projectId = prj_x
  -> project-specific memory
```

For a Project chat/retrieval:

```text
authorized global memory
+ authorized current-project memory
+ current-project sources
+ current conversation
```

Never automatically retrieve memory from sibling Projects.

`All` may aggregate metadata for the user interface, but **must never automatically merge all Project memory into one model prompt**.

Existing Context ownership, sensitivity, syncClass, trust, quarantine, provenance, and invalidation rules continue to apply.

## 6. Historical Ledger and chat

Historical Ledger remains the canonical append-only conversation/history source. Do not create a parallel chat-history database.

The next schema evolution should make sessions project-aware, approximately:

```text
HistorySession
- id
- workspaceId
- projectId
- title
- createdAt
- updatedAt
- scope
- sensitivity
- syncClass
- nextSeq
- headHash
```

Hash-chain/event append semantics must remain unchanged.

Chat requests should become Project-aware:

```text
sessionId
workspaceId
projectId
message
target
scope
maxSensitivity
autonomy
```

Existing sessions/records without a Project must be migrated deliberately. Do not silently assign ambiguous historical data to a Project.

## 7. Sources

Project is a reference/composition layer, not a new blob store.

Use existing owners:

```text
Local/uploaded file  -> Artifact
Image/media          -> Artifact
Google Drive         -> Connect/MCP/connector
URL/external source  -> Connect
Space page           -> Space
Conversation         -> Historical Ledger
External API         -> Connect
Flow                 -> Flow
```

Project metadata stores references/bindings only.

## 8. Trigger and Schedule

Schedule is a product UI over **time triggers**. It is not a second execution engine.

General trigger kinds:

```text
manual
time
event
webhook
condition
```

Do not add `AI Decision` as an external trigger class in V1. AI decisioning can exist inside a Flow/Condition node under existing policy; introducing an AI-owned trigger loop would risk hidden polling and unclear authority.

PE-03 V1 TriggerDefinition:

```text
TriggerDefinition
- id
- workspaceId
- projectId
- name
- kind
- graphId
- graphVersion
- versionPolicy = PINNED
- requestedAutonomy
- enabled
- configuration
- temporalScheduleId
- revision
- createdAt
- updatedAt
```

Rules:

- use an IANA timezone such as `Asia/Jakarta`, not only a UTC offset;
- default scheduled triggers to an **exact pinned Flow version** for reproducibility;
- `FOLLOW_LATEST` is not accepted in PE-03; exact pinned Flow version is required;
- define overlap behavior (`skip`, `queue`, or `forbid`);
- define missed-schedule behavior (`skip` or bounded catch-up);
- every side effect still uses stable idempotency identity;
- Trigger never grants authority.

Execution path:

```text
Trigger
  -> Flow
  -> Hub authority/policy
  -> Temporal
  -> execution
```

Temporal remains the durability/timer/retry/signal/recovery engine per ADR-36. PE-03 must compile and runtime-test the exact pinned Temporal TypeScript `1.23.0` Schedule API; repository metadata may mirror Trigger configuration but must not become a second schedule runtime truth.

## 9. Autonomy

Do **not** create `services/autonomous`.

Autonomy is a policy property over Trigger + Flow + Hub.

Existing levels remain:

```text
L0 L1 L2 L3 L4
MAX_AUTONOMY_V1 = L3
```

Effective autonomy must be the most restrictive result of:

```text
Project ceiling
x Trigger requested level
x Flow/node requirement
x Hub capability/policy decision
```

A Trigger cannot increase authority.

Existing always-gated actions stay gated, including:

- irreversible writes;
- spend;
- external send;
- credential access;
- policy admin.

Example: an email event may classify and draft automatically; actual `EXTERNAL_SEND` still follows Hub approval.

## 10. Run

A Run is the product view of an actual execution:

```text
Run
- project
- trigger/reason
- flow + exact version
- start/end
- status
- operation identity
- output/result
- cost
- actions
- approvals
- errors
```

Do **not** create a second execution-truth database by default.

Existing truth is already distributed across:

- Flow/Temporal workflow state;
- Hub audit/policy/approval;
- RnD traces;
- Historical Ledger;
- operation/workflow identities.

V1 should build a **unified read model/projection** from those owners. ADR-37 locks the stable product Run key to existing `operationId` and the owner-source mapping. Rebuildable caching is allowed later; competing execution authority is not.

## 11. Brain

Brain is a **derived, rebuildable graph projection**. It is not a new source of truth and not a graph database.

Existing ADR-05 remains binding: SQLite/sqlite-vec/FTS5 first; no Neo4j/FalkorDB unless measured multi-hop requirements prove the current approach insufficient and a new ADR changes the decision.

Initial node types:

```text
Project
Conversation
Memory
Artifact
Page
Flow
Trigger
Run
Source
Entity
Decision
Operation
```

Initial edge types:

```text
BELONGS_TO
CREATED_FROM
USES
REFERENCES
TRIGGERED
EXECUTED
PRODUCED
MENTIONS
SUPERSEDES
GENERATED_FROM
```

Build deterministic edges first from existing IDs/provenance/bindings. Do not use an LLM to invent every edge.

Examples:

- session -> Project;
- Trigger -> Flow;
- Run -> Trigger;
- Artifact -> source binding;
- Memory fact -> source Episode;
- Flow/Run -> operation;
- Space page -> Project binding.

Brain projection must enforce the same Workspace/scope/sensitivity authorization **before returning nodes or edges**. Existence of a sensitive node/edge can itself leak information.

## 12. Brain + Context + ECX

Brain should narrow candidates; it must not become a second retrieval/optimizer engine.

Target path:

```text
Question
  -> Project boundary
  -> Brain neighborhood
  -> Context retrieval
  -> ECX semantic-v1 selector
  -> small context pack
  -> model
```

Ownership remains:

- Brain: relationship/neighborhood projection;
- Context: memory ownership + retrieval;
- ECX: context-pack selection/optimization;
- Connect: provider/model boundary.

Do not dump the entire graph into a model prompt.

PE-07 must measure whether Brain narrowing improves context size/cost/quality before any deeper graph investment.

## 13. Product UI behavior

### Projects

- `All`: virtual Home/aggregate;
- `Personal`: real default Project;
- user-created Projects after that;
- project switch must scope Chat/Work/Sources/Memory.

### Work

Work groups:

- Schedule;
- Flows;
- Runs.

Do not hide advanced Flow editing; natural-language generation may become the default entry point later, but the visual Flow canvas remains the inspect/edit surface.

### Schedule

Views may progress in this order:

1. list;
2. day/week;
3. month;
4. year only if useful.

Start with correctness and traceability before calendar polish.

### Brain

Start with a project-scoped interactive graph and filters. The graph is for navigation/context understanding, not a decorative full-database visualization.

## 14. Non-goals

Until explicitly reopened, do not:

- create Batch 13;
- create a Project service prematurely;
- make Project equal Workspace;
- create a second scheduler or retry engine;
- create an autonomous polling service;
- lift `MAX_AUTONOMY_V1` to L4;
- create a graph database;
- create parallel chat history;
- create parallel execution truth;
- rerun paid W18 evidence for freshness;
- mutate VPS/Cloudflare deployment;
- build AutoClick;
- introduce a Task domain without evidence;
- mix sibling Project memory automatically.

## 15. Locked architecture decisions from PE-00

PE-00 converted the following into accepted ADRs/contracts before feature implementation:

1. Workspace vs Project ownership + migration;
2. direct `projectId` vs optional Project bindings;
3. global vs Project memory precedence;
4. Trigger ownership + Temporal schedule semantics;
5. Flow-version pin/follow-latest policy;
6. concurrency/misfire/idempotency policy;
7. Run projection source-of-truth mapping;
8. Brain projection/privacy boundary.

PE-00 is closed. PE-03 is the active bounded implementation batch under ADR-36 and the PE-03 acceptance contract; later PE scopes remain blocked by sequence.
