# PE-06 acceptance contract

Last updated: **2026-09-19**

Status: **REQUIRED FOR PE-06 CLOSURE**

PE-06 introduces Brain V1 as a Project-scoped, authorized, rebuildable relationship projection over existing canonical owner data. ADR-38 is binding.

Brain is not a new source of truth, not a graph database, not a retrieval replacement, and not an autonomous service.

## Product goal

Brain V1 lets a user inspect deterministic relationships around the current Project:

```text
Project
-> known owner records
-> deterministic relationships
-> canonical owner links
```

The product surface is for navigation and context understanding. PE-06 does not yet use Brain to narrow Context/ECX prompts; that belongs to PE-07.

## Ownership

Canonical owners remain unchanged.

Brain may read only authorized owner APIs/contracts. It must not read another service's database directly.

V1 projection/query code may be implemented as a lightweight package/query layer inside the existing architecture. A new service, graph database, or persistent Brain store is not authorized by PE-06.

If a cache becomes necessary, it must be explicitly reviewed and remain fully rebuildable from canonical owners.

## Initial node types

V1 may project these deterministic node types where the required owner evidence exists:

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

A node type must not be fabricated when the canonical owner cannot provide a stable identity and authorized metadata.

## Initial edge types

V1 may project deterministic relationships including:

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

Every edge must be justified by canonical IDs, provenance, bindings, or explicit owner metadata. LLM guesses, semantic similarity alone, or inferred causal narratives do not create canonical Brain edges.

## Required deterministic relationships

Start with relationships already represented by repository facts, including where available:

- Project -> bound source/resource;
- Conversation/session -> Project;
- Memory fact -> source Episode/provenance;
- Trigger -> Flow/version;
- Run/operation -> Trigger/Flow/version;
- Artifact/Space/source -> explicit Project binding;
- supersede/provenance relations.

PE-06 may expose fewer node/edge classes initially if an owner contract is not yet safe or stable. Unsupported relationships must be omitted, not guessed.

## Project and authorization boundary

Workspace remains the authority/security boundary. Project remains a context/product boundary inside Workspace.

Before returning any Brain node or edge:

1. caller Workspace must be authorized;
2. requested Project must belong to that Workspace;
3. owner record must be visible to the caller under the existing owner policy;
4. Project-scoped relationships must match the requested Project;
5. node/edge existence itself must be treated as potentially sensitive.

Redacting content after returning an unauthorized node or edge is not sufficient.

A Project A query must not reveal that a protected Project B node or relationship exists.

## Query contract

Brain V1 must provide a bounded Project-scoped graph/neighborhood query with deterministic ordering and explicit limits.

At minimum the response must make node/edge identity traceable to canonical owners and include enough metadata to navigate back to the owner surface.

The API must not:

- return the entire repository graph by default;
- perform unbounded traversal;
- silently cross sibling Projects;
- expose raw owner-private payloads merely to draw the graph;
- invoke a model to decide authorization.

## Rebuildability

Brain V1 must be disposable.

Required proof:

```text
canonical owner data intact
-> Brain projection/query state removed
-> projection rebuilt/requeried
-> equivalent deterministic graph result
```

Deleting Brain-derived state must not delete or mutate canonical Project, Conversation, Memory, Artifact, Page, Flow, Trigger, Run, Source, Decision, Entity, or Operation data.

## UI boundary

Brain UI must:

- be Project-scoped;
- expose filters for supported node/edge types;
- let the user inspect a selected node;
- link back to the canonical owner/product surface where available;
- represent unavailable/revoked owner records safely;
- avoid presenting inferred or unsupported relationships as facts.

The graph is functional navigation/context UI, not a decorative full-database visualization.

## Context / ECX boundary

PE-06 does not replace or alter the current retrieval path.

```text
Context remains retrieval owner
ECX remains context-pack optimizer
Brain remains relationship/neighborhood projection
```

Brain-to-Context candidate narrowing and quantitative optimization claims are PE-07 scope and remain blocked.

Do not dump the Brain graph into a model prompt in PE-06.

## LLM / entity extraction boundary

Broad LLM/entity extraction is not required for Brain V1 and must not be introduced merely to populate the graph.

If an existing canonical owner already exposes an entity/provenance relationship, Brain may project it. Brain itself does not create canonical semantic facts.

## Required tests

```text
Project-scoped graph query
deterministic node identity
deterministic edge identity
stable ordering / bounded traversal
canonical owner link traceability
Project A cannot reveal Project B nodes
Project A cannot reveal Project B edges
cross-Workspace query fails closed
authorization occurs before node/edge disclosure
revoked/deleted owner record disappears or becomes safely unavailable
projection deletion loses no canonical data
rebuild/requery produces equivalent deterministic result
no cross-service DB read
no graph database
no Brain-owned canonical entity/fact store
no model call required for graph construction
Context retrieval behavior unchanged
ECX behavior unchanged
responsive Brain UI behavior
normal CI
Product Eval
relevant privacy/security acceptance
```

## End-to-end closure proof

PE-06 cannot close on schema tests alone. Closure must demonstrate at least one real Project-scoped graph containing multiple canonical owner types and deterministic relationships, with:

```text
authorized Project query
-> deterministic Brain nodes/edges
-> canonical owner links
-> negative sibling-Project isolation proof
-> delete/rebuild proof
-> same owner data remains canonical
```

PE-07 must not begin until the exact reviewed PE-06 head is green and merged.
