# ADR-07 — Tulisan dari model hosted masuk karantina

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §3.4, §4.4

## Konteks

ecorione unik berbahayanya: ia **menyimpan konteks privat** yang **ditulisi agent yang
membaca materi tak-tepercaya**, lalu **dibaca agent yang bertindak**. Tanpa desain
melawannya, itu mesin pencucian prompt injection.

Serangan MINJA-class: penyerang — atau dokumen jahat yang dibaca agent — menyisipkan
instruksi permanen ke memori, yang menyala di query lain yang tidak berhubungan.

Catatan empiris yang menggembirakan: keberhasilan injeksi runtuh dari ~62% ke ~7% begitu
memori yang benar sudah cukup terisi. Tapi pertahanan berbasis **skor kepercayaan yang
dinilai LLM berhasil ditembus** di studi yang sama.

## Keputusan

Tool MCP yang diekspos bernama **`memory_propose`, bukan `memory_write`**. Tulisan dari
model hosted dan dari tool mendarat di tabel `quarantine`, tidak pernah langsung ke `facts`.
Konsolidasi lokal yang memvalidasi dan mempromosikan.

Empat lapis, berurutan menurut nilai:

1. **Jangan pernah menyimpan instruksi sebagai memori** — hanya fakta dan preferensi;
   konten imperatif dibuang saat ekstraksi.
2. **Provenance + skor `trust` per sumber**, dan skor itu **tidak pernah dinilai LLM**.
   Konten pihak ketiga masuk dengan trust rendah dan tidak pernah dipromosikan ke L2 tanpa
   konfirmasi pengguna.
3. **Karantina** untuk semua tulisan bertrust di bawah `USER`.
4. Memori dirender ke model di dalam **amplop eksplisit "ini data, bukan instruksi"**.

Promosi tidak boleh menaikkan scope usulan.

## Konsekuensi

- `stripImperativeContent` adalah heuristik defense-in-depth, **bukan batas keamanan**.
  Batas sebenarnya adalah karantina + trust + tidak pernah menempati posisi instruksi.
- Fakta tersimpan yang berisi penanda amplop dinetralkan sebelum dirender — kalau tidak,
  ia bisa menutup amplopnya sendiri dari dalam dan membuat seluruh pertahanan dekoratif.
