# Session 5 — Project Source Picker Local-Acceptance Checkpoint — 2026-10-01

**Status:** READY FOR LOCAL VISUAL ACCEPTANCE / NOT MERGED / NOT STAGING VERIFIED

## Exact branch boundary

```text
branch      = feat/session5-project-source-picker-20261001
base main   = 65aee852d6b597ad1fa192bb23554f4347e6fc57
code commit = a18fc3b9c2dfe403ef9116839dff15242defc1fc
```

This Session 5 slice productizes the existing Project Sources foundation. It does not create a new source database, owner service, ingestion engine, or duplicate binding registry.

## Implemented

- searchable Project Source Picker for owner-backed resources;
- Artifact, Space page, Flow graph, and MCP server remain sourced from their existing owner catalogs;
- URL remains an explicit manual source path;
- selected role remains explicit as Source or Reference;
- one-click attach from the result list;
- exact binding state is visible as `Terpasang`;
- duplicate one-click attach is disabled for the same resource + role;
- detach remains available from the bound-source list;
- unavailable/revoked owner resources keep existing availability/reason handling;
- picker is bounded with a scrollable result area and responsive one-column mobile layout;
- existing upload/extract/URL-ingest/MCP-resource behaviors are preserved but are not expanded in this Session 5 slice.

## Preserved architecture boundary

- Project stores bindings/references, not copied Artifact/Space/Flow content;
- owner services remain source of truth;
- attach/detach stays on the existing Hub Project Sources route;
- Workspace/Project validation stays authoritative in the existing backend;
- external ingestion lifecycle is not broadened here; that belongs to Session 6.

## Verification

Focused picker/API contract:

```text
14 / 14 PASS
```

Broader Project Sources regression:

```text
test files: 13 PASS / 13
tests:      37 PASS / 37
```

Repository gates:

```text
lint             PASS
typecheck        PASS
production build PASS
```

The only warnings are the existing Next workspace-root and ESLint-plugin warnings.

Chrome headless rendered `/projects` successfully from the local runtime. The local dataset exposed only the virtual All view with no Project selected, so the picker detail could not be visually exercised without creating/modifying user data. No dummy Project was created.

## Local visual acceptance

On the already checked-out branch:

1. open `http://localhost:3000/projects`;
2. select an existing real Project;
3. scroll to **Sources**;
4. choose Artifact, Space page, Flow graph, or MCP server;
5. confirm the picker shows cards and a search field;
6. search by source name/detail/ID;
7. select Source or Reference role;
8. click **Tambah** on one resource;
9. confirm that exact resource + role changes to **Terpasang**;
10. confirm the bound-source list below shows the binding;
11. click **Lepas** and confirm it becomes attachable again;
12. confirm URL/manual and Upload file paths still render normally.

## Deliberate non-claims

This checkpoint does not claim:

- Session 5 merged to `main`;
- exact-head GitHub CI passed;
- staging deployed this slice;
- new external ingestion/indexing/refresh lifecycle work;
- native Google Drive integration;
- any new owner/source-of-truth service.

After operator acceptance, the next path is one PR -> exact-head CI/Product Eval -> merge -> merged-main CI -> staging proof -> docs closure.
