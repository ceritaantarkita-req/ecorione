# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan kontrol, eksekusi, dan optimizer biaya yang bisa diaudit.**

Pindah dari Claude ke model lokal ke ChatGPT tanpa kehilangan kesinambungan kerja, sambil menjaga boundary local-first, approval, audit trail, dan biaya kontrafaktual tetap eksplisit.

> Status branch kerja: **Fase 0–4 CLOSED · Fase 5 DEFERRED BY DESIGN · Fase 6+ evidence-driven hardening aktif.**

## Kenapa ini ada

Yang sudah banyak: UI chat multi-provider, sistem memori, dan framework agent. ecorione sengaja fokus pada kombinasi yang lebih sempit: memori bersama lintas lokal+hosted, routing/provider boundary, eksekusi dengan policy/approval, durable workflow, dan pengukuran biaya yang jujur.

Riset dan keputusan arsitekturnya ada di [`docs/research.md`](docs/research.md), [`docs/prd.md`](docs/prd.md), dan [`docs/adr/`](docs/adr/).

## Klaim optimizer

Klaim optimasi dibatasi ke lever yang bisa diukur:

| Lever | Status |
|---|---|
| Prompt caching / prefix stability | implemented + regression |
| Isolasi konteks | implemented di context assembly |
| Exact-match internal cache | implemented, bounded |
| Model routing | explicit policy, tidak ada silent fallback |
| Cost ledger aktual vs naive | implemented per call |
| Emergency hosted-cost kill switch | implemented di Connect (`ECORIONE_COST_KILL_SWITCH=1`) |
| Cumulative durable spend budget | **belum** — tidak diklaim |

`ECORIONE_COST_KILL_SWITCH=1` memblokir target hosted di boundary Connect dan mengembalikan error eksplisit `COST_KILL_SWITCH_ACTIVE`; target lokal tetap dapat berjalan. Ini emergency switch, **bukan** cumulative daily/monthly budget.

## Arsitektur saat ini

Hub adalah supervisor/policy boundary. Tidak ada service yang boleh membuka database service lain secara langsung.

| Modul | Peran | Status |
|---|---|---|
| **Ai** | Chat UI + route `/space` | implemented |
| **Hub** | Policy, approval, audit, orchestration | implemented |
| **Connect** | Provider/optimizer + inbound MCP | implemented |
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

Context memakai SQLite miliknya sendiri. Service lain yang butuh state juga mempunyai storage sendiri; Artifact menyimpan bytes sebagai CAS. **Bukan satu database global**, dan tidak ada cross-module direct DB access.

## Menjalankan lokal

```bash
pnpm install
pnpm verify
```

Butuh Node ≥22 dan pnpm 10.

Salin konfigurasi development:

```bash
cp .env.example .env
```

Perintah runtime:

```bash
pnpm dev         # core P0: rnd + context + connect + hub + ai
pnpm dev:phase2  # core + MCP HTTP + Sync; butuh konfigurasi OAuth MCP
pnpm dev:phase3  # core + Artifact + Sandbox + Space
pnpm dev:phase4  # phase3 + Flow HTTP + Flow worker; Temporal harus sudah tersedia
```

Flow default mengharapkan Temporal di `127.0.0.1:7233` (`ECORIONE_TEMPORAL_ADDRESS`). Repository tidak diam-diam menyalakan managed Temporal.

## Status fase

- **Fase 0 — CLOSED:** monorepo, strict TypeScript, schema bersama, telemetry, UI foundation, CI.
- **Fase 1 — CLOSED:** Ai → Hub → Context → Connect → RnD vertical slice.
- **Fase 2 — CLOSED:** MCP inbound modern + Sync local/self-hosted. Lihat [`docs/api-fase2.md`](docs/api-fase2.md).
- **Fase 3 — CLOSED:** Artifact, Sandbox, Space + runtime acceptance nyata. Lihat [`docs/api-fase3.md`](docs/api-fase3.md).
- **Fase 4 — CLOSED:** Flow di Temporal, approval Hub, Connect, Sandbox, RnD, forced worker crash/recovery. Lihat [`docs/api-fase4.md`](docs/api-fase4.md).
- **Fase 5 — DEFERRED BY DESIGN:** belum ada use case non-API konkret yang membenarkan RPA. Lihat [`docs/fase5.md`](docs/fase5.md) dan ADR-11.
- **Fase 6+ — evidence-driven:** hardening dan perluasan hanya dari gap/use case yang terbukti; bukan checklist fitur spekulatif.

Strict closure Fase 4 dibuktikan oleh CI run `34305530219` pada HEAD docs closure: frozen lockfile, format check read-only, lint, typecheck, forced Temporal recovery tests, Docker runtime acceptance, secret scan, dan production build semuanya hijau.

## Invarian penting

- Memory adalah **untrusted data**, bukan instruksi.
- Hosted egress hanya untuk klasifikasi/sync class yang diizinkan.
- Tulisan hosted masuk quarantine, bukan langsung core memory.
- Tidak ada silent provider fallback.
- Side effect memakai idempotency identity.
- Aksi irreversible harus lewat policy/approval sesuai risk class.
- Prefix caching harus byte-stable.
- Versi model dipin; alias `-latest` ditolak CI.
- AutoClick, kalau kelak dibangun, maksimum L2 dan hanya untuk kebutuhan non-API.

## Batasan yang masih nyata

- **Production credential vault terenkripsi at-rest belum diimplementasikan.** `.env.example` hanya untuk development lokal.
- **Managed Sync relay/cloud belum ada**; v1 memakai bridge/tunnel yang dipilih pengguna sesuai ADR-16.
- **Cumulative durable cost budget belum ada**; yang tersedia sekarang emergency kill switch hosted.
- **AutoClick belum dibuat**, sengaja.
- Embedding/vector retrieval produksi belum menjadi dependency wajib; fallback retrieval tetap tersedia.
- CI provider canary harian dengan provider eksternal nyata belum ditutup sebagai production evidence.
- ecorione tidak mengklaim Docker sebagai "secure sandbox" terhadap kernel escape.

## Dokumen

| File | Isi |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Produk + arsitektur teknis |
| [`docs/research.md`](docs/research.md) | Riset & due diligence |
| [`docs/design.md`](docs/design.md) | Identitas visual & UI/UX |
| [`docs/api-fase1.md`](docs/api-fase1.md) | Kontrak Fase 1 |
| [`docs/api-fase2.md`](docs/api-fase2.md) | Kontrak Fase 2 |
| [`docs/api-fase3.md`](docs/api-fase3.md) | Kontrak Fase 3 |
| [`docs/api-fase4.md`](docs/api-fase4.md) | Kontrak Fase 4 |
| [`docs/fase5.md`](docs/fase5.md) | Gate AutoClick dan alasan defer |
| [`docs/blueprint.md`](docs/blueprint.md) | Cetak biru Fase 0–6+ |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log keputusan aktual |
| [`docs/LICENSING.md`](docs/LICENSING.md) | Batas open-core |
| [`AGENTS.md`](AGENTS.md) | Aturan kerja repo |

## Lisensi

MIT untuk kode yang sudah dirilis di repository ini. Layanan managed/hosted yang mungkin dibuat kemudian tidak mengubah lisensi kode MIT yang sudah dipublikasikan. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
