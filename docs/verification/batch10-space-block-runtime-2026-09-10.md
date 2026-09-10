# Batch 10 Space Block Runtime — Implementation Verification

Date: 2026-09-10
Status: implementation candidate; exact-head and merge closure evidence pending
PR: #25

## Ownership boundary

Batch 10 extends the existing Space service instead of creating a second memory, blob, or workflow owner.

- Space owns page/block composition, ordering, workspace/scope metadata, and optimistic versions.
- Context remains the owner of memory facts and core memory.
- Artifact remains the owner of raw blobs.
- Flow/Temporal remains the owner of durable execution.
- linked Context, Artifact, and Flow blocks persist IDs only; hydrated owner data is not written back into Space.
- AI blocks point to Flow graphs rather than calling Connect/providers directly.

## Implemented block runtime

Canonical typed block kinds:

- paragraph
- heading
- list
- checklist
- table
- database-view
- file
- image
- embed
- ai
- context-link
- artifact-link
- flow-link

The shared schema validates discriminated bodies, type/body agreement, table row/column references, pointer identifiers, and HTTPS-only embed URLs without inline credentials/fragments.

## Persistence and concurrency

Space now stores workspace-scoped pages and typed JSON block bodies with monotonic page/block versions.

Mutation behavior:

- stale page or block writes fail with HTTP 409;
- block insertion, move, delete, and full-page reorder are transactional;
- reorder requires the exact set of current block IDs;
- database-view can only reference a table on the same page;
- a referenced table cannot be deleted until its dependent database-view is removed.

## Owner-link resolution

`GET /v1/blocks/:id/resolve` resolves pointers just in time:

- Context facts through the protected Context fact access endpoint;
- Artifact-linked file/image metadata through Context Artifact authorization;
- Flow/AI graph links through Flow with same-workspace verification;
- local composition blocks return their own body.

Resolution values are response-only and are not persisted in the Space database.

## Legacy migration proof

A real temporary SQLite database using the pre-Batch-10 schema is opened through the new runtime in `services/space/src/db.test.ts`.

The migration test verifies:

- existing page/block IDs remain unchanged;
- ordering and timestamps are preserved;
- legacy pages receive `ws_personal` and version 1;
- legacy `text` becomes `paragraph`;
- legacy heading/list strings become typed bodies;
- schema user version advances to 10.

## Ai browser surface

`/space` now provides page composition, the typed block palette, block previews, reorder/delete controls, exact JSON inspector editing, on-demand link resolution, and the existing Context-owned core-memory editor.

Browser traffic stays behind `/api/space/*`; it does not connect directly to internal owner services.

## Bugs/hardening found during implementation

- initial Batch 10 files required repository Prettier normalization; one-shot formatter self-deleted after applying the repository style;
- database-view dependency deletion initially used a string search over JSON; it was replaced with parsed typed-body equality to avoid false positives;
- Flow-link integration fixture initially mixed compiled-node metadata into the strict graph-document contract; the fixture was corrected instead of weakening the production parser.

Temporary formatter workflows are absent from the candidate tree.

## Evidence so far

- implementation branch: `agent/batch10-space-block-runtime-20260910`;
- implementation PR: #25;
- MCP External HTTPS Acceptance `34441761822`: PASS on implementation head `29dc6dd55481b15e7a7baf74cb79c426250a662a`;
- the same head passed Naming, Format, Lint, and Typecheck before a strict Flow fixture mismatch was found by Test;
- final exact-head CI/MCP identifiers will be recorded only after the candidate head is frozen and all gates are green.

## Closure boundary

This document does not mark Batch 10 CLOSED. Closure still requires final exact-head green gates, expected-head implementation merge, post-merge main verification, a separate closure-doc PR, and final post-closure main verification.
