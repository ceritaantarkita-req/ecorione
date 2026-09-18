# PE-00 — Project migration and ownership matrix

Last updated: **2026-09-19**

Status: **ACCEPTED CONTRACT FOR PE-01**

## Constants

```text
default workspace = ws_personal
default project   = prj_personal
virtual aggregate = All (NO database Project row)
```

## Owner/source-of-truth matrix

| Domain | Canonical owner | PE-01 change | Migration rule |
|---|---|---|---|
| Project metadata | Hub | add `projects` | seed `prj_personal` in `ws_personal` idempotently |
| Project binding | Hub | reserved for PE-02 | no PE-01 generic binding migration |
| Chat request | shared schema + Hub | add optional compatibility `projectId` and normalize | omitted + default/personal workspace -> `prj_personal`; non-personal omitted -> reject |
| History session | Hub Ledger | add `workspace_id`, `project_id`, `title`, `updated_at` | deterministic personal legacy -> Personal; ambiguous -> unassigned/fail-closed |
| History events | Hub Ledger | no event rewrite | inherit Project through session only |
| Context episodes | Context | add nullable `project_id` + index | personal legacy linked to deterministic personal session -> Personal; otherwise null |
| Context facts | Context | add nullable `project_id` + index | derive only when all source episodes resolve to same Project; mixed/unknown -> null global/legacy according to provenance rule |
| Context quarantine | Context | add nullable `project_id` | inherit proposed write target; legacy unresolved -> null |
| Context core memory | Context | evolve key to allow global + per-Project label | current rows become global (`project_id=NULL`); do **not** silently make core memory project-specific |
| Context artifact pointers | Context | no direct Project column in PE-01 | Project/source association is PE-02 binding |
| Flow graph | Flow | add nullable `project_id` + index | `ws_personal` graphs -> `prj_personal`; other/unknown workspaces -> null until explicit assignment |
| Space page | Space | no direct Project ownership change PE-01 | PE-02 binding |
| Artifact | Artifact | no Project column | PE-02 binding |
| Connector/MCP source | Connect | no Project ownership copy | PE-02 binding |
| Trigger | Flow | not created in PE-01 | PE-03 |
| Run | projection | not persisted in PE-01 | PE-04 |
| Brain | projection | none | PE-06 |

## Core-memory key migration

Current `core_memory.label` is globally unique. PE-01 must rebuild that table transactionally so identity becomes:

```text
(project_id, label)
```

with `project_id=NULL` representing global memory.

Because SQLite NULL uniqueness can be surprising, implementation must enforce deterministic uniqueness explicitly, for example with a normalized generated/key column or separate unique indexes:

```text
global:  unique(label) WHERE project_id IS NULL
project: unique(project_id, label) WHERE project_id IS NOT NULL
```

Do not change current core-memory trust/read-only semantics.

## Legacy classification rules

A row may be backfilled to `prj_personal` only when repository evidence makes that deterministic.

Safe examples:

- Flow graph has `workspace_id = ws_personal`;
- Chat/History session was created through the historical personal-only Chat path;
- Context Episode references a session already deterministically assigned Personal.

Do not infer Project from free text, model output, filename, or semantic similarity.

Ambiguous rows remain `project_id=NULL` and are excluded from Project-specific retrieval unless they are legitimate global memory. PE-01 must distinguish “global by design” from “legacy unassigned” where ambiguity matters, using migration metadata/receipt rather than guessing.

## Compatibility window

PE-01 keeps old request compatibility:

```text
workspaceId omitted + projectId omitted
  -> ws_personal + prj_personal

workspaceId = ws_personal + projectId omitted
  -> prj_personal

workspaceId != ws_personal + projectId omitted
  -> 400 / explicit project required

projectId supplied
  -> validate Project exists and belongs to effective Workspace
```

New Ai UI must always send explicit Workspace + Project.

## Migration safety

Every migration must be:

- transactional;
- restart-safe/idempotent;
- covered by old-schema -> new-schema test;
- compatible with backup/restore;
- non-destructive to History events and Context L0 episode content;
- followed by Project A/B negative isolation tests.

No historical hash is recomputed solely because session metadata gained Project fields; hash-chain event semantics remain as defined by ADR-18.
