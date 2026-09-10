from pathlib import Path
import json


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"STOP {path}: expected one marker, got {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))

# Keep MCP inbound in the Sync network namespace so its 127.0.0.1 listener remains private.
compose = Path("deploy/compose.yml")
text = compose.read_text()
old = '''  mcp:\n    <<: *app\n    command: ["node", "services/connect/dist/mcp/http-main.js"]\n    network_mode: service:sync\n    networks: !reset []\n    environment:\n      <<: *runtime-env\n      ECORIONE_MCP_HOST: 127.0.0.1\n      ECORIONE_MCP_PORT: 17010\n      ECORIONE_MCP_OAUTH_ISSUER: ${ECORIONE_MCP_OAUTH_ISSUER:?set ECORIONE_MCP_OAUTH_ISSUER}\n      ECORIONE_MCP_RESOURCE: ${ECORIONE_MCP_RESOURCE:?set ECORIONE_MCP_RESOURCE}\n      ECORIONE_MCP_JWKS_URL: ${ECORIONE_MCP_JWKS_URL:?set ECORIONE_MCP_JWKS_URL}\n      ECORIONE_MCP_HANDLE_KEY: ${ECORIONE_MCP_HANDLE_KEY:?set ECORIONE_MCP_HANDLE_KEY}\n      ECORIONE_MCP_ALLOWED_ORIGINS: ${ECORIONE_MCP_ALLOWED_ORIGINS:?set ECORIONE_MCP_ALLOWED_ORIGINS}\n    depends_on: [sync, hub]\n'''
new = '''  mcp:\n    build:\n      context: ..\n      dockerfile: Dockerfile\n    image: ecorione:${ECORIONE_IMAGE_TAG:-local}\n    restart: unless-stopped\n    command: ["node", "services/connect/dist/mcp/http-main.js"]\n    network_mode: service:sync\n    environment:\n      <<: *runtime-env\n      ECORIONE_MCP_HOST: 127.0.0.1\n      ECORIONE_MCP_PORT: 17010\n      ECORIONE_MCP_OAUTH_ISSUER: ${ECORIONE_MCP_OAUTH_ISSUER:?set ECORIONE_MCP_OAUTH_ISSUER}\n      ECORIONE_MCP_RESOURCE: ${ECORIONE_MCP_RESOURCE:?set ECORIONE_MCP_RESOURCE}\n      ECORIONE_MCP_JWKS_URL: ${ECORIONE_MCP_JWKS_URL:?set ECORIONE_MCP_JWKS_URL}\n      ECORIONE_MCP_HANDLE_KEY: ${ECORIONE_MCP_HANDLE_KEY:?set ECORIONE_MCP_HANDLE_KEY}\n      ECORIONE_MCP_ALLOWED_ORIGINS: ${ECORIONE_MCP_ALLOWED_ORIGINS:?set ECORIONE_MCP_ALLOWED_ORIGINS}\n    depends_on: [sync, hub]\n'''
if text.count(old) != 1:
    raise SystemExit("STOP compose mcp marker")
compose.write_text(text.replace(old, new, 1))

replace_once(
    "services/sync/src/http.ts",
    '''    "mcp-name",\n  ]) {''',
    '''    "mcp-name",\n    "traceparent",\n    "x-request-id",\n  ]) {''',
)

# Root operator commands.
p = Path("package.json")
package = json.loads(p.read_text())
package["scripts"]["acceptance:production-ops"] = "node scripts/production-ops-acceptance.mjs"
package["scripts"]["canary:provider"] = "node scripts/provider-canary.mjs"
p.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n")

replace_once(
    ".github/workflows/ci.yml",
    '''      - name: Secret scan\n        run: pnpm run secret-scan\n''',
    '''      - name: Production operations acceptance\n        run: pnpm run acceptance:production-ops\n\n      - name: Secret scan\n        run: pnpm run secret-scan\n''',
)

replace_once(
    ".env.example",
    '''ECORIONE_FLOW_URL=http://127.0.0.1:17028\nECORIONE_AI_PORT=3000''',
    '''ECORIONE_FLOW_URL=http://127.0.0.1:17028\nECORIONE_SYNC_URL=http://127.0.0.1:17011\nECORIONE_AI_PORT=3000''',
)

# ADR and decision log.
Path("docs/adr/0032-production-operations-observability.md").write_text('''# ADR-32 — Production Operations & Observability\n\n**Status:** Accepted  \n**Date:** 2026-09-10\n\n## Context\n\nEcorione sudah memiliki owner-service boundaries, GenAI cost accounting, health endpoints, Temporal durability, dan operational acceptance tests, tetapi belum memiliki satu baseline deployment self-host maupun cara melihat latency/error/cost/token/MCP/Flow/ECX secara lintas service. Membuat database observability baru di Hub akan menciptakan owner baru untuk data yang sebenarnya hanya projection operasional.\n\n## Decision\n\n1. `@ecorione/shared-server` menjadi instrumentation boundary untuk HTTP metrics dan W3C-compatible `traceparent` propagation.\n2. Metrics bersifat bounded process-lifetime projection. Long-term retention dilakukan oleh scraper/observability backend eksternal; metrics bukan source of truth bisnis.\n3. Domain metrics tetap dicatat oleh owner yang menjalankan aksi: Connect untuk model/cost/token/cache/MCP, Hub untuk ECX, Flow untuk workflow/node.\n4. `/metrics` dan `/v1/ops/observability` hanya diregistrasikan pada internal-token service. `/healthz` tetap kompatibel dan unauthenticated. Sync public bridge tidak membuka endpoint telemetry baru.\n5. Ai `/api/ops` hanya read-only aggregator. Browser tidak mengakses service internal langsung. Reverse proxy wajib melindungi `/ops` dan `/settings` sebagai operator surface.\n6. Provider canary memakai completion boundary Connect yang sama, sehingga vault, spend budget, cache/cost, model pinning, dan telemetry tidak dibypass. CI membuktikan mekanismenya dengan local compatible stub; operator tetap harus menjalankan canary terhadap provider nyata sebelum membuat klaim quality/latency produksi.\n7. Self-host baseline memakai satu image ecorione, owner-scoped persistent volumes, Temporal + PostgreSQL, dan Caddy. Hanya Caddy mempublish host ports.\n8. Connect inbound MCP tetap loopback-only dengan berbagi network namespace bersama Sync. Caddy hanya meneruskan MCP ke Sync.\n9. Docker socket tidak pernah dimount ke Sandbox service. Tier-2 Docker membutuhkan sandbox host/daemon terpisah; baseline Compose tidak menurunkan boundary itu demi kenyamanan deployment.\n10. ECX telemetry mengukur traffic (packet/hydration bytes/count), bukan savings. Savings/cost-efficiency claim membutuhkan production traffic evidence terpisah.\n\n## Consequences\n\n- Trace ID dapat diikuti lintas request internal tanpa menarik SDK observability besar.\n- Metrics hilang saat process restart kecuali diserap scraper eksternal; ini disengaja dan terdokumentasi.\n- Deployment self-host memiliki recipe yang reproducible dan static acceptance gate, tetapi operator tetap bertanggung jawab atas DNS, OAuth issuer, secret injection, provider credentials, image scanning, backup cadence, dan host hardening.\n- Batch 12 tetap bertanggung jawab atas final release/security gates dan management/release surfaces.\n''')

replace_once(
    "docs/adr/README.md",
    "Tiga puluh satu keputusan yang membentuk ecorione",
    "Tiga puluh dua keputusan yang membentuk ecorione",
)
replace_once(
    "docs/adr/README.md",
    '''| [31](0031-space-block-runtime.md) | Space menyimpan composition/version/order; linked memory/blob/Flow tetap pointer-only ke owner service |\n''',
    '''| [31](0031-space-block-runtime.md) | Space menyimpan composition/version/order; linked memory/blob/Flow tetap pointer-only ke owner service |\n| [32](0032-production-operations-observability.md) | Production ops memakai owner-local metrics + trace propagation dan self-host deployment tanpa source-of-truth baru |\n''',
)
with Path("docs/DECISIONS.md").open("a") as f:
    f.write("\n| 2026-09-10 | Production observability memakai shared HTTP trace/metrics + owner-local domain telemetry; Ai hanya read-only aggregator dan Compose tidak mengekspos service internal atau Docker socket | ADR-32, `docs/production-operations.md` |\n")

Path("docs/production-operations.md").write_text('''# Production / Self-host Operations\n\nBatch 11 menyediakan baseline operasional yang dapat diuji. Ini bukan klaim bahwa satu Compose file menggantikan host hardening, secret manager, monitoring retention, OAuth provider, atau incident process.\n\n## Deployment\n\n1. Salin `deploy/production.env.example` menjadi `deploy/production.env` dan ganti seluruh `CHANGE_ME`. File target sudah ter-cover pola `.env.*` di `.gitignore` dan tidak boleh di-commit.\n2. Generate internal token, Sync owner token, Connect Vault master key, dan Caddy password hash di luar repo. Provider hosted credential dimasukkan ke Connect Vault, bukan Compose/env plaintext.\n3. Isi OAuth issuer/resource/JWKS/origin untuk MCP.\n4. Jalankan `docker compose --env-file deploy/production.env -f deploy/compose.yml config --quiet`, lalu `docker compose --env-file deploy/production.env -f deploy/compose.yml up -d --build`.\n5. Hanya Caddy mempublish 80/443. Service internal berada di Docker network; MCP HTTP tetap `127.0.0.1:17010` dalam network namespace Sync.\n\nImage infrastructure dipin eksplisit: Temporal `1.31.2`, PostgreSQL `17.6-alpine`, Caddy `2.11.4-alpine`, Node build image `22.20.0-bookworm-slim`. Jangan ganti menjadi `latest`; upgrade dilakukan sebagai perubahan tervalidasi.\n\n### Persistent owners\n\nVolume terpisah: RnD, Context, Connect, Hub, Artifact, Sandbox, Space, Flow, Sync, Temporal DB, dan Caddy state. Backup/restore tetap memakai owner-service DR contract Batch 8; volume bukan alasan untuk melakukan cross-service DB read.\n\n### Sandbox\n\nCompose sengaja tidak mount `/var/run/docker.sock`. Tier 0/Tier 1.5 dapat berjalan di service Sandbox. Tier 2 Docker memerlukan sandbox host/daemon terpisah sesuai ADR-10; jangan memperlemah isolation dengan host Docker socket.\n\n## Metrics and traces\n\nInternal-token services expose:\n\n- `GET /metrics` — Prometheus-compatible counters plus bounded percentile summary lines;\n- `GET /v1/ops/observability` — structured process-lifetime counters/histograms/recent request spans;\n- `GET /healthz` — existing compatibility health endpoint.\n\nHTTP instrumentation records route template, method, status class, duration, request ID, trace ID, and span ID. It never records request/response body, prompt, Authorization, provider key, or user memory content. Label/value lengths and series count are bounded.\n\n`httpJson` propagates the current trace with a child span ID. Direct ECX Artifact hydration and Sync→MCP forwarding also propagate trace headers. Ai `/api/ops` reads owner snapshots server-side and groups recent spans by trace ID. `/ops` renders fleet health, p50/p95, error count, cost/tokens/cache-related counters, MCP, Flow, ECX, and recent distributed traces.\n\nProcess metrics reset on restart. Use an external scraper if durable time-series retention is required. Do not copy those metrics back into owner databases.\n\n## Provider canary\n\nRun:\n\n```bash\nECORIONE_CANARY_TARGET=local pnpm run canary:provider\nECORIONE_CANARY_TARGET=hosted pnpm run canary:provider\n```\n\nOptional floors: `ECORIONE_CANARY_EXPECT`, `ECORIONE_CANARY_PROMPT`, `ECORIONE_CANARY_MIN_OUTPUT_CHARS`, `ECORIONE_CANARY_MAX_LATENCY_MS`. A canary calls `POST /v1/ops/provider-canary`, which uses the same Connect completion/vault/spend/cost path. CI tests the contract with a deterministic local HTTP provider only. Hosted quality/latency must be measured by the operator with real credentials; no production quality claim is inferred from CI.\n\n## ECX telemetry boundary\n\nECX exposes packet/candidate/packet-byte and hydration item/byte counters. These answer “how much traffic was exchanged,” not “how many tokens/dollars were saved.” A savings claim remains prohibited until real comparative production telemetry exists.\n\n## Acceptance\n\n`pnpm run acceptance:production-ops` fails unless Compose parses, only Caddy publishes ports, infrastructure images are pinned, owner volumes exist, MCP remains loopback through Sync namespace sharing, Caddy protects operator routes, and no Docker socket is mounted. This gate runs in regular CI.\n''')

Path("docs/verification/batch11-production-ops-2026-09-10.md").write_text('''# Batch 11 — Production Operations & Observability Verification\n\nDate: 2026-09-10  \nStatus: implementation candidate; exact-head and merge closure evidence pending\n\n## Implemented baseline\n\n- shared bounded HTTP metrics with process p50/p95 and error counters;\n- validated/generated `traceparent` context plus internal HTTP propagation;\n- protected `/metrics` and `/v1/ops/observability` for tokenized services;\n- Connect model/token/cache/cost/provider canary metrics;\n- outbound MCP discovery/tool latency and outcome metrics;\n- Hub ECX packet/hydration traffic metrics without savings claims;\n- Flow run/node/approval/input counters;\n- Ai read-only `/ops` aggregator/dashboard with trace grouping;\n- provider quality-floor canary through the normal Connect boundary;\n- pinned Docker/Compose + Temporal/PostgreSQL/Caddy recipe;\n- owner-scoped persistent volumes and operator-route Basic Auth;\n- MCP loopback preserved through `network_mode: service:sync`;\n- no Docker socket in the baseline;\n- production deployment acceptance added to CI.\n\n## Evidence policy\n\nCI proves the canary mechanism using a deterministic OpenAI-compatible local stub. It does not contain hosted provider credentials and therefore does not claim real hosted-provider quality or latency. Process metrics are operational projections; durable time series require an external scraper. ECX counters are traffic evidence only and do not establish cost/token savings.\n\nFinal exact-head CI/MCP acceptance, implementation merge, post-merge main CI, closure PR, and final post-closure main evidence are recorded only after those events occur.\n''')

replace_once(
    "docs/EXECUTION-PROGRESS.md",
    '''## Batch 11 — Production Operations & Observability\n\nStatus: **PLANNED / PARTIAL FOUNDATION EXISTS**''',
    '''## Batch 11 — Production Operations & Observability\n\nStatus: **IN PROGRESS**''',
)
