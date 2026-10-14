# ECORIONE — Settings code audit (bounded)

Date: **2026-10-13**

Status: **CODE AUDIT + CANDIDATE FIX / live browser acceptance pending**

## Source and boundary

Reviewed current `main` baseline `ff39dd75d131835f638ab84ac079c4e37f47bcad`, not a public production deployment. The previously operator-observed Codespaces `/ops` showed a healthy eight-service Phase 4 runtime. The Settings-specific findings here are **code-derived**, not claims of an interactive browser pass.

Audited components and contracts:

- `apps/ai/app/settings/page.tsx`, `SettingsProviderSection.tsx`, `useSettingsController.ts`;
- `apps/ai/lib/settings-proxy.ts` and its proxy tests;
- `apps/ai/app/WorkspaceProvider.tsx` and Workspace selection contract;
- `docs/ai-provider-model-ux-contract.md`, `docs/active-work-plan.md`, `AGENTS.md`.

## Observations

1. Provider/credential interface: Settings offers AI Connections, provider selection, local-runtime status and advanced Vault controls. Connect remains the owner of provider credentials and runtime authorization; frontend does not directly read Vault files.
2. Hosted cost control: UI exposes budget policy and the operator kill-switch boundary. Do not infer authorization for paid inference from UI toggle state alone.
3. Next.js Settings proxy maintains explicit path/method/query allowlists and forwards to Connect using a server-side internal bearer. Tests cover traversal, malformed requests and redirects. This is **not** proof of multi-user browser access control.
4. Native Google Drive: Connect's optional OAuth startup configuration was fixed by PR #464; real Session 12D operator-controlled Google OAuth/Picker acceptance remains outstanding. Do not activate with localhost callbacks from a Codespaces HTTPS origin.
5. MCP Workspace view isolation: **fix candidate**. Previously, changing Workspace ID in Settings changed the selection text but retained a previously loaded MCP server list and editable JSON. A stale request guard existed, but it did not clear existing view state or proactively invalidate the in-flight request. This can present wrong-Workspace configuration to the operator; it is a UI scoping problem, not evidence of cross-service database access.

## Candidate fix

- Centralized Workspace transition through `changeMcpWorkspace` in the Settings controller.
- Every actual Workspace change invalidates the pending MCP request ID and clears the old server list, JSON editor and loading indicator.
- Selecting the same Workspace is a no-op so in-progress same-Workspace edits are not discarded.
- Added targeted deterministic regression tests for same-Workspace preservation, cross-Workspace reset, and request generation increments.
- No changes to Connect, Hub policy, OAuth, providers, Flow/Temporal, or persistent data.

## Acceptance and limits

- Run exact-head GitHub CI and Product Eval; do not merge unless green.
- Confirm Settings MCP Workspace switch does not display or save a previous Workspace's loaded configuration in an operator-controlled Codespaces browser.
- Maintain Codespaces forwarded port 3000 private for ordinary development; do not publicly expose Settings/Vault surfaces.
- Separate later work: verify provider UX, budget enforcement and real Google Drive Session 12D using authorized test credentials in an appropriate environment.
- This is a small Settings bugfix and code audit, not a new numbered ECORIONE feature batch or a production-ready declaration.
