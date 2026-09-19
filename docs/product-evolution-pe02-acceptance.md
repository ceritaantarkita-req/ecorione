# PE-02 acceptance contract

Last updated: **2026-09-19**

Status: **REQUIRED FOR PE-02 CLOSURE**

PE-02 adds Project Sources as references to existing owners. It must not copy owner content into Hub or create a new storage/service authority.

## Binding model

Supported V1 resource types:

```text
artifact
space-page
flow-graph
mcp-server
url
```

Every binding must carry:

```text
projectId
workspaceId
resourceType
resourceId
owner
role
createdAt
```

Rules:

1. one Project binding registry is Hub-owned;
2. Project metadata/bindings only — owner content is never copied;
3. `projectId + resourceType + resourceId + role` is unique/idempotent;
4. detach removes only the binding, never the owner resource;
5. archived Project cannot accept new bindings.

## Owner validation

Before creating a binding, Hub must validate the canonical owner:

- Artifact: metadata/content identity remains owned by Artifact/Context; nonexistent/revoked artifact fails.
- Space page: page must exist in the same Workspace.
- Flow graph: graph must exist in the same Workspace; cross-Workspace fails.
- MCP server: server must be visible to the same Workspace through Connect.
- URL: HTTPS reference only; no inline credentials, fragment, or copied remote content.

Owner lookup failure must fail closed. Binding creation must never succeed on a guessed or stale owner identity.

## Cross-Workspace and cross-Project rules

1. a Project can bind only resources authorized in its Workspace;
2. cross-Workspace Space/Flow/MCP binding is rejected;
3. Artifact binding must pass existing scope/sensitivity authorization before it becomes usable;
4. sharing one optional source across multiple Projects is explicit through multiple bindings;
5. removing a source from Project A does not remove Project B binding or owner data.

## Audit

Attach and detach must create Hub audit events with:

```text
PROJECT_SOURCE_ATTACHED
PROJECT_SOURCE_DETACHED
```

Audit detail must include Project, Workspace, resource type/id, owner, and role. No secret payload or copied content is stored in the audit event.

## Read behavior

Project Sources API must:

1. list bindings by Project;
2. return owner references/metadata sufficient for UI navigation;
3. fail cleanly when an owner resource was deleted/revoked after binding;
4. never silently return sibling Project bindings;
5. preserve the distinction between binding metadata and canonical owner data.

## UI

Project detail adds a **Sources** surface that can:

1. list attached sources;
2. attach supported resource references;
3. detach a binding;
4. show owner/resource type and a clear unavailable state when canonical owner lookup fails;
5. remain usable in the existing narrow viewport shell.

No Trigger/Schedule, Run, or Brain UI is added in PE-02.

## Persistence / recovery

1. Hub DB reopen preserves bindings;
2. backup/restore semantics remain Hub metadata + owner data independently;
3. rebuilding/losing Project bindings never damages Artifact/Space/Flow/Connect canonical data.

## Required tests

Minimum deterministic coverage:

```text
binding repository create/list/dedupe/detach/reopen
Project A/B negative isolation
cross-workspace rejection
archived Project rejection
owner missing/revoked negative paths
Artifact authorization negative path
Space workspace validation
Flow workspace validation
MCP workspace visibility validation
URL validation
attach/detach audit events
Ai Project Sources API/UI contracts
normal CI
Product Eval
relevant MCP/runtime acceptance when Connect boundary changes
```

PE-03 must not begin until the exact reviewed PE-02 head is green and merged.
