# PE-02 acceptance contract

Last updated: **2026-09-19**

Status: **CLOSED / PASS**

PE-02 adds Project Sources as references to existing owners. Hub stores only binding metadata; canonical content remains owned by Artifact/Context, Space, Flow, or Connect.

## Delivered binding model

Supported V1 resource types:

```text
artifact
space-page
flow-graph
mcp-server
url
```

Every binding carries:

```text
projectId
workspaceId
resourceType
resourceId
owner
role
createdAt
```

The Hub-owned registry enforces idempotent identity by Project + Workspace + resource type/id + role. Detach removes only the binding.

## Owner validation

Verified before attach:

- Artifact: Context authorization for the Artifact pointer must pass; denied/missing Artifact is not bound.
- Space page: canonical page must resolve in the Project Workspace.
- Flow graph: graph must be visible in the Project Workspace; explicit cross-Project reuse remains possible inside the same Workspace.
- MCP server: Connect must expose the server to the Project Workspace.
- URL: HTTPS only, with no inline username/password or fragment; remote content is not fetched/copied into Hub.

Owner lookup failure fails closed.

## Isolation and lifecycle

Verified:

1. Project A/B lists are isolated;
2. the same optional source may be shared explicitly through separate bindings;
3. cross-Workspace binding is rejected before owner lookup;
4. archived Project cannot accept new bindings;
5. removing Project A binding leaves Project B binding and owner data intact;
6. missing/revoked owner resources are shown as `UNAVAILABLE` without silently deleting the binding.

## Audit

Attach/detach emit:

```text
PROJECT_SOURCE_ATTACHED
PROJECT_SOURCE_DETACHED
```

Audit detail contains only Project/Workspace/resource/owner/role metadata and does not copy source content or credentials.

## UI

Project detail now includes **Sources** with:

- list;
- attach;
- detach;
- supported type/role selection;
- owner/type/resource identity;
- unavailable state;
- responsive narrow-layout behavior.

No PE-03 Trigger/Schedule, PE-04 Run, or PE-06 Brain UI was pulled into this batch.

## Persistence / recovery

Hub DB reopen preserves bindings. Binding loss/rebuild does not mutate canonical owner data because Hub contains references only.

## Closure evidence

Reviewed implementation head:

```text
PR #170
head a6167df469cf491015b232aff8a192b32a25c569
CI #1223 PASS
Product Eval #462 PASS
MCP External HTTPS Acceptance #628 PASS
```

Deterministic coverage includes:

```text
binding create/list/dedupe/detach/reopen
Project A/B isolation
cross-Workspace rejection
archived Project rejection
owner missing/revoked unavailable state
Artifact authorization denial
Space Workspace validation
Flow Workspace validation
MCP Workspace visibility
URL validation
attach/detach audit
Ai Project Sources API/UI contracts
```

The closure-doc head must pass the normal exact-head gates before PR #170 is merged.

PE-03 must not begin until PR #170 is merged and post-merge main is clean.
