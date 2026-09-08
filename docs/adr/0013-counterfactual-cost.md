# ADR-13 — Akuntansi biaya kontrafaktual

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §2.6

## Konteks

Klaim "gue mengoptimalkan" hanya berarti kalau ada baseline tandingan. Tanpa itu, angka
penghematan adalah cerita, bukan pengukuran — dan produk yang namanya "optimizer" berhak
diminta buktinya.

Konvensi OpenTelemetry GenAI **tidak punya atribut biaya** dan **tidak memodelkan token
ter-cache**. Semua atribut `gen_ai.*` masih berstatus *Development* dengan rename breaking
yang sudah terjadi (`gen_ai.system` → `gen_ai.provider.name`, `prompt_tokens` →
`input_tokens`).

## Keputusan

Setiap panggilan model mencatat **dua** angka biaya: aktual, dan **kontrafaktual** — berapa
request yang sama akan berbiaya di bawah kebijakan naif (tanpa cache, model kuat default).
Selisihnya adalah satu-satunya angka penghematan yang jujur.

Juga dicatat: cache hit rate, diskon token input efektif, latensi, TTFT, **overhead
optimizer sebagai span terpisah** (latensi keputusan routing dibebankan ke optimizer, bukan
disembunyikan), keputusan rute, versi kebijakan, dan aturan mana yang menyala.

Biaya token dan cache diemit di namespace `ecorione.*` karena konvensi standar belum
memodelkannya.

Aturan A/B yang mengikat: acak **per-request** (bukan per-kohort — kualitas routing
berkorelasi dengan kesulitan tugas), **shadow mode** dulu, lantai kualitas dideklarasikan
di muka dengan auto-revert, p50 dan p95 dilaporkan terpisah.

## Konsekuensi

- **Ukur biaya per tugas selesai, bukan per panggilan.** Model murah menghasilkan lebih
  banyak giliran, yang bisa menghapus seluruh penghematannya.
- Escalation retry ke model kuat **dihitung dalam biaya**. Ledger yang menyembunyikannya
  berbohong.
- Baseline naif sengaja bukan model termahal: baseline yang dibuat-buat mahal menggelembungkan
  penghematan tanpa menghemat apa pun.
- **Angka penghematan tanpa angka kualitas di sebelahnya tidak berarti apa-apa.**
