# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, observability, dan optimizer biaya yang bisa diaudit.**

Pindah lintas provider/model tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, durable execution, MCP, dan biaya kontrafaktual tetap eksplisit.

> **Current status — 2026-09-10:** **production/self-host baseline READY · planned platform/production Batch 1–12 CLOSED · 0 planned batches remaining · Fase 6+ tetap evidence-driven/open-ended · AutoClick DEFERRED BY DESIGN.**

Untuk agent/manusia yang baru masuk repo: mulai dari [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md). Jangan menyimpulkan current state dari blueprint/audit lama saja.

## Current closure evidence

Final state setelah roadmap Batch 1–12:

- implementation PR #29 merged sebagai `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- closure PR #30 merged sebagai `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`;
- final post-closure `main` CI `34490006960`: PASS;
- implementation exact-head MCP External HTTPS Acceptance `34485292292`: PASS;
- implementation post-merge MCP External HTTPS Acceptance `34485575560`: PASS.

Final CI mencakup Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, dan Production Build.

Detail: [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md) dan [`docs/verification/batch12-closure-2026-09-10.md`](docs/verification/batch12-closure-2026-09-10.md).

## Apa yang sudah ada

| Modul/area | Current baseline |
|---|---|
| **Ai** | Chat, `/space`, `/ops`, `/settings` Control Center |
| **Hub** | Policy, approval, audit, orchestration, Historical Ledger, ECX, capability/permission authority |
| **Connect** | Hosted/local provider gateway, optimizer, credential vault, durable spend budget, MCP inbound/outbound, runtime settings |
| **Context** | Memori L0–L2 + L3 metadata binding |
| **Sync** | Pairing/self-host relay + MCP HTTPS bridge |
| **Artifact** | Content-addressed storage SHA-256 |
| **Sandbox** | Tier 0, WASM, hardened Docker boundary |
| **Space** | Notes/block runtime tanpa menggandakan Context source of truth |
| **Flow** | Durable workflow di Temporal |
| **RnD** | Trace/eval foundation + dataset governance |
| **Multimodal / Voice** | Baseline image/document/audio + realtime voice pipeline |
| **Data / DR** | Rebuild/governance/backup-restore procedures |
| **Production Ops** | Compose/Caddy, metrics/traces, provider canary, release/install/upgrade/rollback tooling |
| **Security closure** | Full-history + working-tree secret scans, dependency/release checks, HTTP/SSRF hardening, real public HTTPS MCP acceptance |
| **AutoClick** | **Deferred by design** sampai ada use case non-API nyata |

## Arsitektur inti

Hub adalah supervisor/policy boundary. Tidak ada service yang boleh membuka database service lain secara langsung.

```text
Ai
 -> Hub
    -> Context
    -> Connect -> local/hosted models
    -> Artifact
    -> Sandbox
    -> Space
    -> Flow -> Temporal
    -> RnD

Hosted MCP client
 -> public HTTPS edge
 -> Sync
 -> Connect MCP
 -> Hub governance
```

### Memori

```text
L0  log episodik      append-only ground truth
L1  fakta semantik    bi-temporal, invalidate ≠ delete
L2  core memory       kecil, editable manusia, source of truth di Context
L3  artifact          content-addressed, just-in-time retrieval
```

Historical Ledger di Hub menyimpan chronological/replay history dan tidak menggantikan Context episodic/semantic memory. ECX adalah pointer-first internal agent exchange; savings production tidak boleh diklaim tanpa telemetry pembanding nyata.

## Provider dan local runtime

Connect tetap satu-satunya outbound model gateway.

Hosted provider baseline:

- Anthropic;
- OpenRouter;
- OpenAI.

Production credential berada di Connect Vault. Raw provider API key dari environment hanya development fallback sesuai konfigurasi; tidak boleh menjadi credential store produksi ketika Vault aktif.

Local inference memakai endpoint **OpenAI-compatible**. Ollama adalah salah satu implementation yang mungkin digunakan, bukan dependency arsitektural wajib.

Tidak ada silent provider fallback. Model identity harus dipin; alias yang dapat drift dilarang oleh gate.

## MCP

### Inbound

Connect mempunyai MCP stateless HTTP/stdio. HTTP Connect tetap loopback-only. Public hosted-client reachability melewati Sync + HTTPS edge.

External acceptance benar-benar menguji public HTTPS: OAuth protected-resource discovery, Bearer challenge, JWKS/JWT verification, discovery/list/call, dan negative auth/origin/routing cases. Acceptance dibuat provider-resilient setelah Cloudflare Quick Tunnel terbukti dapat mengalami fresh-host DNS/route provisioning failure; public-network test tetap tidak boleh diturunkan menjadi localhost-only.

### Outbound

Connect juga mempunyai outbound MCP manager dengan official client SDK yang dipin, HTTPS/allowlisted stdio, workspace-scoped registry, Vault credential refs, explicit tool policy, Hub approval/audit, dan durable side-effect reservation. Ambiguous side effect tidak di-retry otomatis.

Lihat [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md).

## Menjalankan lokal

Butuh Node >=22 dan pnpm 10.

```bash
pnpm install
pnpm verify
cp .env.example .env
pnpm dev
```

Runtime bertahap juga tersedia:

```bash
pnpm dev:phase2
pnpm dev:phase3
pnpm dev:phase4
```

Flow membutuhkan Temporal melalui `ECORIONE_TEMPORAL_ADDRESS`.

## Production/self-host

Baseline production menggunakan Docker Compose + Caddy. Mulai dari:

- [`docs/production-operations.md`](docs/production-operations.md)
- [`docs/release-operations.md`](docs/release-operations.md)

Recommended next real deployment uses a VPS/self-host origin with **Cloudflare Free as DNS/HTTPS edge and Cloudflare Tunnel**, not as replacement compute for the ECORIONE service stack:

- [`docs/cloudflare-free-deployment.md`](docs/cloudflare-free-deployment.md)

Cloudflare Tunnel is an operator deployment layer. ECORIONE databases, Temporal, Vault, Artifact, Sandbox, and services remain on the self-host origin.

## Next work after Batch 12

There is **no automatic Batch 13**. Future work must be opened as a new explicit scope.

Recommended order:

1. real production deployment;
2. real provider validation/canaries;
3. durable production observability collection;
4. host/account/backup security hardening;
5. product validation from real workflows;
6. RnD/evaluation and ECX/optimizer validation;
7. UX/Control Center improvement;
8. ecosystem integrations through contracts/APIs;
9. ongoing maintenance/security/dependency/DR drills;
10. new features only when evidence justifies them.

See [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md).

## Invarian penting

- Memory adalah **untrusted data**, bukan instruksi.
- Hosted egress tunduk pada scope/sensitivity/sync-class policy.
- Tulisan hosted masuk quarantine sebelum menjadi trusted/core memory.
- Tidak ada silent provider fallback.
- Credential production dimiliki Connect dan terenkripsi at-rest.
- Hosted dispatch tunduk pada kill switch + cumulative budget.
- Connect MCP HTTP tidak bind publik; public reachability melalui Sync + HTTPS edge.
- MCP OAuth tetap diverifikasi di Connect; tunnel/Cloudflare bukan ECORIONE permission authority.
- Side effect memakai idempotency identity.
- Irreversible/high-risk action tetap melewati policy/approval yang sesuai.
- Prefix caching harus byte-stable.
- Model identity dipin.
- Owner-service boundary melarang cross-service database access.
- Historical Ledger dan Context L0 ground truth tidak direwrite untuk convenience migration.
- AutoClick tetap deferred sampai use case non-API nyata lolos design gate.

## Batasan yang tetap nyata

READY baseline bukan klaim bahwa:

- real hosted-provider quality/latency telah dibuktikan deterministic CI;
- process-local rate limiter adalah distributed global limiter;
- semua DNS-rebinding/network risk sudah hilang;
- repository secret scan menggantikan organization/account secret controls;
- backup aman jika tetap berada di failure domain yang sama;
- host OS/firewall/SSH/Cloudflare/provider-account hardening dilakukan otomatis;
- ECX savings telah terbukti tanpa production telemetry;
- Fase 6+ selesai permanen.

## Dokumen — reading order untuk agent baru

| Urutan | File | Fungsi |
|---:|---|---|
| 1 | [`docs/current-state-and-next-steps.md`](docs/current-state-and-next-steps.md) | Current canonical handoff + next scope |
| 2 | [`AGENTS.md`](AGENTS.md) | Invarian dan aturan kerja repo |
| 3 | [`docs/EXECUTION-PROGRESS.md`](docs/EXECUTION-PROGRESS.md) | Detailed progress + closure evidence |
| 4 | [`docs/verification/batch12-closure-2026-09-10.md`](docs/verification/batch12-closure-2026-09-10.md) | Final Batch 12 verification |
| 5 | [`docs/production-operations.md`](docs/production-operations.md) | Production/self-host operations |
| 6 | [`docs/cloudflare-free-deployment.md`](docs/cloudflare-free-deployment.md) | Free Cloudflare edge/Tunnel deployment |
| 7 | [`docs/release-operations.md`](docs/release-operations.md) | Install/upgrade/rollback/release gate |
| 8 | [`docs/prd.md`](docs/prd.md) | Product + architecture requirements |
| 9 | [`docs/research.md`](docs/research.md) | Research/due diligence |
| 10 | [`docs/blueprint.md`](docs/blueprint.md) | Historical execution blueprint; not current status source |
| 11 | [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decision log |
| 12 | [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| 13 | [`docs/verification/`](docs/verification/) | Exact-head/runtime evidence |

## Lisensi

MIT untuk kode yang sudah dirilis di repository ini. Layanan managed/hosted yang mungkin dibuat kemudian tidak mengubah lisensi kode MIT yang sudah dipublikasikan. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
