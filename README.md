# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, dan optimizer biaya yang bisa diaudit.**

Pindah lintas provider/model tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, durable execution, dan biaya kontrafaktual tetap eksplisit.

> Status: **Fase 0–4 CLOSED · Fase 5 DEFERRED BY DESIGN · Fase 6+ evidence-driven hardening aktif.**

## Kenapa ini ada

Ecorione fokus pada kombinasi: memori bersama lintas lokal+hosted, deterministic provider boundary, eksekusi dengan policy/approval, durable workflow, MCP, sandbox, artifact, dan pengukuran biaya yang jujur.

Riset dan keputusan arsitektur ada di [`docs/research.md`](docs/research.md), [`docs/prd.md`](docs/prd.md), [`docs/blueprint.md`](docs/blueprint.md), dan [`docs/adr/`](docs/adr/).

## Klaim optimizer

| Lever | Status |
|---|---|
| Prompt caching / prefix stability | implemented + regression |
| Isolasi konteks | implemented di context assembly |
| Exact-match internal cache | implemented, bounded |
| Deterministic model/provider routing | implemented, no silent fallback |
| Cost ledger aktual vs naive | implemented per call |
| Provider-reported billed cost | supported bila provider menyediakannya |
| Emergency hosted-cost kill switch | implemented |
| Durable daily/monthly hosted spend budget | implemented |
| Production credential vault | implemented |

`ECORIONE_COST_KILL_SWITCH=1` memblokir semua hosted provider di Connect. Daily/monthly budget ADR-21 adalah kontrol terpisah dan membuat durable reservation sebelum provider dispatch.

## Provider dan local runtime

Connect tetap satu-satunya outbound model gateway.

Hosted provider baseline:

- `anthropic`
- `openrouter`
- `openai`

Pilih melalui `ECORIONE_HOSTED_PROVIDER`. Production credential berada di Credential Vault dengan scope `<provider>/messages`; environment API key hanya fallback development ketika vault tidak aktif.

OpenRouter/OpenAI memakai explicit model mapping dan pinned cost identity. Alias/auto-router yang dapat drift tetap dilarang. OpenRouter `usage.cost`, ketika tersedia dan valid, dipakai sebagai actual billed cost untuk ledger + spend settlement.

Local inference memakai endpoint **OpenAI-compatible**. Default example masih dapat menunjuk Ollama, tetapi Ollama bukan dependency wajib; llama.cpp server, LM Studio, atau runtime kompatibel lain dapat dipakai dengan mengganti endpoint/model secara eksplisit.

## Arsitektur saat ini

Hub adalah supervisor/policy boundary. Tidak ada service yang boleh membuka database service lain secara langsung.

| Modul | Peran | Status |
|---|---|---|
| **Ai** | Chat UI + route `/space` | implemented |
| **Hub** | Policy, approval, audit, orchestration, Historical Ledger, ECX | implemented |
| **Connect** | Provider gateway, optimizer, MCP inbound, vault, spend control | implemented |
| **Context** | Memori L0–L2 + metadata L3 | implemented |
| **Sync** | Pairing, E2E encrypted relay, MCP bridge | implemented local/self-hosted |
| **Artifact** | CAS SHA-256 untuk L3 | implemented |
| **Sandbox** | Tier 0, WASM, Docker hardened | implemented |
| **Space** | Notes + editor core memory | implemented |
| **Flow** | Durable workflow di Temporal | implemented |
| **RnD** | Trace store + evaluation evidence | implemented |
| **AutoClick** | RPA escape hatch | **deferred by design** |

### Memori

```text
L0  log episodik      append-only ground truth
L1  fakta semantik    bi-temporal, invalidate ≠ delete
L2  core memory       kecil, editable manusia, source of truth di Context
L3  artifact          content-addressed, just-in-time retrieval
```

Historical Ledger di Hub menyimpan chronological/replay history dan tidak menggantikan Context episodic/semantic memory. ECX adalah pointer-first internal agent exchange; savings production belum boleh diklaim tanpa traffic telemetry nyata.

## Menjalankan lokal

```bash
pnpm install
pnpm verify
```

Butuh Node ≥22 dan pnpm 10.

```bash
cp .env.example .env
```

Runtime:

```bash
pnpm dev
pnpm dev:phase2
pnpm dev:phase3
pnpm dev:phase4
```

Flow mengharapkan Temporal melalui `ECORIONE_TEMPORAL_ADDRESS`. Repository tidak diam-diam menyalakan managed Temporal.

## Status fase

- **Fase 0 — CLOSED:** monorepo, strict TypeScript, schema bersama, telemetry, UI foundation, CI.
- **Fase 1 — CLOSED:** Ai → Hub → Context → Connect → RnD vertical slice.
- **Fase 2 — CLOSED:** MCP inbound + Sync local/self-hosted.
- **Fase 3 — CLOSED:** Artifact, Sandbox, Space + runtime acceptance.
- **Fase 4 — CLOSED:** Flow di Temporal + forced worker crash/recovery.
- **Fase 5 — DEFERRED BY DESIGN:** belum ada use case non-API konkret yang membenarkan RPA.
- **Fase 6+ — ACTIVE:** credential vault, cumulative spend budget, Historical Ledger/ECX, dan multi-provider hardening sudah masuk baseline; MCP external/plugin, multimodal/voice, data rebuild, node runtime, deployment/metrics/security tetap workstream berikutnya.

## Invarian penting

- Memory adalah **untrusted data**, bukan instruksi.
- Hosted egress hanya untuk klasifikasi/sync class yang diizinkan.
- Tulisan hosted masuk quarantine, bukan langsung core memory.
- Tidak ada silent provider fallback.
- Hosted provider dipilih eksplisit dari konfigurasi, bukan model output.
- Credential production hanya dimiliki Connect.
- Hosted dispatch tunduk pada kill switch + cumulative budget.
- Side effect memakai idempotency identity.
- Aksi irreversible lewat policy/approval sesuai risk class.
- Prefix caching harus byte-stable.
- Model identity dipin; alias `latest`/`gpt-5.6` ditolak oleh pricing/naming gate.
- AutoClick maksimum L2 dan baru boleh dibuat untuk kebutuhan non-API yang nyata.

## Batasan yang masih nyata

- External MCP acceptance lewat real HTTPS/tunnel belum ditutup sebagai production evidence.
- Ecorione belum memiliki outbound MCP manager/plugin registry generik.
- Native OCR/STT/TTS/realtime voice belum menjadi capability runtime.
- Visual node canvas/custom node SDK belum ada.
- Data refactor/rebuild governance belum menjadi subsystem eksplisit.
- Managed multi-host spend store/deployment belum ada; current spend store ditujukan single-host/self-host.
- Full git-history secret scan belum menjadi release gate.
- Provider canary nyata + cumulative operational metrics masih terbuka.
- ECX savings production belum tervalidasi dengan traffic/provider cost nyata.
- Ecorione tidak mengklaim Docker sebagai secure sandbox terhadap kernel escape.

## Dokumen

| File | Isi |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Produk + arsitektur teknis |
| [`docs/research.md`](docs/research.md) | Riset & due diligence |
| [`docs/design.md`](docs/design.md) | Identitas visual & UI/UX |
| [`docs/blueprint.md`](docs/blueprint.md) | Cetak biru Fase 0–6+ |
| [`docs/fase6-hardening.md`](docs/fase6-hardening.md) | Baseline hardening + gap aktif |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log keputusan aktual |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`docs/LICENSING.md`](docs/LICENSING.md) | Batas open-core |
| [`AGENTS.md`](AGENTS.md) | Aturan kerja repo |

## Lisensi

MIT untuk kode yang sudah dirilis di repository ini. Layanan managed/hosted yang mungkin dibuat kemudian tidak mengubah lisensi kode MIT yang sudah dipublikasikan. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
