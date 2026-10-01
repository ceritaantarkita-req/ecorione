# Session 5 — Project Source Picker Closure — 2026-10-01

**Status:** CLOSED / PASS / STAGING VERIFIED

## Exact boundary

```text
runtime PR           = #419
reviewed head        = a299e88e52b161fd4246a09aa411bf87357e8b18
merged main          = 12d62cd436ce69bb57e51cdaaf0894e73def4c03
staging image        = staging-12d62cd436ce
staging deploy       = #1958
```

Session 5 productized the existing Project Sources foundation. It did not create a duplicate source database or move source ownership away from Artifact, Space, Flow, MCP/Connect, or Hub.

## Product behavior closed

- searchable Project Source Picker for Artifact, Space page, Flow graph, and MCP server catalogs;
- URL remains an explicit manual source path;
- Source / Reference role remains explicit;
- one-click attach with exact `Terpasang` state;
- duplicate attach is blocked for the same resource + role;
- detach returns the resource to an attachable state;
- unavailable/revoked owner resources preserve existing availability handling;
- picker is scroll-bounded and responsive;
- upload/extract/URL-ingest/MCP-resource paths remain compatible without broadening Session 6 ingestion lifecycle scope.

## Local acceptance

Operator browser acceptance proved the real Artifact flow:

```text
Tambah -> Terpasang -> AVAILABLE binding -> Lepas -> attachable again
```

Real reversible owner-binding acceptance against Project `mainlagihub` proved:

```text
Space page page_ccfa8d39700f4277b7340012
attach -> AVAILABLE -> detach PASS

Flow graph fg_48c1d632694947db8e39b866
attach -> AVAILABLE -> detach PASS

binding count before/after = 2 -> 2
```

Post-bootstrap source catalog evidence:

```text
Artifact    25
Space page   2
Flow graph   9
MCP server   0 (healthy empty registry)
warnings     none
```

No fake MCP server was created merely to manufacture a positive row.

## Local runtime bootstrap correction

The first acceptance pass exposed that the default `pnpm dev` only started a subset of owner services. Commit `c7fb550b7643bfebae325811f1c432ca57985bb8` closed that gap:

- Artifact and Space now start in the normal local dev stack;
- Flow API + Flow worker start in the normal local dev stack;
- Temporal CLI dev-server starts automatically when port 7233 is not already reachable;
- an existing Temporal instance is reused rather than duplicated;
- the spawned Temporal process is cleaned up with the dev session;
- missing Temporal CLI fails explicitly rather than silently degrading Flow.

## Verification

Local Session 5 regression:

```text
test files = 14 PASS / 14
tests      = 38 PASS / 38
lint       = PASS
typecheck  = PASS
secret-scan= PASS
build      = PASS
```

Exact PR head `a299e88e52b161fd4246a09aa411bf87357e8b18`:

```text
CI #2604                         PASS
Product Eval #1843               PASS
PCS-06 browser #372              PASS
secret-history                   PASS
production build                 PASS
```

Merged main `12d62cd436ce69bb57e51cdaaf0894e73def4c03`:

```text
CI #2605                         PASS
Product Eval #1844               PASS
Staging Deploy #1957             gate-only / deploy skipped
Staging Deploy #1958             actual deploy PASS
```

## Staging runtime proof

Staging Deploy #1958 deployed exact reviewed main SHA:

```text
expected SHA       = 12d62cd436ce69bb57e51cdaaf0894e73def4c03
host SHA           = 12d62cd436ce69bb57e51cdaaf0894e73def4c03
SHA match          = true
image              = staging-12d62cd436ce
host worktree      = clean / DETACHED
public/auth smoke  = PASS
MCP smoke          = PASS
Operations healthy = true
unhealthy services = []
configured/running = 15 / 15
non-running        = 0
free disk before   = 23.93 GiB
free disk stable   = 25.27 GiB
```

SumoPod remains staging, not production.

## Closure boundary

Session 5 is closed. Do not redo the source picker, owner catalog, local owner-service bootstrap, or attach/detach work for freshness.

The next authorized roadmap slot may be Session 6, but it must start from the exact synchronized current `main` and must preserve this Session 5 boundary. Session 6 owns external-source ingestion/indexing/refresh/lifecycle productization; it must not reinterpret Session 5 bindings as copied owner data.
