# Session 6 — External Source Lifecycle Local-Acceptance Checkpoint — 2026-10-01

**Status:** LOCAL ACCEPTANCE PASS / READY FOR PR / NOT MERGED / NOT STAGING VERIFIED

## Exact branch boundary

```text
branch        = feat/session6-external-source-lifecycle-20261001
base main     = 33bf2246e0bd12ab2386376580405589e66c1ae4
core commit   = 3bcfbdfcc318af6b9bb5be38c87d44f31da1982d
product commit= c50121f634a1f09a8ae6924a654d35d30fb1b0b4
```

Session 6 extends the closed Session 5 Project Source Picker without replacing its owner-reference model. Project bindings remain references; external bytes remain Artifact-owned; derived/indexed context remains Context-owned.

## Implemented lifecycle

Hub now stores bounded lifecycle metadata beside Project bindings:

```text
external origin (URL or MCP resource)
  -> latest Artifact snapshot
  -> optional Context episode
  -> state + refresh/index timestamps
```

States:

- `SNAPSHOT_READY` — a current Artifact snapshot exists but has not been indexed for the current content;
- `INDEXED` — the current Artifact snapshot has a recorded Context episode;
- `DETACHED` — the Project binding was removed while provenance is retained.

The lifecycle table stores metadata/provenance only. It does not copy external source content.

## Refresh and dedup semantics

- URL and MCP-resource ingestion reuse the existing governed owner paths.
- Artifact content addressing remains the dedup authority.
- A refresh that produces a **different Artifact ID** resets derived state to `SNAPSHOT_READY`, clears the prior episode reference, and requires indexing again.
- A refresh that produces the **same Artifact ID** advances `lastRefreshedAt` while preserving an existing `INDEXED` episode and `lastIndexedAt`; unchanged bytes are not treated as stale merely because they were re-fetched.
- Explicit re-index remains available and creates a new Context episode.

## External text indexing

Local acceptance exposed a real defect in the pre-existing extraction path: a plain-text URL snapshot was unnecessarily routed through Connect `/v1/multimodal/infer`, causing a 502 when no suitable local multimodal adapter was available.

Session 6 now indexes active external `text/*` snapshots directly:

```text
Artifact bytes
  -> strict UTF-8 decode
  -> Context episode + derivation
```

The direct path:

- invokes no hosted or local model;
- reports adapter `direct-text`, provider `artifact`, model `utf-8`;
- has zero model cost;
- writes Context with trust `THIRD_PARTY`;
- preserves the existing multimodal path for ordinary uploads and non-text media/documents;
- records `indexMode=direct-text` in Hub audit evidence.

## Product surface

Projects now:

- loads lifecycle state beside normal source bindings;
- shows `Snapshot ready`, `Indexed`, or `Snapshot detached`;
- shows refresh/index timestamps;
- changes URL action from `Ingest snapshot` to `Refresh snapshot` after a snapshot exists;
- changes external Artifact action to `Index` / `Re-index`;
- changes MCP-resource action from `Ingest` to `Refresh` once lifecycle metadata exists;
- exposes lifecycle through a validated Ai -> Hub GET proxy.

## Local live acceptance

Acceptance used an isolated temporary Project and did not modify the existing `mainlagihub` Project sources.

Real source:

```text
https://raw.githubusercontent.com/ceritaantarkita-req/ecorione/main/README.md
```

Observed sequence:

1. URL source + Artifact snapshot available.
2. Lifecycle returned `SNAPSHOT_READY`.
3. First Index initially exposed the old plain-text multimodal 502 defect.
4. After the direct-text fix, Index returned HTTP 200.
5. Lifecycle changed to `INDEXED` with a real Context episode.
6. Refresh of unchanged bytes returned the same content-addressed Artifact ID, advanced `lastRefreshedAt`, and correctly preserved `INDEXED`.
7. Re-index created a new Context episode and updated `lastIndexedAt`.
8. Artifact and URL bindings were detached.
9. Lifecycle retained provenance with state `DETACHED`.
10. The temporary acceptance Project was archived.

No active temporary source binding was left behind. Content-addressed Artifact bytes are not destructively purged by this session.

## Automated verification

Broader Project Sources + Session 6 regression:

```text
test files: 16 PASS / 16
tests:      53 PASS / 53
```

The suite covers:

- legacy Session 5 picker contracts;
- upload/extraction contracts;
- URL and MCP-resource ingestion contracts;
- lifecycle persistence and state transitions;
- same-hash refresh preservation and changed-hash reset;
- direct external-text indexing without model inference;
- multimodal extraction path preservation;
- Ai lifecycle proxy validation.

Repository gates after the final direct-text fix:

```text
lint             PASS
typecheck        PASS
secret-scan      PASS
production build PASS
```

The build includes `/api/projects/[id]/sources/lifecycle`.

## Deliberate non-claims

This Session 6 candidate does **not** claim:

- scheduled or automatic polling/refresh;
- native Google Drive integration;
- broad connector sync beyond explicit URL/MCP-resource refresh;
- destructive deletion of content-addressed Artifact bytes;
- automatic Historical Ledger purge;
- public production promotion;
- Session 6 merged or staging-verified.

Those remain separate future scope/evidence unless explicitly authorized.

## Gate after this checkpoint

1. push exact branch head;
2. open one Session 6 PR;
3. require exact-head CI, Product Eval, and relevant browser acceptance;
4. merge only the reviewed exact head;
5. require merged-main CI/Product Eval;
6. require exact-SHA staging deployment and runtime proof;
7. synchronize canonical closure docs;
8. clean merged Session 6 branches.

Do not start Session 7 until Session 6 closure is complete.
