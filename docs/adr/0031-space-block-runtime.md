# ADR-31 — Space owns document composition, not linked memory/blob/execution state

Status: Accepted — Batch 10 implementation
Date: 2026-09-10

## Context

Space already had a small notes baseline with pages and three string block types. Batch 10 needs a composable workspace/document runtime without creating new copies of data already owned by Context, Artifact, or Flow.

The dangerous shortcut would be to hydrate a linked memory fact, file body, or workflow result and persist that hydrated value inside Space. That would create competing sources of truth and make deletion, sensitivity changes, artifact replacement, and Flow versioning ambiguous.

## Decision

Space is the owner of **composition state only**:

- page identity, title, workspace, scope, timestamps, and optimistic version;
- ordered block identity, typed block body, block version, and layout order;
- local document data that genuinely belongs to composition, such as paragraph text, checklist state, table cells, and database-view configuration.

The canonical block pack is:

- paragraph;
- heading;
- list;
- checklist;
- table;
- database-view;
- file;
- image;
- embed;
- AI;
- linked Context fact;
- linked Artifact;
- linked Flow.

Linked blocks are pointer-only:

- Context links store a `MemoryFactId` and resolve through Context access policy;
- file/image/artifact links store an `ArtifactId` and resolve metadata through Context authorization; raw Artifact bytes are never copied into Space;
- Flow and AI blocks store a `FlowGraphId` (+ optional version). Space does not execute Temporal workflows or call model providers directly;
- AI block prompt text is document composition, while durable execution remains a Flow responsibility.

Reference hydration is just-in-time and is not written back into the Space database.

## Workspace and privacy boundary

Every page belongs to a `WorkspaceId`. Reads and writes are scoped by workspace. Flow resolution additionally verifies that the resolved graph belongs to the same workspace as the page.

Context/Artifact resolution reuses the page scope and an explicit `maxSensitivity` grant. Space does not invent a weaker grant.

External embed blocks are limited to HTTPS URLs with no inline username/password and no URL fragment.

## Concurrency and ordering

Pages and blocks carry monotonic integer versions. Mutations use optimistic concurrency and fail with conflict on stale versions.

Block insertion/move/delete is transactionally reflected in dense page ordering. Full-page reorder requires the exact set of current block IDs; missing, foreign, or duplicate IDs fail closed.

A `database-view` may only reference a table block on the same page. A table cannot be deleted while a database view depends on it.

## Migration

Existing Space data is migrated in-place on service open:

- legacy pages receive `workspace_id = ws_personal` and `version = 1`;
- legacy `text` blocks become `paragraph` bodies;
- legacy heading/list strings become typed JSON bodies;
- block content moves from the old free-form string column to validated `content_json`;
- migration preserves IDs, positions, timestamps, and page foreign keys.

The migration does not rewrite Context, Artifact, or Flow data.

## Consequences

Positive:

- Space can grow into a Notion-like surface without becoming a second memory/file/workflow database;
- linked data follows current owner-service policy and version state when resolved;
- stale browser edits are detected instead of silently overwriting newer composition;
- old Space notes remain readable after migration.

Trade-offs:

- a linked block can become temporarily unresolved if its owner service is unavailable or the referenced object is no longer authorized;
- Space documents intentionally do not contain portable snapshots of linked raw data;
- AI blocks require a Flow graph reference rather than bypassing the Flow/Temporal architecture.
