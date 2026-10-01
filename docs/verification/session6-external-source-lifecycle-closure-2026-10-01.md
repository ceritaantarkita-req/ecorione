# Session 6 — External Source Lifecycle Closure — 2026-10-01

**Status:** FINAL / CLOSED / PASS / STAGING VERIFIED

## Exact boundary

```text
base main before Session 6 = 33bf2246e0bd12ab2386376580405589e66c1ae4
PR #421 reviewed head       = 828368eb6eaa00c991e52b0e4cfeea8d3abbfc35
merged runtime main         = 15f007c5d248df8319644f2d9a6c4c7905c70681
staging image               = staging-15f007c5d248
```

Session 6 extends the closed Session 5 Project Source Picker with bounded external-source lifecycle productization. It does not replace the Session 5 owner-reference model.

## Product/runtime closure

Projects now support explicit lifecycle state for URL and MCP-resource snapshots:

```text
external origin
  -> latest Artifact snapshot
  -> optional Context episode
  -> refresh/index/detach lifecycle metadata
```

Closed states:

- `SNAPSHOT_READY` — current Artifact snapshot exists and needs indexing;
- `INDEXED` — current snapshot has a recorded Context episode;
- `DETACHED` — Project binding was removed while provenance is retained.

Implemented behavior:

- lifecycle metadata is Hub-owned metadata only; external bytes remain Artifact-owned and derived context remains Context-owned;
- URL and MCP ingestion reuse the governed existing Connect/Artifact paths;
- same-content refresh preserves `INDEXED` state and the existing episode while advancing refresh time;
- changed-content refresh points to the new content-addressed Artifact and returns to `SNAPSHOT_READY`;
- explicit Index/Re-index writes a Project-scoped Context episode and derivation;
- active external `text/*` snapshots use a bounded direct UTF-8 indexing path with `THIRD_PARTY` trust and zero model cost;
- ordinary uploaded/non-text extraction keeps the existing multimodal path;
- Project Sources UI exposes lifecycle state, refresh/index timestamps, `Refresh snapshot`, `Index`, and `Re-index`;
- Ai exposes a validated read-only lifecycle proxy.

## Local acceptance

Canonical pre-merge evidence:
[session6-external-source-lifecycle-local-acceptance-checkpoint-2026-10-01.md](session6-external-source-lifecycle-local-acceptance-checkpoint-2026-10-01.md).

Local acceptance used an isolated temporary Project and the repository README as a real URL source. It proved:

1. ingest -> `SNAPSHOT_READY`;
2. direct-text Index -> Context episode -> `INDEXED`;
3. unchanged refresh preserved the content-addressed Artifact and indexed state;
4. Re-index created a new Context episode;
5. detach preserved lifecycle provenance as `DETACHED`;
6. the temporary Project was archived and no active temporary binding remained.

Automated local evidence recorded **53/53 PASS**, plus lint, typecheck, secret-scan, and production build PASS.

## PR-head gates

The first PCS-06 run (#373) exposed a browser-acceptance harness gap: the product correctly requested the new lifecycle endpoint, while the isolated PCS-06 harness had no mock for that endpoint and returned 503. The harness was updated to model the new API boundary; runtime product semantics were not weakened.

Final reviewed head `828368eb6eaa00c991e52b0e4cfeea8d3abbfc35` passed:

```text
CI #2609                         PASS
Product Eval #1848               PASS
MCP External HTTPS #1203         PASS
PCS-06 browser #374              PASS
```

## Merged-main and staging proof

PR #421 merged as:

```text
15f007c5d248df8319644f2d9a6c4c7905c70681
```

Merged-main gates:

```text
CI #2610                         PASS
Product Eval #1849               PASS
MCP External HTTPS #1204         PASS
```

Staging Deploy #1968 performed the actual exact-SHA deploy and passed:

```text
target / host SHA     = 15f007c5d248df8319644f2d9a6c4c7905c70681
SHA matched           = yes
staging image         = staging-15f007c5d248
worktree              = clean / DETACHED
public/auth smoke     = PASS
MCP smoke             = PASS
Operations            = healthy
configured services   = 15
running services      = 15
non-running services  = 0
stabilized free disk  = 27.39 GiB
```

Staging Deploy #1967 is preserved as gate-only evidence; #1968 is the actual deployment proof.

## Deliberate non-claims

Session 6 closure does **not** claim:

- scheduled/automatic polling refresh;
- native Google Drive integration;
- broad connector sync beyond explicit URL/MCP-resource refresh;
- destructive purge of content-addressed Artifact bytes;
- automatic Historical Ledger purge;
- public production promotion;
- DR-2 physical independence;
- any automatically opened Session 7 scope.

SumoPod remains staging, not production.

## Resume rule

Session 6 is CLOSED / PASS / STAGING VERIFIED. Do not reopen it for freshness alone.

No implementation session is active after this closure. Any Session 7 work requires explicit operator authorization.
