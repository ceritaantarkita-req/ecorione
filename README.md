# ecorione

**Satu memori bersama untuk semua AI yang lu pakai — lokal maupun hosted — plus lapisan
yang bikin tiap panggilan ke model jadi jauh lebih murah.**

Pindah dari Claude ke model lokal ke ChatGPT tanpa kehilangan kesinambungan kerja, dan
tanpa mengirim ulang seluruh riwayat tiap giliran.

> Status: **Fase 1** — loop chat inti jalan end-to-end (Ai → Hub → Context → Connect →
> RnD). Lihat [Status](#status).

## Kenapa ini ada

Yang sudah banyak: UI chat yang menggabungkan banyak provider (Open WebUI, LibreChat,
AnythingLLM) — tapi itu UI dengan RAG tipis, bukan lapisan memori. Yang juga ada: sistem
memori serius (Letta, mem0) — tapi mereka tidak peduli soal dualitas lokal/hosted dan tidak
mengoptimalkan biaya panggilan. Dan framework agent (LangGraph, CrewAI) adalah *library
untuk developer*, bukan sistem yang langsung dipakai pemiliknya.

Riset di [`docs/research.md`](docs/research.md) tidak menemukan satu pun proyek yang
menggabungkan keempatnya: routing lokal+hosted, memori bersama di antara keduanya,
eksekusi tool, dan sinkronisasi lintas device.

## Klaim "optimizer" — dan angkanya

Klaim optimasi di sini sengaja dibangun di atas lever yang bisa dibuktikan, bukan yang
enak dijual:

| Lever | Penghematan | Dasar |
|---|---|---|
| **Prompt caching** | 60–85% biaya input | Aritmetika dari tabel harga resmi provider |
| **Isolasi konteks** | 30–60% + naik kualitas | Studi independen 18 model (Context Rot) |
| Reduksi katalog tool | 0–90% | Tergantung jumlah tool |
| ~~Model routing~~ | 0–40%, risiko tinggi | Angka jujur RouteLLM: 1.41–1.49×, bukan 85% |
| ~~Semantic caching~~ | **dicoret** | Hit rate 10–20%, mode gagalnya jawaban salah |

Setiap panggilan model mencatat **biaya kontrafaktual** — berapa request yang sama akan
berbiaya di bawah kebijakan naif. Selisihnya satu-satunya angka penghematan yang jujur.
Angka penghematan tanpa angka kualitas di sebelahnya tidak berarti apa-apa.

## Arsitektur

11 modul internal di satu monorepo. Hub adalah supervisor; tidak ada modul yang mengakses
database modul lain secara langsung.

| Modul | Peran | Prioritas |
|---|---|---|
| **Ai** | Interface chat/agent | P0 |
| **Hub** | Policy engine, approval gate, durable state, audit log | P0 |
| **Connect** | Outbound: provider + optimizer. Inbound: server MCP | P0 |
| **Context** | Memori 4 tier (L0–L3) | P0 |
| **Sync** | Relay lintas device + jembatan HTTPS untuk AI hosted | P1 |
| **Space** | Workspace + editor memori inti | P1 |
| **Flow** | Workflow di atas durable execution yang diadopsi | P1 |
| **Artifact** | Content-addressed storage (tier L3) | P1 |
| **Sandbox** | Eksekusi terisolasi: WASM default, Docker+WSL2 eskalasi | P1 |
| **RnD** | Trace store + eval harness | P1 |
| **AutoClick** | RPA — escape hatch, bukan jalur utama | P2 |

### Memori

```
L0  log episodik      append-only, ground truth, tidak pernah diedit
L1  fakta semantik    bi-temporal (t_valid/t_invalid), invalidate ≠ hapus
L2  memori inti       selalu di konteks, ≤1.500 token, file yang bisa diedit manusia
L3  artifact          just-in-time retrieval lewat pointer
```

Tier selain L0 adalah **proyeksi yang bisa dibangun ulang**. Kalau konsolidasi menulis
fakta salah, hapus tier turunannya dan turunkan ulang.

Penyimpanan: satu file SQLite (`sqlite-vec` + FTS5). Bukan graph DB — lihat ADR-05.

### Peran model lokal

Di RAM 8–16GB, model lokal **bukan agent**. Model <7B gagal sistematis pada tool-calling
multi-tool. Perannya: gerbang salience, ekstraksi fakta, konsolidasi memori, klasifikasi
tugas, reranking, redaksi. Agent loop tetap di model hosted (ADR-04).

## Mulai

```bash
pnpm install
pnpm verify     # format + lint + typecheck + test + secret-scan
```

Butuh Node ≥22 dan pnpm 10.

Untuk menjalankan loop chat penuh secara lokal:

```bash
cp .env.example .env
# isi ANTHROPIC_API_KEY di .env — tanpa ini Connect membalas 502 jelas untuk target
# hosted, bukan gagal samar (lihat "Batasan yang dinyatakan di muka")
pnpm dev        # rnd, context, connect, hub, ai — lima proses lewat `concurrently`
```

Ai jalan di `http://localhost:3000`. Lima service bind ke `127.0.0.1` saja (lihat
`docs/api-fase1.md` untuk port masing-masing) dan semuanya menulis ke satu `./data/` di
akar repo — direktorinya dibuat otomatis kalau belum ada.

## Status

**Fase 1 — loop inti jalan end-to-end.** `services/rnd` (trace store), lapisan HTTP
`services/context`, `services/connect` (outbound provider + optimizer), `services/hub`
(policy engine, approval gate, audit log, orkestrasi) dan `apps/ai` (chat UI Next.js)
semuanya ada, saling terhubung lewat HTTP asli, dan diverifikasi lewat:

- **285 test lewat `pnpm verify`** (36 berkas) — `http.test.ts` per service plus
  `repository`/`orchestrate`/`policy-engine`/`retrieval`/dst — provider hosted selalu
  di-mock lewat `undici` `MockAgent`, tidak ada test yang butuh `ANTHROPIC_API_KEY` asli.
- **`test/chat-loop.test.ts`** — 8 kasus emas yang menjalankan RnD/Context/Connect
  sungguhan di port acak dan Hub memanggil ketiganya lewat `fetch` asli (bukan mock):
  giliran chat penuh, audit trail berurutan, ringkasan biaya RnD, cache exact-match,
  stabilitas prefix (ADR-01) diukur dari body sungguhan yang dikirim ke Anthropic,
  gerbang sensitivitas (ADR-02), lupa-fakta lewat karantina, dan "tidak ada fallback
  diam-diam" (`prd.md` §7) saat Context/Connect tidak bisa dihubungi.
- **`pnpm dev` diuji jalan sungguhan** — bukan cuma `pnpm verify` hijau: kelima proses
  dinyalakan bareng dan giliran chat/lupa dicoba lewat `curl` sungguhan ke `apps/ai`.

Sebuah modul tidak dilabeli selesai kecuali bisa dipakai end-to-end. "Test-nya lulus"
bukan "selesai" — label status yang menyesatkan adalah kegagalan spesifik yang proyek ini
dibangun untuk menghindarinya.

**Belum ada di Fase 1**: ringkasan episodik otomatis (dipotong ~300 karakter untuk
sementara, ditandai jelas di kode), jalur vektor untuk retrieval (BM25/FTS5 leksikal saja
sampai ada layanan embedding), executor nyata di balik approval gate (Sandbox/Flow adalah
Fase 3/4), dan UI approval (`POST /v1/approvals/:id/decide` sudah ada dan teruji, tanpa
panel di Ai).

Roadmap lengkap: [`docs/prd.md`](docs/prd.md) §23. Kontrak HTTP antar-service:
[`docs/api-fase1.md`](docs/api-fase1.md).

## Batasan yang dinyatakan di muka

- **Bukan "secure sandbox".** Docker+WSL2 mencegah kecelakaan dan paket buruk kasual;
  tidak mencegah eksploitasi kernel yang ditentukan (ADR-10).
- **Bukan "semua AI otomatis mengingat".** Konektor Claude API cuma dukung tool call;
  ChatGPT dibatasi paket dan mode. Yang benar: *satu memori, bisa dipanggil sebagai tool
  dari semua asisten besar* (ADR-09).
- **Plafon otonomi adalah L3**, bukan L4. Agent terbaik menyelesaikan ~30% tugas bisnis
  multi-langkah realistis. Yang membatasi bukan kepintaran model, tapi verifikasi
  (`docs/prd.md` §22).
- **Local-first vs "ChatGPT bisa baca memori gue" bertentangan secara fisik.** Asisten
  hosted butuh HTTPS publik. Batas sinkronisasinya eksplisit dan terlihat pengguna.

## Dokumen

| File | Isi |
|---|---|
| [`docs/prd.md`](docs/prd.md) | Produk + arsitektur teknis |
| [`docs/research.md`](docs/research.md) | Riset & due diligence — alasan tiap keputusan |
| [`docs/design.md`](docs/design.md) | Identitas visual & UI/UX |
| [`docs/api-fase1.md`](docs/api-fase1.md) | Kontrak HTTP antar-service Fase 1 |
| [`docs/fase2.md`](docs/fase2.md) | Rencana Fase 2: server MCP (Connect inbound) + Sync — apa yang harus dibangun, rinci |
| [`docs/adr/`](docs/adr/) | 15 architecture decision record |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log keputusan kecil, satu baris per keputusan |
| [`docs/LICENSING.md`](docs/LICENSING.md) | Model open-core: modul mana selalu open source, mana kandidat berbayar |
| [`AGENTS.md`](AGENTS.md) | Konvensi untuk AI yang mengerjakan repo ini |

## Lisensi

MIT — dan tetap begitu selamanya untuk kode yang sudah dirilis. ecorione open core:
mesin inti di repo ini gratis dan open source seterusnya; modul yang butuh
infrastruktur terkelola (relay lintas device, hosting) adalah kandidat tier berbayar
di repo terpisah nanti, tidak pernah di repo ini. Lihat [`docs/LICENSING.md`](docs/LICENSING.md).
