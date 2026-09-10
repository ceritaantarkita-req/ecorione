# ADR-32 — Production Operations & Observability

**Status:** Accepted  
**Date:** 2026-09-10

## Context

Ecorione sudah memiliki owner-service boundaries, GenAI cost accounting, health endpoints, Temporal durability, dan operational acceptance tests, tetapi belum memiliki satu baseline deployment self-host maupun cara melihat latency/error/cost/token/MCP/Flow/ECX secara lintas service. Membuat database observability baru di Hub akan menciptakan owner baru untuk data yang sebenarnya hanya projection operasional.

## Decision

1. `@ecorione/shared-server` menjadi instrumentation boundary untuk HTTP metrics dan W3C-compatible `traceparent` propagation.
2. Metrics bersifat bounded process-lifetime projection. Long-term retention dilakukan oleh scraper/observability backend eksternal; metrics bukan source of truth bisnis.
3. Domain metrics tetap dicatat oleh owner yang menjalankan aksi: Connect untuk model/cost/token/cache/MCP, Hub untuk ECX, Flow untuk workflow/node.
4. `/metrics` dan `/v1/ops/observability` hanya diregistrasikan pada internal-token service. `/healthz` tetap kompatibel dan unauthenticated. Sync public bridge tidak membuka endpoint telemetry baru.
5. Ai `/api/ops` hanya read-only aggregator. Browser tidak mengakses service internal langsung. Reverse proxy wajib melindungi `/ops` dan `/settings` sebagai operator surface.
6. Provider canary memakai completion boundary Connect yang sama, sehingga vault, spend budget, cache/cost, model pinning, dan telemetry tidak dibypass. CI membuktikan mekanismenya dengan local compatible stub; operator tetap harus menjalankan canary terhadap provider nyata sebelum membuat klaim quality/latency produksi.
7. Self-host baseline memakai satu image ecorione, owner-scoped persistent volumes, Temporal + PostgreSQL, dan Caddy. Hanya Caddy mempublish host ports.
8. Connect inbound MCP tetap loopback-only dengan berbagi network namespace bersama Sync. Caddy hanya meneruskan MCP ke Sync.
9. Docker socket tidak pernah dimount ke Sandbox service. Tier-2 Docker membutuhkan sandbox host/daemon terpisah; baseline Compose tidak menurunkan boundary itu demi kenyamanan deployment.
10. ECX telemetry mengukur traffic (packet/hydration bytes/count), bukan savings. Savings/cost-efficiency claim membutuhkan production traffic evidence terpisah.

## Consequences

- Trace ID dapat diikuti lintas request internal tanpa menarik SDK observability besar.
- Metrics hilang saat process restart kecuali diserap scraper eksternal; ini disengaja dan terdokumentasi.
- Deployment self-host memiliki recipe yang reproducible dan static acceptance gate, tetapi operator tetap bertanggung jawab atas DNS, OAuth issuer, secret injection, provider credentials, image scanning, backup cadence, dan host hardening.
- Batch 12 tetap bertanggung jawab atas final release/security gates dan management/release surfaces.
