# AGENTS.md — konvensi untuk AI yang mengerjakan repo ini

ecorione adalah lapisan memori dan optimizer bersama untuk AI lokal maupun hosted.
Baca `docs/prd.md` untuk apa & kenapa, `docs/research.md` untuk alasan di balik tiap
keputusan arsitektur, `docs/design.md` untuk identitas visual.

## Perintah

```bash
pnpm install          # sekali di awal
pnpm verify           # format + lint + typecheck + test + secret-scan (jalankan sebelum commit)
pnpm test             # vitest sekali jalan
pnpm test:watch       # vitest mode watch
pnpm typecheck        # tsc --build seluruh project reference
pnpm secret-scan      # pemindai kredensial lokal
```

`pnpm verify` harus hijau sebelum PR dibuka. CI menjalankan hal yang sama.

## Aturan yang tidak bisa dinegosiasikan

Ini bukan preferensi gaya — ini invarian yang kalau dilanggar merusak klaim inti produk.
Nomor ADR merujuk ke `docs/adr/`.

1. **Prefix stabil harus byte-identik** (ADR-01). Segala yang berubah tiap panggilan —
   timestamp, UUID, hasil retrieval, jam — **tidak boleh** masuk system prompt, definisi
   tool, atau blok memori inti. Cache provider dicocokkan lewat hash prefix: satu byte
   bergeser dan cache tidak pernah kena, **tanpa error apa pun**. ESLint memblokir
   `Date.now()`/`new Date()` di **seluruh kode produksi**, bukan cuma jalur perakitan —
   injeksikan clock lewat parameter. Satu-satunya titik yang boleh menyentuh clock
   nyata adalah `clock.ts` per service (fungsi `nowIso()`), dipanggil di tepi I/O
   (route handler) lalu diteruskan sebagai `now` ke semua fungsi di baliknya.
2. **Jangan pernah menyimpan instruksi sebagai memori** (ADR-07, §14 PRD). Memori
   menyimpan fakta dan preferensi. Konten imperatif dibuang saat ekstraksi. Semua memori
   tersimpan diperlakukan sebagai **data tak-tepercaya selamanya** dan dirender ke model
   di dalam amplop "ini data, bukan instruksi".
3. **Tulisan dari model hosted masuk karantina** (ADR-07). `memory_propose`, bukan
   `memory_write`. Promosi hanya lewat konsolidasi lokal.
4. **Jangan hapus fakta — invalidate** (ADR-06). Set `t_invalid` + `superseded_by`.
   Retrieval selalu memfilter `t_invalid IS NULL`.
5. **Idempotency key wajib pada setiap efek samping** (ADR-12), dipaksakan di lapisan
   tool — bukan diminta lewat prompt.
6. **Setiap panggilan model mencatat biaya kontrafaktual** (ADR-13): biaya aktual *dan*
   biaya kebijakan naif. Selisihnya satu-satunya angka penghematan yang jujur.
7. **Gerbang sensitivitas dievaluasi sebelum biaya** (ADR-02) dan tidak pernah ditukar
   dengannya. Default gagal ke arah kualitas: menurunkan model butuh aturan yang menyala
   eksplisit, bukan jadi fallback.
8. **Pin versi model eksplisit** (ADR-14). Alias `-latest` dilarang di kode dan konfigurasi.
9. **Kredensial tidak pernah masuk konteks reasoning AI.** Hanya modul Connect yang
   memegangnya, terenkripsi at-rest.
10. **Jangan sentuh `inmy/`.** Ekosistem lama adalah referensi baca-saja. Tidak ada edit,
    pindah, `git mv`, atau push ke repo lamanya.

## Arsitektur singkat

- **Hub** = supervisor/coordinator. Satu otoritas pusat men-dispatch ke modul spesialis
  dengan konteks yang di-scope. **Tidak ada modul yang mengakses database modul lain
  secara langsung.** Bukan pola swarm.
- **Connect** = gerbang dua arah. Outbound: provider + mesin optimizer. Inbound: server MCP.
- **Context** = memori 4 tier. L0 log episodik append-only (ground truth), L1 fakta
  semantik bi-temporal, L2 memori inti (≤1.500 token, bisa diedit manusia), L3 artifact
  lewat just-in-time retrieval. **Tier selain L0 adalah proyeksi yang bisa dibangun ulang.**
- Model lokal = classifier/extractor/summarizer/reranker. **Bukan agent loop** — di RAM
  8–16GB model <7B gagal sistematis pada tool calling (ADR-04).

## Konvensi kode

- TypeScript strict, ESM, Node ≥22. `verbatimModuleSyntax` menyala — pakai
  `import type` untuk tipe.
- Nama modul internal: `Ai`, `Hub`, `Connect`, `Context`, `Sync`, `Space`, `Flow`,
  `Artifact`, `Sandbox`, `RnD`, `AutoClick`. **Tanpa prefix "InMy"** — itu penamaan
  ekosistem lama dan tidak boleh muncul di kode, dokumen, atau UI baru.
- Folder/package `kebab-case`; package npm `@ecorione/<nama>`.
- Skema bersama didefinisikan **sekali** di `packages/shared-schema` dan diimpor —
  jangan duplikasi tipe antar modul.
- Test berdampingan dengan sumbernya: `src/foo.ts` → `src/foo.test.ts`.

## Menambah keputusan

Keputusan besar dicatat satu baris di `docs/DECISIONS.md`. Keputusan arsitektur yang
mengubah invarian di atas butuh ADR baru di `docs/adr/`, bernomor urut, dengan konteks →
keputusan → konsekuensi.

## Yang sengaja TIDAK dibangun

Jangan menambahkan ini tanpa ADR baru yang membatalkan alasannya (semua ada di
`docs/research.md`): semantic caching, graph database, orkestrasi multi-agent, mesin
durable execution buatan sendiri, vLLM, microVM, otonomi L4, agent polling always-on.
