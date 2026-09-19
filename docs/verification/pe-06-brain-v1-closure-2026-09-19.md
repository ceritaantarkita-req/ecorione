# PE-06 Brain V1 closure evidence

Last updated: **2026-09-19**

Status: **CLOSURE CANDIDATE / IMPLEMENTATION GATES PASS**

## Reviewed implementation

```text
PR                              #176
branch                          pe/pe-06-brain-v1-20260919
reviewed implementation head    66c7909572a1410095916843f8f46a385ecb628b
CI workflow run                 35444095549 PASS
Product Eval workflow run       35444095553 PASS
MCP External HTTPS workflow run 35444095552 PASS
```

The reviewed implementation head passed the required exact-head repository gates before this closure record was added.

Acceptance contract: [../product-evolution-pe06-acceptance.md](../product-evolution-pe06-acceptance.md).  
Architecture decision: [../adr/0038-brain-derived-projection.md](../adr/0038-brain-derived-projection.md).

## Delivered boundary

PE-06 delivers Brain V1 as a Project-scoped relationship projection over canonical owner APIs/contracts. It does not create a graph database, persistent Brain store, retrieval owner, execution authority, or model-driven fact extractor.

The implemented deterministic node set is intentionally bounded to owner contracts that are already stable and safe:

```text
Project
Source
Flow
Trigger
Run
```

The implemented deterministic edge set is:

```text
BELONGS_TO
REFERENCES
USES
TRIGGERED
EXECUTED
```

Unsupported PE-06 candidate node/edge classes are omitted rather than inferred.

## Query and identity proof

Brain exposes the Project-scoped route:

```text
GET /api/brain?workspaceId=...&projectId=...&limit=...&runLimit=...
```

The query contract is explicitly bounded:

```text
node limit  10..200, default 120
run limit    1..100, default 50
edge cap     min(500, nodeLimit * 4)
```

Projection behavior is deterministic:

- canonical owner records are sorted before projection;
- node ordering is stable by node type and deterministic projected ID;
- edge ordering is stable by deterministic edge ID;
- projected node IDs are bounded SHA-256-derived identities over canonical IDs;
- canonical IDs remain separately exposed for traceability;
- edges are emitted only when both endpoint nodes are present in the bounded result;
- no unbounded graph traversal exists.

Focused deterministic projection tests prove byte-equivalent graph output when owner arrays arrive in different orders and prove that bounded node output never returns an edge to a hidden node.

## Authorization and Project-isolation proof

Authorization occurs before owner fan-out:

```text
Brain request
-> Hub Project lookup with workspaceId
-> requested Project/Workspace match
-> owner fan-out
-> defensive Project filtering
-> node/edge projection
```

The route fails closed when Hub rejects the Workspace/Project boundary. Other owners are not queried before the Project authorization step succeeds.

Defense-in-depth filtering additionally removes sibling-Project Flow, Trigger, and Run records even if an owner response unexpectedly contains them.

Tests cover:

- requested Project belongs to requested Workspace;
- sibling Project owner records do not become Brain nodes;
- sibling Project relationships do not become Brain edges;
- cross-Workspace Project authorization fails closed;
- raw owner metadata is not copied wholesale into Brain output;
- Source metadata is explicitly projected from the safe binding fields required for navigation.

Node/edge existence is therefore protected by authorization and Project filtering rather than content-only redaction.

## Canonical owner and navigation proof

Brain reads only existing HTTP owner contracts:

```text
Hub  /v1/projects/:id
Hub  /v1/projects/:id/sources
Flow /v1/graphs
Flow /v1/triggers
Flow /v1/runs
```

There is no cross-service database read.

Canonical navigation is preserved:

- Project and Source nodes link back to Projects;
- Flow nodes link to the exact Flow graph/version;
- Trigger and Run nodes link to Work;
- owner names and canonical IDs remain visible in the inspector.

Brain does not copy canonical owner payloads into a new durable owner.

## Rebuildability and real-owner runtime proof

`test/pe06-brain-owner-runtime.test.ts` starts real in-process RnD, Hub, and Flow HTTP owners with their normal repositories and exercises Brain through the same owner HTTP contracts used by the product projection.

The runtime acceptance proves:

```text
create canonical Project Source in Hub
create Project-scoped Flow in Flow
create sibling Project + sibling Flow
query Brain
query Brain again
-> equivalent deterministic graph

detach canonical Source binding
query Brain again
-> Source node disappears

read owner Project directly
read owner Flow directly
-> canonical owner records remain intact
```

It also proves the sibling Flow never appears in the Personal Project graph.

Because PE-06 creates no Brain persistence, cache, graph DB, or canonical entity store, rebuild/delete semantics reduce to re-querying the canonical owners. The runtime test proves that re-querying is deterministic and that removing a canonical binding changes only the derived projection while canonical Project/Flow owner records remain intact.

The exact implementation CI reports this vertical as PASS:

```text
PE-06 Brain real-owner runtime acceptance
rebuilds the same Project graph from canonical owners and removes
detached state without mutating owners
PASS
```

## UI proof

The Ai product now exposes **Brain** as a first-class global navigation surface.

Brain UI includes:

- active Project selection using the existing Project selection convention;
- filters for supported node types;
- filters for supported edge/relationship types;
- connected-dot SVG graph;
- selected-node inspector;
- canonical identity and owner information;
- canonical owner/product links;
- unavailable Source representation;
- contained graph scrolling rather than page-level horizontal overflow;
- mobile/narrow layout handling.

The repository UX inventory was updated so Brain is a required product surface rather than an unverified decorative route.

## Context / ECX / model boundary proof

PE-06 intentionally does not change retrieval or prompt construction.

Source-contract regression explicitly protects that Brain V1:

- does not call a Context retrieval endpoint;
- does not implement ECX behavior;
- does not call completion/model APIs;
- does not create embeddings;
- does not use a model to authorize or construct graph relationships;
- does not introduce a polling loop or background Brain service.

Therefore:

```text
Context remains retrieval owner
ECX remains context-pack optimizer
Brain remains a deterministic relationship projection
```

Brain-to-Context candidate narrowing remains PE-07 scope.

## Full exact-head CI proof

CI run `35444095549` passed on reviewed implementation head `66c7909572a1410095916843f8f46a385ecb628b`:

```text
Format                           PASS
Lint                             PASS
Typecheck                        PASS
Test                             PASS
Phase 4 real-process acceptance  PASS
Production operations acceptance PASS
Secret scan                      PASS
Dependency policy review         PASS
GitHub Actions pin review        PASS
GitHub Actions runner review     PASS
Node toolchain review            PASS
Installer toolchain review       PASS
Container image digest review    PASS
Release security acceptance      PASS
Production build                 PASS
Secret-history scan              PASS
Naming guard                     PASS
```

Normal test suite result:

```text
Test Files  182 passed | 1 skipped (183)
Tests       966 passed | 2 skipped (968)
```

Dedicated Phase 4 real-process acceptance:

```text
Test Files  2 passed
Tests       3 passed
```

## Non-regression gates

```text
Product Eval                   35444095553 PASS
MCP External HTTPS Acceptance  35444095552 PASS
```

No desktop/installer workflow was triggered for this PR head; PE-06 does not change desktop packaging/runtime inputs. Installer toolchain review remains part of the normal CI and passed.

## Boundary confirmation

PE-06 does **not** introduce:

- a graph database;
- persistent Brain canonical storage;
- a second source of truth;
- cross-service database reads;
- unbounded traversal;
- broad LLM/entity extraction;
- model-based authorization;
- Context retrieval replacement;
- ECX behavior changes;
- Brain-to-prompt graph dumping;
- a scheduler, queue, polling daemon, or autonomous Brain service;
- paid provider evidence;
- L4 autonomy.

## Final merge gate

This closure evidence is added after implementation head `66c7909572a1410095916843f8f46a385ecb628b` passed all required implementation gates.

The resulting documentation-only exact PR head must also pass CI, Product Eval, MCP External HTTPS Acceptance, and any automatically triggered relevant acceptance before PR #176 is marked ready and merged.

PE-07 remains blocked until PR #176 merges. After merge, current-state documentation may close PE-06 and explicitly activate PE-07 as a separate transition.
