# Projects UI scope-isolation code audit — 2026-10-14

Status: **candidate fix / GitHub and operator acceptance pending**.

## Scope

- Source-derived audit of `apps/ai/app/projects/page.tsx`, `ProjectSettings.tsx`, `ProjectSources.tsx`, and the Project/Workspace routing contracts on current `main` `9b661c0e650d63a7ee3eb9787e002d49d1f30c2e`.
- This follow-up is strictly **front-end presentation isolation**. It does not modify the Hub/Artifact/Connect/Context owner-service access-control boundaries, persistence schema, or production deployment.

## Finding

- Projects view previously retained `sessions` from the prior selection while `loadSessions` for the newly selected Project was pending. A delayed prior response could also overwrite the current Project history.
- `ProjectSources` and `ProjectSettings` were reused across selected Projects without a React identity key. An old Project's loaded sources/catalog/edit draft could transiently remain visible in the new Project.
- Workspace changes also require a hard view boundary while new Workspace project lists load.

## Fix

- Remount the Workspace's entire Projects view when the authoritative Workspace changes; no prior Workspace's Projects state is reused.
- Use a structured history response scope (`[workspaceId, projectId or All]`). Render sessions only if the response belongs to the current selection; discard aborted requests and abort stale history requests on selection changes.
- Abort a Projects initial fetch on unmount, and use a load generation to prevent older same-view project-list responses replacing a newer result.
- Remount Project Settings and Sources when the selected Project changes to isolate local drafts, source lists, lifecycle state, catalog selections and outstanding view-only requests.
- Extend PCS-06 browser coverage with a delayed Research-history response arriving after switching back to Personal; old history must disappear during transition and must not reappear afterward.

## Gates / exclusions

- Exact-commit GitHub CI, Product Eval and dedicated PCS-06 browser scenario must all PASS before review readiness.
- Operator-controlled Codespaces acceptance is required for a final merge if feasible, in line with previous Settings PR #465.
- No real Project source upload, MCP ingest, URL fetch, Google Drive OAuth/Picker, or paid AI inference is claimed by the browser mock suite.
- Keep the existing Codespace stopped until manual acceptance is needed. Do not route or expose internal services publicly.
