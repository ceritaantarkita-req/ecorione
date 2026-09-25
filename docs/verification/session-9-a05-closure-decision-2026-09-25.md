# Session 9 — A-05 external-ingestion closure decision

Date: **2026-09-25**

Status: **SAFE / RESUMABLE — A-05 CLOSED AT GENERIC CONNECTOR BOUNDARY / NATIVE GOOGLE DRIVE DEFERRED**

Repository baseline: **`8f8e0ff83fbf2a2696aaf28c490e34a00c5d0229`**

## Decision

A-05 is accepted as complete at the generic source-ingestion boundary delivered in Session 8:

- owner-backed Project Source picker;
- direct file -> Artifact ingestion;
- Project-scoped extraction;
- hardened HTTPS URL snapshots;
- generic MCP/connector resource discovery + selected-resource snapshot ingestion.

Native Google Drive onboarding is **not** opened as A-05b.3c.

The reason is architectural, not cosmetic. Current Connect already owns encrypted credentials and outbound MCP, but the repository does not contain a Google Drive adapter, Google OAuth authorization-code/PKCE callback lifecycle, refresh-token rotation domain, Drive file/folder hierarchy contract, or provider-specific export semantics. Adding all of those only to make Project Sources say “Google Drive” would create a new integration/auth domain substantially larger than the remaining A-05 gap.

Generic MCP ingestion already supports Google Drive or other providers when an operator connects an MCP server that advertises concrete resources. That remains the supported connector boundary for A-05.

## Folder semantics

No recursive bulk folder ingestion is introduced.

Folders remain provider/connector navigation concerns. ECORIONE snapshots concrete selected resources into Artifact one at a time. This avoids:

- unbounded recursive pulls;
- accidental ingestion of large/sensitive folder trees;
- ambiguous partial-batch success;
- difficult idempotency/reconciliation across many external files;
- silently changing the Project into a mirrored external filesystem.

A future provider integration may add bounded multi-select/batch semantics, but that is a separate explicitly authorized integration scope.

## Ownership stays unchanged

- Project/Hub: source binding + authority;
- Artifact: snapshot bytes;
- Context: derived extraction/semantic content;
- Connect: external connector/MCP/fetch boundary;
- no synthetic chat/history;
- no provider credential in Project/Ai storage;
- no sensitivity downgrade;
- no hosted-model call merely to ingest a source.

## Safe next scope

With this decision recorded, A-05 no longer blocks Schedule A-06.

A-06 must evolve the existing real Trigger/Temporal schedule product surface rather than replacing the scheduler backend. Start with calendar/navigation/year UX and preserve Flow/Trigger/Temporal ownership.

Native Google Drive OAuth/onboarding remains a future connector integration and must not be smuggled into A-06.

