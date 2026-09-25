# Session 8 — A-04 / A-05 Project settings and source-ingestion safe checkpoint

Date: **2026-09-25**

Status: **SAFE / RESUMABLE — A-04 CLOSED, A-05a + A-05b.1 + A-05b.2 + A-05b.3a + A-05b.3b CLOSED / PASS**

Current implementation main: **`3dd350e938d3651e75fc81ac30e9ef751c477ca5`**

This checkpoint records the bounded Project settings/source-onboarding work opened after Session 7. It does not open Schedule A-06, Brain A-07/A-08, frontend decomposition A-09, Compose readiness A-10, production cutover, hosted-provider spend, or DR-2.

## Closed sequence

| Scope | PR | Merge | Result |
|---|---:|---|---|
| A-04 Project settings | #318 | `33d54928de60ba3f6d8cd3770c18d7ad5eea6f98` | CLOSED / PASS |
| A-05a owner-backed source picker | #319 | `8c6188983f058854028d803168c946445f92b31c` | CLOSED / PASS |
| A-05b.1 direct Project file ingestion | #320 | `c299f0c0b74cd770a80483b0492b3b9e843f8b86` | CLOSED / PASS |
| A-05b.2 Project-scoped extraction | #321 | `74dea0b83046af18ab3c4a89a95996ba4c3bdc46` | CLOSED / PASS |
| A-05b.3a URL snapshot ingestion | #322 | `f993b2c325b8d5645b28ec1788dbb0d8cf3ff1d8` | CLOSED / PASS |
| A-05b.3a DNS-pinning hardening | #323 | `55466c71bb3d978039f2088b9209607399262a09` | CLOSED / PASS |
| A-05b.3b MCP/connector resource ingestion | #324 | `3dd350e938d3651e75fc81ac30e9ef751c477ca5` | CLOSED / PASS |

## Final A-05b.3b behavior

Project Sources can now bind an MCP server and browse resources advertised by that exact server. Selecting a resource uses the existing Connect MCP boundary rather than bypassing it.

The read path is:

```text
Project-bound MCP server
-> Connect MCP discovery
-> exact advertised resource URI check
-> explicit authority check (mcp.resource.read / mcp.read)
-> MCP resources/read
-> bounded Connect snapshot normalization
-> Artifact RESTRICTED + LOCAL_ONLY
-> Project Artifact binding
-> optional A-05b.2 Extract into Project-scoped Context
```

Important boundaries:

- MCP resource reads remain fail-closed until the exact `mcp-tool:<server>/resources.read` subject is explicitly granted; no compatibility auto-grant was added.
- Connect audits successful reads as `MCP_RESOURCE_READ`.
- The resource must be advertised by the selected MCP server before it can be read.
- Connector snapshots are bounded to the existing external-source maximum of **20 MiB**.
- Text resources may be normalized from text parts; one binary blob is accepted after strict base64 validation; unsupported mixed multipart snapshots fail closed.
- Artifact remains byte/storage owner.
- Project/Hub remains binding/authority owner.
- Context remains derived extraction/semantic owner.
- Connector snapshots are stored as **`RESTRICTED` + `LOCAL_ONLY`** and Hub rejects privacy-metadata drift from Artifact.
- The ingestion path does not fabricate `sessionId`, conversation turns, or Historical Ledger chat events.
- Extraction remains a separate explicit operation through A-05b.2.
- No hosted-model call is required by A-05b.3b.

## Project settings/source product state

A-04 is closed: Project name, description, instruction and autonomy ceiling are manageable from the Projects surface; the V1 memory policy remains the intentionally fixed `GLOBAL_PLUS_PROJECT` policy.

A-05 source UX now includes:

- owner-backed picker for Artifact, Space Page, Flow Graph and MCP server;
- direct file upload to Artifact with Project binding;
- Project-scoped extraction from attached Artifact;
- HTTPS URL snapshot ingestion with SSRF/DNS-rebinding hardening;
- MCP/connector resource discovery + selected-resource snapshot ingestion;
- separate Extract action for derived Project Context.

The remaining A-05 external-ingestion questions are intentionally **not** claimed closed by this checkpoint:

- provider-specific Google Drive connection/onboarding UX;
- recursive folder ingestion / folder snapshot semantics;
- MCP resource templates or provider-specific hierarchy semantics;
- whether those remaining items are required before moving to Schedule A-06.

Generic MCP resource ingestion is now sufficient for connectors that already expose concrete resources through MCP, but this is not the same claim as native Google Drive onboarding.

## Verification evidence

PR #324 exact reviewed head: **`3d4ab01ad5ac42c6317567f0ef122e1c46a0ab11`**

Exact-head gates:

- CI run `36107141520` — PASS;
- Product Eval run `36107141692` — PASS;
- MCP External HTTPS Acceptance run `36107141555` — PASS;
- PCS-06 Integrated Browser Acceptance run `36107141502` — PASS.

Merged main: **`3dd350e938d3651e75fc81ac30e9ef751c477ca5`**

Merged-main gates:

- CI run `36109640813` — PASS, including format, lint, typecheck, full test, Phase 4 real-process acceptance, production-operations acceptance, security reviews, release-security acceptance and production build;
- Product Eval run `36109640801` — PASS;
- MCP External HTTPS Acceptance run `36109640848` — PASS.

Automatic staging delivery:

- first workflow-run `36109721752` correctly gate-passed and skipped deploy while CI was not yet terminal;
- second workflow-run `36109914350` gate-passed and **executed `Deploy exact reviewed main SHA` successfully**;
- staging therefore reached the reviewed implementation boundary for exact `3dd350e938d3651e75fc81ac30e9ef751c477ca5`.

## Safe resume boundary

There is **no unmerged implementation work** from A-05b.3b.

Safe next discussion:

1. decide whether A-05b.3c should add provider-specific Google Drive onboarding and/or recursive folder semantics; or
2. explicitly accept the generic MCP-resource boundary as sufficient for now, document the remaining provider/folder limitations, and only then authorize Schedule A-06.

Do **not** jump directly into A-06 without making that A-05 remainder decision explicit.

If A-05b.3c is opened, keep ownership unchanged:

- Project/Hub: binding + authority;
- Artifact: raw snapshot bytes;
- Context: derived extraction/semantic context;
- Connect: connector/MCP/fetch adapter;
- no synthetic chat/history;
- no implicit sensitivity downgrade;
- no hosted inference merely to ingest a source.

