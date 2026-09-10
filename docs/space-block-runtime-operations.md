# Space Block Runtime — Operations

Batch 10 turns Space from the original three-string-block notes baseline into a workspace-scoped, typed composition runtime.

## Ownership rule

Space stores page/block composition only. Context remains memory owner, Artifact remains raw blob owner, and Flow/Temporal remains durable execution owner. Linked values are hydrated on demand and are not persisted back into Space.

## HTTP API

All examples below use `workspaceId=ws_personal`; callers should pass the actual workspace in multi-workspace deployments.

### Pages

- `POST /v1/pages` — `{ workspaceId?, title, scope }`
- `GET /v1/pages?workspaceId=...&scope=...`
- `GET /v1/pages/:id?workspaceId=...`
- `PATCH /v1/pages/:id?workspaceId=...` — `{ title, expectedVersion }`
- `DELETE /v1/pages/:id?workspaceId=...&expectedVersion=N`

Page writes increment `page.version`. A stale `expectedVersion` returns HTTP 409.

### Blocks

- `POST /v1/pages/:id/blocks?workspaceId=...` — `{ body, position, expectedPageVersion }`
- `PATCH /v1/blocks/:id?workspaceId=...` — `{ body?, position?, expectedVersion, expectedPageVersion }`
- `DELETE /v1/blocks/:id?workspaceId=...&expectedVersion=N&expectedPageVersion=M`
- `POST /v1/pages/:id/reorder?workspaceId=...` — `{ blockIds, expectedPageVersion }`

The reorder payload must contain every current block exactly once. Reorder is atomic and page-version protected.

## Block bodies

The `body.kind` discriminator is canonical and must match the stored block `type`.

Supported kinds:

`paragraph`, `heading`, `list`, `checklist`, `table`, `database-view`, `file`, `image`, `embed`, `ai`, `context-link`, `artifact-link`, `flow-link`.

Examples:

```json
{ "kind": "paragraph", "text": "Project note" }
```

```json
{
  "kind": "table",
  "columns": [{ "id": "col_name", "label": "Name" }],
  "rows": [{ "id": "row_one", "cells": { "col_name": "Example" } }]
}
```

```json
{ "kind": "context-link", "factId": "mem_...", "label": "Decision" }
```

```json
{ "kind": "artifact-link", "artifactId": "art_<sha256>", "label": "Source file" }
```

```json
{ "kind": "ai", "graphId": "fg_...", "graphVersion": 3, "prompt": "Summarize this page" }
```

AI block configuration is not an alternate model-provider path. The graph reference keeps durable execution in Flow/Temporal.

## Just-in-time link resolution

`GET /v1/blocks/:id/resolve?workspaceId=...&maxSensitivity=RESTRICTED`

Resolution behavior:

- `context-link` → Context `/v1/access/facts/:id` using page scope and requested sensitivity ceiling;
- `file`, `image`, `artifact-link` → Context Artifact authorization metadata only; no raw bytes are copied into Space;
- `flow-link`, `ai` → Flow graph version and same-workspace check;
- local composition blocks → their own typed body.

Resolution output is `{ blockId, source, value }` and is never written into the Space database.

## Database views

A `database-view` is a view over a `table` block on the same page. Cross-page table references fail closed. Deleting a table that is still referenced by a view is rejected until the dependent view is removed.

## Legacy migration

On startup Space detects the pre-Batch-10 schema and migrates it:

- legacy pages are assigned `ws_personal` and version 1;
- `text` becomes `paragraph`;
- legacy heading/list strings become typed bodies;
- IDs, ordering, timestamps, and page ownership are retained.

Back up Space state using the existing owner-scoped Batch 8 mechanism before production upgrades. The migration does not access another service database.

## Browser editor

Ai `/space` provides:

- workspace page list/create/rename;
- typed block palette;
- ordered block surface with move/delete;
- JSON inspector for exact typed body editing;
- on-demand owner-link resolution;
- the existing Context core-memory proxy, clearly separated from Space storage.

The browser talks to the Ai `/api/space/*` proxy; it does not connect directly to internal services.
